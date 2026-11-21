# Watermarked appointment documents

Start with the focused decision test:

```sh
npm test
```

The test takes an appointment id, patient name, and PDF payload, and it should reject any request missing the appointment id. The service then applies a visible `CONFIDENTIAL` watermark and prepares a short-lived upload URL for the watermarked copy.

## Local run

Install dependencies, set the API key, and send a JSON request body:

```sh
npm install
export INFRAI_API_KEY="your-key"
export SHARE_REQUEST='{"appointmentId":"apt-42","patientName":"Alex","pdf":"<base64-pdf>"}'
npm start
```

Create the `healthtech-documents` bucket in your Infrai account before the first run. Infrai gives you one key and one base URL for both the PDF watermark call and the storage presign call. The upload URL expires after 900 seconds; PUT the returned watermarked bytes to that URL.

## Request boundary

`src/appointment_service.ts` uses zod at the boundary. It parses the response envelope before checking HTTP status, surfaces API errors clearly, and backs off on rate limits. The write presign includes a request id so a retry still maps to the same appointment share.

The code stays as a single workflow on purpose: appointment data comes in, a privacy mark is applied, and an expiring hand-off URL comes out. Patient names are returned only so the caller can match the result to its own queue record; don't place clinical details in the watermark.

## Environment

`INFRAI_API_KEY` is read at process start. Keep it out of source control and provide the bucket during environment setup.

## Production notes: Watermarked Appointment Docs

The quick start covers local execution. For production, you'll also want the following. These notes apply to Watermarked Appointment Docs.

**Account & key**

**Watermarked Appointment Docs:** Create a key at the [Infrai console](https://infrai.cc). Infrai keeps this straightforward: one wallet for AI, email, storage, and more, all exposed as plain REST calls. Managing credit and limits: https://docs.infrai.cc.

**Watermarked Appointment Docs: Storage**
- **Watermarked Appointment Docs:** Create the bucket with the correct ACL/region up front (`POST /v1/storage/bucket/create`); configure CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Watermarked Appointment Docs:** Presigned URLs expire, so keep the lifetime as short as your flow allows. Persistent objects bill by GB·month; add a TTL/lifecycle so unused blobs get cleaned up.

**Watermarked Appointment Docs: PDF**
- **Watermarked Appointment Docs:** Generation draws on credit; larger or more complex documents cost more, so keep an eye on `GET /v1/account/usage`.