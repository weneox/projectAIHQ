// src/pages/Admin/AdminBlog.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AdminSectionSkeleton from "./AdminSectionSkeleton";
import { useAdmin } from "./adminContext";

/* =========================
   Helpers
========================= */
function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const SUPPORTED_LANGS = ["az", "tr", "en", "ru", "es"] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

function getLangFromPath(pathname: string): Lang {
  const seg = (pathname.split("/")[1] || "").toLowerCase();
  return (SUPPORTED_LANGS as readonly string[]).includes(seg) ? (seg as Lang) : "en";
}

function safeSlugify(s: string) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\u00C0-\u024f]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function stripHtml(s: string) {
  return String(s || "").replace(/<[^>]*>/g, "").trim();
}

function nowIso() {
  return new Date().toISOString();
}

type PostStatus = "draft" | "published" | "archived" | string;

type AdminPost = {
  id: string;
  lang?: Lang | string;
  status?: PostStatus;
  published?: boolean;
  published_at?: string | null;
  publishedAt?: string | null;

  title: string;
  slug: string;
  excerpt?: string;
  content?: string;

  coverUrl?: string;
  cover_url?: string;
  category?: string;
  author?: string;
  read_time?: string;

  seo_title?: string;
  seo_description?: string;
  seo?: { title?: string; description?: string };

  createdAt?: string;
  updatedAt?: string;
};

type EditDraft = {
  id?: string; // undefined => new
  lang: Lang;
  status: PostStatus;

  title: string;
  slug: string;
  excerpt: string;
  content: string;

  coverUrl: string;
  category: string;
  author: string;
  read_time: string;

  seo_title: string;
  seo_description: string;
};

function toDraft(p: AdminPost, fallbackLang: Lang): EditDraft {
  const lang = (p.lang as Lang) || fallbackLang;
  const status = p.status || (p.published ? "published" : "draft");
  const seoTitle = p.seo_title || p.seo?.title || "";
  const seoDesc = p.seo_description || p.seo?.description || "";

  return {
    id: p.id,
    lang,
    status,

    title: p.title || "",
    slug: p.slug || "",
    excerpt: p.excerpt || "",
    content: p.content || "",

    coverUrl: p.coverUrl || p.cover_url || "",
    category: p.category || "",
    author: p.author || "NEOX",
    read_time: p.read_time || "5 dəq",

    seo_title: seoTitle,
    seo_description: seoDesc,
  };
}

function emptyDraft(lang: Lang): EditDraft {
  return {
    lang,
    status: "draft",
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    coverUrl: "",
    category: "",
    author: "NEOX",
    read_time: "5 dəq",
    seo_title: "",
    seo_description: "",
  };
}

/* =========================
   Media picker types
========================= */
type MediaItem = {
  id: number;
  secure_url: string;
  url?: string;
  public_id: string;
  title?: string;
  tags?: string[];
  type?: string;
  resource_type?: string;
  deleted?: boolean;
};

function normalizeBase(v: any) {
  return String(v || "").trim().replace(/\/+$/, "");
}

function isImage(m: MediaItem) {
  const t = (m.type || m.resource_type || "").toLowerCase();
  return t === "image";
}

/* =========================
   Main
========================= */
export default function AdminBlog() {
  const location = useLocation();
  const nav = useNavigate();
  const langFromUrl = getLangFromPath(location.pathname);

  // ✅ unified admin context
  const { apiBase, token } = useAdmin();
  const API_BASE = normalizeBase(apiBase);

  // list state
  const [rows, setRows] = useState<AdminPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // filters
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "draft" | "published">("all");
  const [filterLang, setFilterLang] = useState<"all" | Lang>("all");

  // editor
  const [editing, setEditing] = useState<EditDraft>(() => emptyDraft(langFromUrl));
  const [dirty, setDirty] = useState(false);

  // toast
  const [note, setNote] = useState<string | null>(null);

  // ===== Media Picker modal =====
  const [pickOpen, setPickOpen] = useState(false);
  const [pickLoading, setPickLoading] = useState(false);
  const [pickErr, setPickErr] = useState<string>("");
  const [pickQ, setPickQ] = useState("");
  const [pickItems, setPickItems] = useState<MediaItem[]>([]);

  // ===== helpers =====
  const updateField = <K extends keyof EditDraft>(k: K, v: EditDraft[K]) => {
    setEditing((prev) => ({ ...prev, [k]: v }));
    setDirty(true);
  };

  const adminHeaders = useCallback(() => {
    const t = String(token || "").trim();
    const h: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
    if (t) {
      h["Authorization"] = `Bearer ${t}`;
      h["x-admin-token"] = t;
    }
    return h;
  }, [token]);

  // ====== API calls ======
  const fetchPosts = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);

      if (!API_BASE) {
        setRows([]);
        setErr("API base tapılmadı (adminContext apiBase).");
        return;
      }
      if (!token) {
        setRows([]);
        setErr("Admin token yoxdur. Login et, sonra yenilə.");
        return;
      }

      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status !== "all") params.set("status", status);
      if (filterLang !== "all") params.set("lang", filterLang);

      // primary endpoint
      let res = await fetch(`${API_BASE}/api/admin/posts?${params.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "x-admin-token": token },
      });

      // fallback legacy
      if (!res.ok) {
        res = await fetch(`${API_BASE}/api/admin/blog?${params.toString()}`, {
          method: "GET",
          headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "x-admin-token": token },
        });
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      const list = (Array.isArray(j) ? j : j?.posts || j?.data || []) as any[];

      const norm: AdminPost[] = list
        .map((x) => {
          const p: any = x || {};
          const id = String(p.id ?? p.post_id ?? p._id ?? "");
          const title = String(p.title ?? "").trim();
          const slug = String(p.slug ?? "").trim();
          if (!id || !title || !slug) return null;

          return {
            id,
            lang: p.lang,
            status: p.status ?? (p.published ? "published" : "draft"),
            published: !!p.published,
            published_at: p.published_at ?? null,
            publishedAt: p.publishedAt ?? null,

            title,
            slug,
            excerpt: p.excerpt ?? "",
            content: p.content ?? "",

            coverUrl: p.coverUrl ?? p.cover_url ?? "",
            cover_url: p.cover_url ?? "",
            category: p.category ?? "",
            author: p.author ?? "NEOX",
            read_time: p.read_time ?? "5 dəq",

            seo_title: p.seo_title ?? p.seo?.title ?? "",
            seo_description: p.seo_description ?? p.seo?.description ?? "",
            seo: p.seo ?? undefined,

            createdAt: p.createdAt ?? p.created_at,
            updatedAt: p.updatedAt ?? p.updated_at,
          } as AdminPost;
        })
        .filter(Boolean) as AdminPost[];

      setRows(norm);
    } catch (e: any) {
      setErr(String(e?.message || e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [API_BASE, token, q, status, filterLang]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const openNew = useCallback(() => {
    setEditing(emptyDraft(langFromUrl));
    setDirty(false);
    setNote(null);
  }, [langFromUrl]);

  const openEdit = useCallback(
    (p: AdminPost) => {
      setEditing(toDraft(p, langFromUrl));
      setDirty(false);
      setNote(null);
    },
    [langFromUrl]
  );

  // auto slug for new posts
  const lastAutoSlug = useRef<string>("");
  useEffect(() => {
    if (editing.id) return;
    const auto = safeSlugify(editing.title);
    const current = String(editing.slug || "");
    const canAuto = !current || current === lastAutoSlug.current;
    if (canAuto && auto && auto !== current) {
      lastAutoSlug.current = auto;
      setEditing((p) => ({ ...p, slug: auto }));
    }
  }, [editing.title, editing.slug, editing.id]);

  const saveDraft = useCallback(async () => {
    try {
      setErr(null);
      if (!API_BASE) throw new Error("API base yoxdur.");
      if (!token) throw new Error("Admin token yoxdur.");

      const body: any = {
        lang: editing.lang,
        title: editing.title.trim(),
        slug: editing.slug.trim(),
        excerpt: editing.excerpt.trim(),
        content: editing.content,
        coverUrl: editing.coverUrl.trim(),
        category: editing.category.trim(),
        author: editing.author.trim(),
        read_time: editing.read_time.trim(),
        seo: { title: editing.seo_title.trim(), description: editing.seo_description.trim() },
        status: editing.status || "draft",
      };

      if (!body.title) throw new Error("Title boşdur.");
      if (!body.slug) throw new Error("Slug boşdur.");

      if (!editing.id) {
        let res = await fetch(`${API_BASE}/api/admin/posts`, { method: "POST", headers: adminHeaders(), body: JSON.stringify(body) });
        if (!res.ok) {
          res = await fetch(`${API_BASE}/api/admin/blog`, { method: "POST", headers: adminHeaders(), body: JSON.stringify(body) });
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        const created = (j?.post || j?.data || j) as any;
        const newId = String(created?.id ?? created?.post_id ?? "");
        if (newId) setEditing((p) => ({ ...p, id: newId }));
      } else {
        let res = await fetch(`${API_BASE}/api/admin/posts/${encodeURIComponent(editing.id)}`, {
          method: "PATCH",
          headers: adminHeaders(),
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          res = await fetch(`${API_BASE}/api/admin/blog/${encodeURIComponent(editing.id)}`, {
            method: "PATCH",
            headers: adminHeaders(),
            body: JSON.stringify(body),
          });
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }

      setDirty(false);
      await fetchPosts();
      setNote("✅ Saved");
      window.setTimeout(() => setNote(null), 1200);
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }, [API_BASE, token, editing, adminHeaders, fetchPosts]);

  const setPublish = useCallback(
    async (publish: boolean) => {
      try {
        setErr(null);
        if (!editing.id) throw new Error("Əvvəl save et (post ID lazımdır).");
        if (!API_BASE) throw new Error("API base yoxdur.");
        if (!token) throw new Error("Admin token yoxdur.");

        const id = editing.id;

        const tryEndpoints = async () => {
          const url1 = publish
            ? `${API_BASE}/api/admin/posts/${encodeURIComponent(id)}/publish`
            : `${API_BASE}/api/admin/posts/${encodeURIComponent(id)}/unpublish`;
          let res = await fetch(url1, { method: "POST", headers: adminHeaders() });
          if (res.ok) return true;

          const url2 = publish
            ? `${API_BASE}/api/admin/blog/${encodeURIComponent(id)}/publish`
            : `${API_BASE}/api/admin/blog/${encodeURIComponent(id)}/unpublish`;
          res = await fetch(url2, { method: "POST", headers: adminHeaders() });
          return res.ok;
        };

        const ok = await tryEndpoints();

        if (!ok) {
          const patchBody: any = publish
            ? { status: "published", published: true, published_at: nowIso() }
            : { status: "draft", published: false, published_at: null };

          let res = await fetch(`${API_BASE}/api/admin/posts/${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: adminHeaders(),
            body: JSON.stringify(patchBody),
          });

          if (!res.ok) {
            res = await fetch(`${API_BASE}/api/admin/blog/${encodeURIComponent(id)}`, {
              method: "PATCH",
              headers: adminHeaders(),
              body: JSON.stringify(patchBody),
            });
          }

          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        }

        setEditing((p) => ({ ...p, status: publish ? "published" : "draft" }));
        setDirty(false);
        await fetchPosts();
        setNote(publish ? "✅ Published" : "✅ Unpublished");
        window.setTimeout(() => setNote(null), 1200);
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    },
    [API_BASE, token, editing.id, adminHeaders, fetchPosts]
  );

  // ===== Media Picker =====
  const loadMediaImages = useCallback(async () => {
    setPickLoading(true);
    setPickErr("");
    try {
      if (!API_BASE) throw new Error("API base yoxdur.");
      if (!token) throw new Error("Admin token yoxdur.");

      const sp = new URLSearchParams();
      sp.set("type", "image");
      sp.set("limit", "200");
      if (pickQ.trim()) sp.set("q", pickQ.trim());

      const res = await fetch(`${API_BASE}/api/admin/media?${sp.toString()}`, { headers: adminHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      const arr = (j?.media || j?.items || []) as MediaItem[];
      const safe = Array.isArray(arr) ? arr : [];
      setPickItems(safe.filter((x) => !x.deleted && isImage(x) && (x.secure_url || x.url)));
    } catch (e: any) {
      setPickErr(String(e?.message || e));
      setPickItems([]);
    } finally {
      setPickLoading(false);
    }
  }, [API_BASE, token, pickQ, adminHeaders]);

  useEffect(() => {
    if (!pickOpen) return;
    loadMediaImages();
  }, [pickOpen, loadMediaImages]);

  const pickCover = useCallback(
    (m: MediaItem) => {
      const u = m.secure_url || m.url || "";
      if (!u) return;
      updateField("coverUrl", u);
      setPickOpen(false);
    },
    [updateField]
  );

  // ===== derived =====
  const filteredRows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows
      .filter((p) => {
        if (status === "draft" && (p.status === "published" || p.published)) return false;
        if (status === "published" && !(p.status === "published" || p.published)) return false;
        if (filterLang !== "all" && String(p.lang || "") !== filterLang) return false;
        if (!qq) return true;
        const hay = `${p.title} ${p.slug} ${p.excerpt || ""} ${p.author || ""} ${p.category || ""}`.toLowerCase();
        return hay.includes(qq);
      })
      .sort((a, b) => {
        const da = String(a.published_at || a.publishedAt || a.updatedAt || a.createdAt || "");
        const db = String(b.published_at || b.publishedAt || b.updatedAt || b.createdAt || "");
        return db.localeCompare(da);
      });
  }, [rows, q, status, filterLang]);

  const isPublished = editing.status === "published";

  return (
    <AdminSectionSkeleton
      title="Blog"
      subtitle="Post list + editor + publish. Cover seçimi Media Library-dən 1 kliklə."
      chips={["/api/admin/posts", "GET list", "POST create", "PATCH update", "publish/unpublish", "cover: pick from /api/admin/media"]}
    >
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button className="px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.06] transition" onClick={openNew} type="button">
            + New post
          </button>

          <button
            className={cx(
              "px-3 py-2 rounded-xl border transition",
              dirty ? "border-[rgba(47,184,255,.35)] bg-[rgba(47,184,255,.08)]" : "border-white/10 bg-white/[0.04]",
              "hover:bg-white/[0.06]"
            )}
            onClick={saveDraft}
            type="button"
          >
            Save
          </button>

          <button
            className={cx(
              "px-3 py-2 rounded-xl border transition",
              isPublished ? "border-white/10 bg-white/[0.04]" : "border-[rgba(47,184,255,.35)] bg-[rgba(47,184,255,.10)]",
              "hover:bg-white/[0.06]"
            )}
            onClick={() => setPublish(true)}
            type="button"
            disabled={!editing.id}
            title={!editing.id ? "Əvvəl save et" : "Publish"}
          >
            Publish
          </button>

          <button
            className="px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.06] transition"
            onClick={() => setPublish(false)}
            type="button"
            disabled={!editing.id}
            title={!editing.id ? "Əvvəl save et" : "Unpublish"}
          >
            Unpublish
          </button>

          <button
            className="px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.06] transition"
            onClick={() => nav(`/${langFromUrl}/admin/media`)}
            type="button"
          >
            Open Media
          </button>

          {note ? <span className="text-white/70 text-sm ml-2">{note}</span> : null}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button className="px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.06] transition" onClick={fetchPosts} type="button">
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {err ? (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 whitespace-pre-wrap">
          {err}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] gap-4">
        {/* Left: list */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <div className="p-3 border-b border-white/10">
            <div className="flex flex-col gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search title/slug/category…"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none text-white/85 placeholder:text-white/35"
              />

              <div className="flex gap-2 flex-wrap">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none text-white/85"
                >
                  <option value="all">All</option>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>

                <select
                  value={filterLang}
                  onChange={(e) => setFilterLang(e.target.value as any)}
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none text-white/85"
                >
                  <option value="all">All langs</option>
                  {SUPPORTED_LANGS.map((l) => (
                    <option key={l} value={l}>
                      {l.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="max-h-[72vh] overflow-auto">
            {loading ? (
              <div className="p-4 text-white/60 text-sm">Loading…</div>
            ) : filteredRows.length ? (
              <div className="divide-y divide-white/10">
                {filteredRows.map((p) => {
                  const pub = p.status === "published" || p.published;
                  return (
                    <button key={p.id} type="button" onClick={() => openEdit(p)} className="w-full text-left p-3 hover:bg-white/[0.04] transition">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-white font-semibold truncate">{p.title}</div>
                          <div className="text-white/55 text-xs truncate mt-0.5">/{p.slug}</div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className={cx(
                              "text-[11px] px-2 py-1 rounded-full border",
                              pub
                                ? "border-[rgba(47,184,255,.35)] bg-[rgba(47,184,255,.10)] text-white/85"
                                : "border-white/10 bg-white/[0.03] text-white/60"
                            )}
                          >
                            {pub ? "Published" : "Draft"}
                          </span>
                          <span className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/[0.03] text-white/60">
                            {(p.lang as any)?.toUpperCase?.() || "—"}
                          </span>
                        </div>
                      </div>

                      {p.excerpt ? <div className="mt-2 text-white/65 text-sm line-clamp-2">{stripHtml(p.excerpt)}</div> : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-white/60 text-sm">No posts.</div>
            )}
          </div>
        </div>

        {/* Right: editor */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-white font-semibold truncate">{editing.id ? `Edit: ${editing.title || "Untitled"}` : "New post"}</div>
              <div className="text-white/55 text-xs truncate mt-0.5">
                Status: {String(editing.status || "draft")} • Lang: {editing.lang.toUpperCase()}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <select
                value={editing.lang}
                onChange={(e) => updateField("lang", e.target.value as Lang)}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none text-white/85"
              >
                {SUPPORTED_LANGS.map((l) => (
                  <option key={l} value={l}>
                    {l.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-4 grid grid-cols-1 gap-3">
            {/* Title */}
            <div>
              <div className="text-white/70 text-xs mb-1">Title</div>
              <input
                value={editing.title}
                onChange={(e) => updateField("title", e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none text-white/90 placeholder:text-white/35"
                placeholder="Post title…"
              />
            </div>

            {/* Slug */}
            <div>
              <div className="text-white/70 text-xs mb-1">Slug</div>
              <input
                value={editing.slug}
                onChange={(e) => updateField("slug", safeSlugify(e.target.value))}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none text-white/90 placeholder:text-white/35"
                placeholder="my-post-slug"
              />
              <div className="text-white/45 text-[11px] mt-1">Public URL: /{editing.lang}/blog/{editing.slug || "..."}</div>
            </div>

            {/* Meta row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className="text-white/70 text-xs mb-1">Category</div>
                <input
                  value={editing.category}
                  onChange={(e) => updateField("category", e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none text-white/90 placeholder:text-white/35"
                  placeholder="e.g. Case Study"
                />
              </div>
              <div>
                <div className="text-white/70 text-xs mb-1">Author</div>
                <input
                  value={editing.author}
                  onChange={(e) => updateField("author", e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none text-white/90 placeholder:text-white/35"
                  placeholder="NEOX"
                />
              </div>
              <div>
                <div className="text-white/70 text-xs mb-1">Read time</div>
                <input
                  value={editing.read_time}
                  onChange={(e) => updateField("read_time", e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none text-white/90 placeholder:text-white/35"
                  placeholder='e.g. "5 dəq"'
                />
              </div>
            </div>

            {/* Cover */}
            <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-white/80 font-semibold">Cover</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    className="px-3 py-2 rounded-xl border border-[rgba(47,184,255,.35)] bg-[rgba(47,184,255,.10)] hover:bg-[rgba(47,184,255,.14)] transition"
                    onClick={() => setPickOpen(true)}
                  >
                    Pick from Media
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.06] transition"
                    onClick={() => nav(`/${langFromUrl}/admin/media`)}
                  >
                    Upload in Media
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.06] transition"
                    onClick={() => updateField("coverUrl", "")}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <div className="text-white/60 text-xs mb-1">Cover URL</div>
                <input
                  value={editing.coverUrl}
                  onChange={(e) => updateField("coverUrl", e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none text-white/90 placeholder:text-white/35"
                  placeholder="https://res.cloudinary.com/.../image/upload/..."
                />
              </div>

              {editing.coverUrl ? (
                <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                  <img src={editing.coverUrl} alt="cover" className="w-full h-[220px] object-cover" loading="lazy" decoding="async" />
                </div>
              ) : null}
            </div>

            {/* Excerpt */}
            <div>
              <div className="text-white/70 text-xs mb-1">Excerpt</div>
              <textarea
                value={editing.excerpt}
                onChange={(e) => updateField("excerpt", e.target.value)}
                className="w-full min-h-[92px] rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none text-white/90 placeholder:text-white/35"
                placeholder="Short summary…"
              />
            </div>

            {/* Content */}
            <div>
              <div className="text-white/70 text-xs mb-1">Content</div>
              <textarea
                value={editing.content}
                onChange={(e) => updateField("content", e.target.value)}
                className="w-full min-h-[240px] rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none text-white/90 placeholder:text-white/35 font-mono text-[13px]"
                placeholder="Write your post content (plain text or HTML)…"
              />
              <div className="text-white/45 text-[11px] mt-1">İpucu: HTML göndərsən, public BlogPost onu render edəcək.</div>
            </div>

            {/* SEO */}
            <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
              <div className="text-white/80 font-semibold">SEO</div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-white/60 text-xs mb-1">SEO Title</div>
                  <input
                    value={editing.seo_title}
                    onChange={(e) => updateField("seo_title", e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none text-white/90 placeholder:text-white/35"
                    placeholder="Optional…"
                  />
                </div>
                <div>
                  <div className="text-white/60 text-xs mb-1">SEO Description</div>
                  <input
                    value={editing.seo_description}
                    onChange={(e) => updateField("seo_description", e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none text-white/90 placeholder:text-white/35"
                    placeholder="Optional…"
                  />
                </div>
              </div>
            </div>

            <div className="text-white/45 text-xs">
              API base: <span className="text-white/65">{API_BASE || "—"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Media Picker Modal ===== */}
      {pickOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.55)",
            backdropFilter: "blur(8px)",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPickOpen(false);
          }}
        >
          <div
            style={{
              width: "min(980px, 100%)",
              maxHeight: "85vh",
              overflow: "hidden",
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,.12)",
              background: "rgba(10,10,12,.92)",
              boxShadow: "0 28px 90px rgba(0,0,0,.55)",
              display: "grid",
              gridTemplateRows: "auto 1fr",
            }}
          >
            <div style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,.10)", display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ fontWeight: 950, color: "rgba(255,255,255,.9)" }}>Pick cover from Media</div>
              <div style={{ flex: 1 }} />
              <input
                value={pickQ}
                onChange={(e) => setPickQ(e.target.value)}
                placeholder="Search (title, tags, filename)…"
                style={{
                  width: 320,
                  maxWidth: "52vw",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(0,0,0,0.25)",
                  color: "white",
                  outline: "none",
                }}
              />
              <button
                onClick={loadMediaImages}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.16)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                {pickLoading ? "..." : "Search"}
              </button>
              <button
                onClick={() => setPickOpen(false)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.16)",
                  background: "rgba(255,255,255,0.04)",
                  color: "white",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>

            <div style={{ padding: 12, overflow: "auto" }}>
              {pickErr ? (
                <div style={{ marginBottom: 10, color: "#ffb3b3", fontWeight: 800 }}>Error: {pickErr}</div>
              ) : null}

              {pickLoading ? (
                <div style={{ opacity: 0.75 }}>Loading…</div>
              ) : pickItems.length ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
                  {pickItems.map((m) => {
                    const url = m.secure_url || m.url || "";
                    return (
                      <button
                        key={m.id}
                        onClick={() => pickCover(m)}
                        style={{
                          textAlign: "left",
                          borderRadius: 16,
                          border: "1px solid rgba(255,255,255,0.10)",
                          background: "rgba(255,255,255,0.03)",
                          color: "white",
                          padding: 10,
                          cursor: "pointer",
                        }}
                      >
                        <div
                          style={{
                            borderRadius: 12,
                            overflow: "hidden",
                            border: "1px solid rgba(255,255,255,0.10)",
                            background: "rgba(255,255,255,0.03)",
                            height: 110,
                          }}
                        >
                          <img src={url} alt={m.title || m.public_id} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                        <div style={{ marginTop: 8, fontWeight: 900, fontSize: 12, lineHeight: 1.2 }}>
                          {m.title || m.public_id}
                        </div>
                        {m.tags?.length ? <div style={{ marginTop: 6, opacity: 0.7, fontSize: 11 }}>{m.tags.slice(0, 3).join(", ")}</div> : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ opacity: 0.75 }}>No images found.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </AdminSectionSkeleton>
  );
}
