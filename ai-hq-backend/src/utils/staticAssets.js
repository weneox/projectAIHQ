import path from "path";

const SAFE_PUBLIC_ASSET_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".avif",
  ".ico",
  ".pdf",
  ".mp4",
  ".webm",
  ".mov",
  ".mp3",
  ".wav",
  ".m4a",
  ".ogg",
]);

function s(v, d = "") {
  return String(v ?? d).trim();
}

function normalizeRequestPath(value = "") {
  const raw = s(value).replace(/\\/g, "/");
  return raw.startsWith("/") ? raw : `/${raw}`;
}

export function isSafePublicAssetRequestPath(value = "") {
  const raw = normalizeRequestPath(value);

  if (!raw || raw.includes("\0")) return false;
  if (raw.includes("../") || raw.includes("/..") || raw === "..") return false;

  const normalized = path.posix.normalize(raw);
  const segments = normalized.split("/").filter(Boolean);

  if (!segments.length) return false;
  if (segments.some((segment) => segment.startsWith("."))) return false;

  const ext = path.posix.extname(normalized).toLowerCase();
  return SAFE_PUBLIC_ASSET_EXTENSIONS.has(ext);
}

export function publicAssetGuard(req, res, next) {
  const requestPath = s(req?.path || req?.url || "");

  if (!isSafePublicAssetRequestPath(requestPath)) {
    return res.status(404).json({
      ok: false,
      error: "asset_not_found",
    });
  }

  return next();
}

export function createStaticAssetOptions({ maxAge = "1h" } = {}) {
  return {
    maxAge,
    index: false,
    redirect: false,
    dotfiles: "deny",
    fallthrough: true,
    setHeaders(res) {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  };
}

export const __test__ = {
  SAFE_PUBLIC_ASSET_EXTENSIONS,
  normalizeRequestPath,
};
