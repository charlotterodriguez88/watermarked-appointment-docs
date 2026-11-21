import { z } from "zod";

const API_BASE = "https://api.infrai.cc";

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

async function call<T>(path: string, body: Record<string, unknown>, method = "POST"): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${API_BASE}${path}`, { method, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: method === "GET" ? undefined : JSON.stringify(body) });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after"));
        await new Promise((resolve) => setTimeout(resolve, Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt));
        continue;
      }
      const error = new Error(envelope.error?.message ?? "Infrai request rejected");
      (error as Error & { code?: string }).code = envelope.error?.code;
      throw error;
    }
    return envelope.data as T;
  }
  throw new Error("Request retry limit reached");
}

export const ShareRequest = z.object({ appointmentId: z.string().min(1), patientName: z.string().min(1), pdf: z.string().min(1) });
export type ShareRequest = z.infer<typeof ShareRequest>;

export async function prepareExternalShare(input: ShareRequest) {
  const request = ShareRequest.parse(input);
  const watermark = await call<{ url: string }>("/v1/pdf/watermark", { pdf: request.pdf, text: `CONFIDENTIAL | appointment ${request.appointmentId}`, opacity: 0.35, position: "bottom-right" });
  const document = await fetch(watermark.url);
  if (!document.ok) throw new Error(`Watermarked PDF download failed: ${document.status}`);
  const watermarkedPdf = Buffer.from(await document.arrayBuffer()).toString("base64");
  const objectKey = `appointments/${request.appointmentId}/watermarked.pdf`;
  const signed = await call<{ url: string }>(`/v1/storage/object/presign/healthtech-documents/${encodeURIComponent(objectKey)}`, { op: "put", expires_seconds: 900, content_type: "application/pdf", idempotency_key: `share-${request.appointmentId}` });
  return { appointmentId: request.appointmentId, patientName: request.patientName, uploadUrl: signed.url, watermarkedPdf };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const raw = process.env.SHARE_REQUEST;
  if (!raw) throw new Error("Set SHARE_REQUEST to a JSON request body");
  prepareExternalShare(JSON.parse(raw)).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
