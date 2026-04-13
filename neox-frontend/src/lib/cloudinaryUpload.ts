// src/lib/cloudinaryUpload.ts
export type SignedUploadResponse = {
  ok: true;
  upload_url: string;
  api_key: string;
  cloud_name: string;
  params: Record<string, any>;
  limits?: { max_mb?: number };
};

export type CloudinaryUploadResult = {
  secure_url: string;
  url?: string;
  public_id: string;
  resource_type?: string;
  format?: string;
  width?: number;
  height?: number;
  bytes?: number;
  original_filename?: string;
  asset_id?: string;
  version?: number;
};

export async function signMediaUpload(API_BASE: string, token: string, body: any) {
  const r = await fetch(`${API_BASE}/api/admin/media/sign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body || {}),
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || `sign failed (${r.status})`);
  return j as SignedUploadResponse;
}

export async function uploadToCloudinary(
  upload_url: string,
  params: Record<string, any>,
  file: File,
  onProgress?: (pct: number) => void
) {
  const form = new FormData();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    form.append(k, String(v));
  });
  form.append("file", file);

  // Use XHR for progress
  const res: CloudinaryUploadResult = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", upload_url, true);

    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      const pct = Math.round((evt.loaded / evt.total) * 100);
      onProgress?.(pct);
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      try {
        const json = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 200 && xhr.status < 300) resolve(json);
        else reject(new Error(json?.error?.message || json?.error || `upload failed (${xhr.status})`));
      } catch (e: any) {
        reject(new Error(e?.message || "upload failed"));
      }
    };

    xhr.onerror = () => reject(new Error("upload network error"));
    xhr.send(form);
  });

  return res;
}

export async function storeMedia(API_BASE: string, token: string, payload: any) {
  const r = await fetch(`${API_BASE}/api/admin/media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload || {}),
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || `store failed (${r.status})`);
  return j;
}
