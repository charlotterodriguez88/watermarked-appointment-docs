import test from "node:test";
import assert from "node:assert/strict";
import { prepareExternalShare, ShareRequest } from "./appointment_service.ts";

test("share requests require an appointment id and document", () => {
  const result = ShareRequest.safeParse({ appointmentId: "apt-42", patientName: "Alex", pdf: "base64-pdf" });
  assert.equal(result.success, true);
  assert.equal(ShareRequest.safeParse({ appointmentId: "", patientName: "Alex", pdf: "base64-pdf" }).success, false);
});

test("share returns PDF bytes from the watermark response URL", async (t) => {
  const pdf = Buffer.from("%PDF-1.4\nwatermarked test document");
  const url = `data:application/pdf;base64,${pdf.toString("base64")}`;
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    if (String(input).endsWith("/v1/pdf/watermark")) {
      return Response.json({ ok: true, data: { url } });
    }
    if (String(input) === url) return originalFetch(input);
    return Response.json({ ok: true, data: { url: "https://example.test/upload" } });
  });
  const previousKey = process.env.INFRAI_API_KEY;
  process.env.INFRAI_API_KEY = "test-key";
  t.after(() => {
    if (previousKey === undefined) delete process.env.INFRAI_API_KEY;
    else process.env.INFRAI_API_KEY = previousKey;
  });
  const result = await prepareExternalShare({ appointmentId: "apt-test", patientName: "Synthetic", pdf: "input-pdf" });
  assert.equal(result.watermarkedPdf, pdf.toString("base64"));
  assert.equal(result.uploadUrl, "https://example.test/upload");
});
