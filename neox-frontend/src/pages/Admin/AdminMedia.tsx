// src/pages/Admin/AdminMedia.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminSectionSkeleton from "./AdminSectionSkeleton";
import { useAdmin } from "./adminContext";

type MediaItem = {
  id: number;
  uid?: string;
  createdAt?: string;
  updatedAt?: string;

  public_id: string;
  secure_url: string;
  url?: string;
  thumbnail_url?: string;

  type?: string; // image|video|raw
  resource_type?: string;
  format?: string;

  width?: number;
  height?: number;
  bytes?: number;

  original_filename?: string;
  mime?: string;

  tags?: string[];
  title?: string;
  note?: string;

  deleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
};

type SignResp = {
  ok: boolean;
  upload_url: string;
  api_key: string;
  cloud_name?: string;
  params: Record<string, any>;
  limits?: { max_mb?: number };
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function normalizeBase(v: any) {
  return String(v || "").trim().replace(/\/+$/, "");
}

function bytesToMB(bytes?: number) {
  const b = Number(bytes || 0) || 0;
  return (b / (1024 * 1024)).toFixed(2);
}

function guessTypeFromFile(file: File): "image" | "video" | "raw" {
  const mt = String(file.type || "").toLowerCase();
  if (mt.startsWith("image/")) return "image";
  if (mt.startsWith("video/")) return "video";
  return "raw";
}

function isImg(item: MediaItem) {
  return (item.type || item.resource_type || "").toLowerCase() === "image";
}
function isVid(item: MediaItem) {
  return (item.type || item.resource_type || "").toLowerCase() === "video";
}

// ✅ XHR upload for progress
function uploadWithProgress(uploadUrl: string, fd: FormData, onProgress?: (pct: number) => void) {
  return new Promise<any>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl, true);

    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      const pct = Math.max(0, Math.min(100, Math.round((evt.loaded / evt.total) * 100)));
      onProgress?.(pct);
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      let json: any = null;
      try {
        json = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        json = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(json);
      const msg = json?.error?.message || json?.error || `Upload failed (${xhr.status})`;
      return reject(new Error(msg));
    };

    xhr.onerror = () => reject(new Error("Upload network error"));
    xhr.send(fd);
  });
}

export default function AdminMedia() {
  // ✅ use unified admin context (token + apiBase)
  const { apiBase, token } = useAdmin();
  const API_BASE = normalizeBase(apiBase); // "" allowed (same-origin)

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string>("");

  const [items, setItems] = useState<MediaItem[]>([]);
  const [selected, setSelected] = useState<MediaItem | null>(null);

  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [type, setType] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const [uploadTags, setUploadTags] = useState<string>("");
  const [uploadFolder, setUploadFolder] = useState<string>("media");
  const [uploadTitle, setUploadTitle] = useState<string>("");
  const [uploadNote, setUploadNote] = useState<string>("");

  const [progress, setProgress] = useState<number>(0);
  const [uploadName, setUploadName] = useState<string>("");

  const fileRef = useRef<HTMLInputElement | null>(null);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (tag.trim()) sp.set("tag", tag.trim());
    if (type.trim()) sp.set("type", type.trim());
    if (includeDeleted) sp.set("include_deleted", "1");
    sp.set("limit", "500");
    const s = sp.toString();
    return s ? `?${s}` : "";
  }, [q, tag, type, includeDeleted]);

  const apiFetch = useCallback(
    async (path: string, opts: RequestInit = {}) => {
      const headers = new Headers(opts.headers || {});
      if (!headers.has("Content-Type") && !(opts.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
      }
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
        headers.set("x-admin-token", token); // legacy support
      }

      const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (!res.ok) {
        const msg = json?.error || json?.message || `HTTP ${res.status}`;
        throw new Error(msg);
      }
      return json;
    },
    [API_BASE, token]
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const j = await apiFetch(`/api/admin/media${queryString}`);
      const arr = (j?.media || j?.items || []) as MediaItem[];
      const safe = Array.isArray(arr) ? arr : [];
      setItems(safe);

      // keep selected fresh
      if (selected) {
        const found = safe.find((x: any) => Number(x?.id) === Number(selected.id));
        setSelected(found || null);
      }
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [apiFetch, queryString, selected]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const onPickFile = useCallback(() => {
    fileRef.current?.click();
  }, []);

  // ✅ allow multi upload
  const onFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;

      try {
        for (const f of files) {
          await doUploadOneRef.current?.(f);
        }
      } finally {
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    []
  );

  // use ref to avoid deps loop
  const doUploadOneRef = useRef<((file: File) => Promise<void>) | null>(null);

  const doUploadOne = useCallback(
    async (file: File) => {
      setUploading(true);
      setErr("");
      setProgress(0);
      setUploadName(file.name);

      try {
        // 1) sign
        const tagsArr = uploadTags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        const mediaType = guessTypeFromFile(file);

        const signBody = {
          type: mediaType,
          tags: tagsArr,
          folder: uploadFolder || "media",
          prefix: "asset",
        };

        const sign = (await apiFetch(`/api/admin/media/sign`, {
          method: "POST",
          body: JSON.stringify(signBody),
        })) as SignResp;

        if (!sign?.ok) throw new Error("sign_failed");

        // optional max size check
        const maxMb = Number(sign?.limits?.max_mb || 0) || 0;
        if (maxMb > 0) {
          const maxBytes = maxMb * 1024 * 1024;
          if (file.size > maxBytes) {
            throw new Error(`File too large. Max ${maxMb} MB`);
          }
        }

        // 2) upload directly to Cloudinary (XHR for progress)
        const fd = new FormData();
        fd.append("file", file);
        Object.entries(sign.params || {}).forEach(([k, v]) => {
          if (v === undefined || v === null) return;
          fd.append(k, String(v));
        });

        const upJson = await uploadWithProgress(String(sign.upload_url), fd, (pct) => setProgress(pct));

        // 3) store in our DB
        const storeBody = {
          ...upJson,
          tags: tagsArr,
          title: uploadTitle || file.name,
          note: uploadNote || "",
          mime: file.type || "",
        };

        const saved = await apiFetch(`/api/admin/media`, {
          method: "POST",
          body: JSON.stringify(storeBody),
        });

        // refresh
        await loadList();

        // select newly added if possible
        const newItem = (saved?.media || null) as MediaItem | null;
        if (newItem?.id) setSelected(newItem);

        // clear small fields (keep folder/tags)
        setUploadTitle("");
        setUploadNote("");
      } finally {
        setUploading(false);
        setProgress(0);
        setUploadName("");
      }
    },
    [apiFetch, loadList, uploadTags, uploadFolder, uploadTitle, uploadNote]
  );

  useEffect(() => {
    doUploadOneRef.current = doUploadOne;
  }, [doUploadOne]);

  const doDelete = useCallback(
    async (item: MediaItem) => {
      setErr("");
      try {
        await apiFetch(`/api/admin/media/${item.id}`, { method: "DELETE" });
        await loadList();
        if (selected?.id === item.id) setSelected(null);
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    },
    [apiFetch, loadList, selected]
  );

  const doRestore = useCallback(
    async (item: MediaItem) => {
      setErr("");
      try {
        await apiFetch(`/api/admin/media/${item.id}/restore`, { method: "POST", body: JSON.stringify({}) });
        await loadList();
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    },
    [apiFetch, loadList]
  );

  const doCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  }, []);

  return (
    <AdminSectionSkeleton
      title="Media"
      subtitle="Cloudinary signed upload → library → preview → copy URL → tags → delete/restore."
      chips={["/api/admin/media/sign", "/api/admin/media", "grid", "preview", "copy url", "tags", "delete/restore"]}
    >
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 420px)", gap: 16 }}>
        {/* LEFT */}
        <div style={{ minWidth: 0 }}>
          {/* Controls */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 160px 140px 150px",
              gap: 10,
              alignItems: "center",
            }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search (title, note, filename, public_id, tags)"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.25)",
                color: "white",
                outline: "none",
              }}
            />

            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="tag"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.25)",
                color: "white",
                outline: "none",
              }}
            />

            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.25)",
                color: "white",
                outline: "none",
              }}
            >
              <option value="">all</option>
              <option value="image">image</option>
              <option value="video">video</option>
              <option value="raw">raw</option>
            </select>

            <label style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", opacity: 0.9 }}>
              <input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />
              include deleted
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
            <button
              onClick={loadList}
              disabled={loading || uploading}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.16)",
                background: "rgba(255,255,255,0.06)",
                color: "white",
                fontWeight: 800,
                cursor: loading || uploading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            <button
              onClick={onPickFile}
              disabled={uploading}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.16)",
                background: uploading ? "rgba(255,255,255,0.04)" : "rgba(120,180,255,0.18)",
                color: "white",
                fontWeight: 900,
                cursor: uploading ? "not-allowed" : "pointer",
              }}
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>

            {/* ✅ multiple */}
            <input ref={fileRef} type="file" multiple onChange={onFileChange} style={{ display: "none" }} />

            <div style={{ flex: 1 }} />

            <div style={{ opacity: 0.75, fontSize: 12 }}>
              API: <span style={{ fontWeight: 800 }}>{API_BASE || "(same-origin)"}</span>
            </div>
          </div>

          {/* ✅ Upload progress */}
          {uploading ? (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.18)",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div style={{ minWidth: 0, fontWeight: 900, fontSize: 12, opacity: 0.9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {uploadName || "Uploading..."}
              </div>
              <div style={{ flex: 1, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ width: `${progress}%`, height: 8, background: "rgba(120,180,255,0.55)" }} />
              </div>
              <div style={{ width: 40, textAlign: "right", fontSize: 12, opacity: 0.85, fontWeight: 900 }}>{progress}%</div>
            </div>
          ) : null}

          {/* Upload meta */}
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(0,0,0,0.18)",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "180px minmax(0, 1fr)", gap: 10, alignItems: "center" }}>
              <div style={{ opacity: 0.8 }}>Folder</div>
              <input
                value={uploadFolder}
                onChange={(e) => setUploadFolder(e.target.value)}
                placeholder="media"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(0,0,0,0.25)",
                  color: "white",
                  outline: "none",
                }}
              />

              <div style={{ opacity: 0.8 }}>Tags (comma)</div>
              <input
                value={uploadTags}
                onChange={(e) => setUploadTags(e.target.value)}
                placeholder="pricing, case-study, landing"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(0,0,0,0.25)",
                  color: "white",
                  outline: "none",
                }}
              />

              <div style={{ opacity: 0.8 }}>Title</div>
              <input
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Optional title (default = file name)"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(0,0,0,0.25)",
                  color: "white",
                  outline: "none",
                }}
              />

              <div style={{ opacity: 0.8 }}>Note</div>
              <input
                value={uploadNote}
                onChange={(e) => setUploadNote(e.target.value)}
                placeholder="Internal note"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(0,0,0,0.25)",
                  color: "white",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12, lineHeight: 1.4 }}>
              Flow: <b>sign</b> → upload directly to Cloudinary → <b>store in DB</b>.
              <br />
              If sign fails: check Railway env vars: <b>CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET</b>.
            </div>
          </div>

          {err ? (
            <div style={{ marginTop: 12, color: "#ffb3b3", fontWeight: 800 }}>
              Error: {err}
            </div>
          ) : null}

          {/* Grid */}
          <div
            style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
              gap: 12,
            }}
          >
            {(items || []).map((it) => {
              const active = selected?.id === it.id;
              const url = it.secure_url || it.url || "";
              return (
                <button
                  key={it.id}
                  onClick={() => setSelected(it)}
                  style={{
                    textAlign: "left",
                    borderRadius: 16,
                    border: active ? "1px solid rgba(120,180,255,0.65)" : "1px solid rgba(255,255,255,0.10)",
                    background: active ? "rgba(120,180,255,0.12)" : "rgba(0,0,0,0.18)",
                    color: "white",
                    padding: 10,
                    cursor: "pointer",
                    minHeight: 164,
                    position: "relative",
                    opacity: it.deleted ? 0.55 : 1,
                  }}
                >
                  <div
                    style={{
                      borderRadius: 12,
                      overflow: "hidden",
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.03)",
                      height: 100,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {isImg(it) && url ? (
                      <img src={url} alt={it.title || it.public_id} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : isVid(it) && url ? (
                      <video src={url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                    ) : (
                      <div style={{ opacity: 0.7, fontWeight: 900, fontSize: 12 }}>{String(it.type || "raw").toUpperCase()}</div>
                    )}
                  </div>

                  <div style={{ marginTop: 8, fontWeight: 900, fontSize: 13, lineHeight: 1.2 }}>
                    {it.title || it.original_filename || it.public_id}
                  </div>

                  <div style={{ marginTop: 6, opacity: 0.72, fontSize: 12 }}>
                    #{it.id} • {(it.type || it.resource_type || "raw")}
                    {it.bytes ? ` • ${bytesToMB(it.bytes)} MB` : ""}
                  </div>

                  {it.tags?.length ? (
                    <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {it.tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          style={{
                            fontSize: 11,
                            padding: "3px 8px",
                            borderRadius: 999,
                            border: "1px solid rgba(255,255,255,0.14)",
                            background: "rgba(255,255,255,0.06)",
                            opacity: 0.9,
                          }}
                        >
                          {t}
                        </span>
                      ))}
                      {it.tags.length > 3 ? <span style={{ fontSize: 11, opacity: 0.7 }}>+{it.tags.length - 3}</span> : null}
                    </div>
                  ) : null}

                  {it.deleted ? (
                    <span
                      style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        fontSize: 11,
                        padding: "3px 8px",
                        borderRadius: 999,
                        border: "1px solid rgba(255,120,120,0.35)",
                        background: "rgba(255,120,120,0.12)",
                        fontWeight: 900,
                      }}
                    >
                      DELETED
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT */}
        <div
          style={{
            minWidth: 0,
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(0,0,0,0.18)",
            padding: 14,
            height: "fit-content",
            position: "sticky",
            top: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 950, fontSize: 14 }}>Preview</div>
            <div style={{ flex: 1 }} />
            {selected?.secure_url ? (
              <button
                onClick={() => doCopy(selected.secure_url)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.16)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Copy URL
              </button>
            ) : null}
          </div>

          {!selected ? (
            <div style={{ marginTop: 12, opacity: 0.72, lineHeight: 1.5 }}>Select an item from the grid to preview.</div>
          ) : (
            <>
              <div
                style={{
                  marginTop: 12,
                  borderRadius: 14,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.03)",
                  height: 240,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isImg(selected) && selected.secure_url ? (
                  <img src={selected.secure_url} alt={selected.title || selected.public_id} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                ) : isVid(selected) && selected.secure_url ? (
                  <video src={selected.secure_url} controls style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                ) : (
                  <div style={{ opacity: 0.75, fontWeight: 900 }}>{String(selected.type || "raw").toUpperCase()}</div>
                )}
              </div>

              <div style={{ marginTop: 10, fontWeight: 950, lineHeight: 1.2 }}>{selected.title || selected.original_filename || selected.public_id}</div>

              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.78, lineHeight: 1.5 }}>
                <div>
                  <b>ID:</b> #{selected.id}
                </div>
                <div>
                  <b>public_id:</b> {selected.public_id}
                </div>
                <div>
                  <b>type:</b> {selected.type || selected.resource_type || "raw"}
                </div>
                {selected.format ? (
                  <div>
                    <b>format:</b> {selected.format}
                  </div>
                ) : null}
                {selected.width && selected.height ? (
                  <div>
                    <b>size:</b> {selected.width}×{selected.height}
                  </div>
                ) : null}
                {selected.bytes ? (
                  <div>
                    <b>bytes:</b> {selected.bytes} ({bytesToMB(selected.bytes)} MB)
                  </div>
                ) : null}
                {selected.deleted ? (
                  <div style={{ color: "#ffb3b3" }}>
                    <b>deleted:</b> {selected.deletedAt || "yes"}
                  </div>
                ) : null}
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={{ opacity: 0.8, fontSize: 12, fontWeight: 900 }}>Tags</div>
                <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(selected.tags || []).length ? (
                    selected.tags!.map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: 11,
                          padding: "3px 8px",
                          borderRadius: 999,
                          border: "1px solid rgba(255,255,255,0.14)",
                          background: "rgba(255,255,255,0.06)",
                        }}
                      >
                        {t}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: 12, opacity: 0.7 }}>No tags</span>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                {!selected.deleted ? (
                  <button
                    onClick={() => doDelete(selected)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,120,120,0.28)",
                      background: "rgba(255,120,120,0.12)",
                      color: "white",
                      fontWeight: 950,
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                ) : (
                  <button
                    onClick={() => doRestore(selected)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(120,255,180,0.22)",
                      background: "rgba(120,255,180,0.12)",
                      color: "white",
                      fontWeight: 950,
                      cursor: "pointer",
                    }}
                  >
                    Restore
                  </button>
                )}

                {selected.secure_url ? (
                  <button
                    onClick={() => window.open(selected.secure_url, "_blank")}
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
                    Open
                  </button>
                ) : null}

                {selected.public_id ? (
                  <button
                    onClick={() => doCopy(selected.public_id)}
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
                    Copy public_id
                  </button>
                ) : null}
              </div>

              <div style={{ marginTop: 12, opacity: 0.65, fontSize: 12, lineHeight: 1.4 }}>
                Next improvement: inline edit tags/title/note + references (where used).
              </div>
            </>
          )}
        </div>
      </div>

      {/* ✅ small responsive fix so right panel doesn’t break on mobile */}
      <style>{`
        @media (max-width: 980px){
          .admin-media-grid { grid-template-columns: minmax(0,1fr) !important; }
        }
      `}</style>
    </AdminSectionSkeleton>
  );
}
