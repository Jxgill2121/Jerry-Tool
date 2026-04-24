import axios from "axios";

const api = axios.create({ baseURL: "/api" });

export default api;

// ── helpers ───────────────────────────────────────────────────────────────────

export function buildFormData(fields: Record<string, unknown>, files?: File[], fileKey = "files"): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "object" && !(v instanceof File)) {
      fd.append(k, JSON.stringify(v));
    } else {
      fd.append(k, String(v));
    }
  }
  if (files) {
    for (const f of files) fd.append(fileKey, f);
  }
  return fd;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href    = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function getHeaders(endpoint: string, files: File[]): Promise<string[]> {
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  const res = await api.post(`${endpoint}/headers`, fd);
  return res.data.headers as string[];
}
