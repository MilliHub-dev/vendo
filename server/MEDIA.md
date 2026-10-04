# Supabase Storage uploads

Migration `202610030011_media_storage.sql` adds private file metadata, Storage references for rider documents and restrictive bucket policies. No Supabase bucket creation or hosted migration was performed during implementation.

## Setup

1. Put `SUPABASE_SERVICE_ROLE_KEY` in the server environment only, alongside the existing `SUPABASE_URL` and public Auth key. Never expose this privileged key in mobile/web configuration.
2. Apply migrations using `npm run db:migrate` in the appropriate environment.
3. Run `npm run storage:setup` from the server checkout. It explicitly creates/configures `vendo-public` (public images) and `vendo-documents` (private files), with a 2 MiB limit and allowed MIME types. It refuses existing buckets with incompatible visibility. Use a migration operator allowed to create policies on Supabase-managed Storage tables.
4. Verify uploads/downloads in staging using configured Supabase credentials. Restart the API after updating secrets.

The backend uses the Supabase SDK; separate AWS S3 credentials are unnecessary. Public URL behavior and private signed downloads follow the [Supabase upload](https://supabase.com/docs/reference/javascript/file-buckets-upload) and [signed URL](https://supabase.com/docs/reference/javascript/file-buckets-createsignedurl) APIs. These buckets intentionally deny direct client metadata/read/write operations, even if unrelated permissive policies exist. Public image URLs remain publicly readable. Private operations use the server credential after application authorization. Bucket visibility is checked before file operations.

## Upload API

`POST /v1/media`, bearer authentication required, accepts JSON:

```json
{
  "purpose": "image",
  "vendor_id": "vendor-uuid",
  "mime": "image/png",
  "data_base64": "base64-file-bytes"
}
```

Purposes are `logo`, `image` and `document`. Logos/images accept JPEG, PNG or WebP and return `public_url`. An administrator can upload branding without a vendor; associated vendor staff can upload assets for their own vendor. Customers cannot publish logos/images. Save the returned URL in existing vendor/menu/banner image fields; uploading alone does not change catalog records.

Private `document` uploads omit `vendor_id`, accept JPEG, PNG, WebP, PDF or DOCX and belong to the authenticated account. They return metadata with `public_url: null`. Full DOCX MIME: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.

`GET /v1/media/:id` returns metadata to the owner, associated vendor staff or admin. `POST /v1/media/:id/download` returns `{ "url": "...", "expires_in": 60 }` for private documents to the owner/admin. Download links are bearer capabilities until expiry: do not persist them as permanent document URLs or log/share them. Deactivation blocks generating new links but does not revoke already-issued links immediately.

Files have server-generated UUID paths and cannot overwrite existing objects. Maximum decoded size is 2 MiB; JSON body limit is 3 MiB. Base64 must be canonical, without a data-URL prefix. Image/PDF signatures are checked. DOCX packages require the Word main document/content type and bounded ZIP entries/expansion; encrypted archives, path traversal, macros, embedded objects and XML entity declarations are rejected. This is structural validation, not antivirus scanning or complete document/image rendering validation. SVG, DOC, DOCM and arbitrary ZIP files are unsupported. Uploads are rate limited. A retry can create a new asset; no upload idempotency contract is claimed.

## Rider document compatibility

Existing `/v1/riders/me/documents` now accepts DOCX alongside JPEG/PNG/PDF. Production new uploads use the private bucket and store a reference and SHA-256 digest in PostgreSQL. Metadata never exposes paths or credentials. Admin review/download access is audited, downloaded bytes are checked against their saved digest, and replacing documents returns the application to pending/offline. Active-job replacement remains blocked.

Existing AES-GCM database documents remain readable through the current admin content endpoint. Preserve `RIDER_DOCUMENT_SECRET` for these legacy documents. No automatic relocation or deletion of existing documents occurs. New uploads return 503 when Storage is unconfigured; they do not silently fall back to database blobs in the running API.

## Operations

PostgreSQL transactions cannot atomically commit object uploads. A successful upload followed by a database failure can leave an unreferenced object; a replacement retains the prior object. Before launch, establish retention/quota/scanning policy and periodically reconcile bucket objects against `media_assets.object_path` and `rider_documents.storage_path`. Delete only confirmed unreferenced objects after a grace period and a reviewed retention decision. Automated cleanup and client file-picker/upload screens remain pending.

Back up Storage objects separately from logical PostgreSQL dumps; preserve matching metadata and legacy encryption keys. Do not make the document bucket public. Staging tests should cover wrong vendor/user access, expired links, provider outages, bucket visibility and document replacement. Local tests use an isolated database and mocked Storage transport, not a live Supabase project.
