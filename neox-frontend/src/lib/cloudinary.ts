// src/lib/cloudinary.ts
const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;

type ResourceType = "image" | "video";

type CldUrlOpts = {
  publicId: string;                 // məsələn: "services/mobileapps/hero"
  resourceType?: ResourceType;      // default: "image"
  transformations?: string[];       // ["w_1600","c_limit",...]
  format?: string;                 // default: "auto"
  quality?: string;                // default: "auto"
};

export function cldUrl({
  publicId,
  resourceType = "image",
  transformations = [],
  format = "auto",
  quality = "auto",
}: CldUrlOpts) {
  if (!CLOUD) throw new Error("VITE_CLOUDINARY_CLOUD_NAME yoxdur (.env yoxla)");
  if (!publicId) throw new Error("cldUrl: publicId lazımdır");

  const base = `https://res.cloudinary.com/${CLOUD}/${resourceType}/upload`;
  const tx = [`f_${format}`, `q_${quality}`, ...transformations].filter(Boolean).join(",");
  return `${base}/${tx}/${publicId}`;
}

export function cldImg(
  publicId: string,
  opts: {
    w?: number;
    h?: number;
    crop?: "fill" | "crop" | "fit" | "scale" | "limit";
    gravity?: string; // "auto" / "face" / "center"
    dpr?: string | number; // "auto" tövsiyə
    extra?: string[];
  } = {}
) {
  const { w, h, crop = "fill", gravity = "auto", dpr = "auto", extra = [] } = opts;

  const t: string[] = [];
  if (w) t.push(`w_${w}`);
  if (h) t.push(`h_${h}`);
  t.push(`c_${crop}`);
  if (gravity) t.push(`g_${gravity}`);
  if (dpr) t.push(`dpr_${dpr}`);
  t.push(...extra);

  return cldUrl({ publicId, resourceType: "image", transformations: t });
}

export function cldVideo(
  publicId: string,
  opts: {
    w?: number;
    h?: number;
    crop?: "fill" | "crop" | "fit" | "scale" | "limit";
    dpr?: string | number;
    extra?: string[];
  } = {}
) {
  const { w, h, crop = "limit", dpr = "auto", extra = [] } = opts;

  const t: string[] = [];
  if (w) t.push(`w_${w}`);
  if (h) t.push(`h_${h}`);
  t.push(`c_${crop}`);
  if (dpr) t.push(`dpr_${dpr}`);
  t.push(...extra);

  return cldUrl({ publicId, resourceType: "video", transformations: t });
}
