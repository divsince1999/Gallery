# Gallery — Current State

_Last updated: 2026-10-08_

## Product
White-label, ad-free photo gallery platform for Indian photographers.

## Current Version
V1

## Development Status
- Phase 1 — VERIFIED
- Phase 2 (Event Management + R2 + upload + processing) — IMPLEMENTED, verified by ad-hoc scripts against real R2/Postgres. Not committed yet (HEAD is still the Phase 2 foundation commit). No automated tests.
- Photographer Gallery (read-only) — IMPLEMENTED, browser viewer not re-tested after latest changes.

## Phase 1 Completed
- Next.js + TypeScript + Tailwind
- PostgreSQL + Prisma
- Auth.js credentials authentication
- bcryptjs password hashing
- Photographer signup/login/logout
- Protected dashboard
- Photographer profile
- Brand Kit
- Production build
- Lint/type checks
- Security audit
- Database persistence verification

## Phase 2 Completed

### Event Management
- `createEvent` server action: auth, validation, random 32-hex `publicId`, retry on collision.
- Event details page is ownership-gated (404 for other users' events).
- Not built: edit, delete, publish, expiry behaviour (`Event.status` is always DRAFT).

### Cloudflare R2
- Two buckets:
  - `gallery-storage-dev` (private) — originals under `events/{eventId}/originals/{photoId}`
  - `gallery-public` (public) — `events/{eventId}/web/{photoId}.webp` and `events/{eventId}/thumbs/{photoId}.webp`
- Env: `R2_BUCKET_NAME`, `R2_PUBLIC_BUCKET_NAME`, `NEXT_PUBLIC_R2_PUBLIC_URL`.
- Verified (2026-10-08): public web/thumb URLs return 200 `image/webp`; original URL returns 404.
- 22 photos whose derivatives had landed in the private bucket were repaired by `CopyObject` into `gallery-public` (sizes verified with `HeadObject`).

### Photo records
- `Photo` has status (`PENDING`, `UPLOADED`, `PROCESSING`, `READY`, `FAILED`), `originalKey/webKey/thumbKey`, `width/height`, `originalSizeBytes/webSizeBytes/thumbSizeBytes`, `processingAttempts`, `processingError`.
- Migration `20261004065359_add_processing_attempts` applied.

### Presigned uploads
- `generateUploadUrl`: auth + ownership, JPEG/PNG/WebP only (HEIC rejected), 50 MB max, race-safe Photo creation (advisory lock, array-based transaction), duplicate detection across all five statuses, 15-minute presigned PUT.
- `verifyUpload`: `HeadObject` existence check, strict `PENDING → UPLOADED`.

### Bulk uploader
- `BulkUploader.tsx`: dropzone, 4 concurrent uploads, XHR progress, retry of failed uploads, `beforeunload` guard, duplicate skipping.
- `SingleUploader.tsx` is no longer rendered (unused).

### Image processing
- `src/lib/processing.ts` (sharp): EXIF rotate, web 2048px q82 WebP, thumb 480px q75 WebP.
- Optimistic-lock claim, max 3 attempts, then stays `FAILED`.
- On READY: sets sizes/dimensions, clears `processingError`, increments `Event.photoCount` and `Event.storageBytes` (original + web + thumb).
- Page-driven for V1: `ProcessingDriver.tsx` polls `/api/events/[id]/processing-status` every 3s and calls `/api/photos/[id]/process` (max 2 concurrent). No cron/worker.

### Gallery rendering (photographer, read-only)
- `GalleryGrid.tsx`: READY photos only; `thumbKey` for tiles, `webKey` in the viewer; never `originalKey`; responsive grid; empty state; counts for pending/uploaded/processing/failed.

## Verified Data State (2026-10-08)
- All Photo rows are READY (event `5ce0c091…`: 28; two other test events: 7 each).
- `Event.photoCount` equals READY count for those events (28 / 7 / 7).

## Known Limitations
- Manually resetting READY → UPLOADED and reprocessing double-counts `photoCount`/`storageBytes`. Do not do this on real data (`test_public_access.ts` does it).
- Counters only increase; no photo delete/decrement path.
- Processing runs only while the event page is open.
- `FAILED` after 3 attempts has no UI retry; failed photos show only as a count, `processingError` is not surfaced.
- `verifyUpload` does not check object size or content type.
- Duplicates are detected by file name + size only.
- Hover overlay in `GalleryGrid.tsx` tiles may obscure images (reported; unconfirmed fixed).
- No pagination/virtualization; plain `<img>` tiles.
- `NEXT_PUBLIC_R2_PUBLIC_URL` may still be a `pub-*.r2.dev` dev domain rather than a custom domain.
- No automated tests; lint was failing earlier because of stray root-level `.cjs` scripts; build/tsc not re-run since latest changes.
- Untracked scratch scripts, fixtures and `screenshot.png` at repo root should be cleaned up before commit.

## Current Next Step
Stabilise and commit Phase 2 / Gallery V1: clean up scratch files, run tsc + lint + build, confirm viewer in browser, then move on per `implementation/_plan.md`.

## Important Constraints
Do not implement yet:
- client/public gallery
- favourites, comments, selection
- QR
- WhatsApp sharing
- payments
- AI
- video
- affiliates

Those come later according to implementation/_plan.md.

## Architectural Rules
- `Event.id` = internal UUID
- `Event.publicId` = public gallery identifier
- R2 keys use internal UUIDs
- Originals remain private
- Web/thumb assets are public CDN assets in V1 (separate public bucket)
- Every server operation validates authentication + resource ownership
- V1 retry means restart failed uploads, not byte-level resumable uploads
- Processing failures are separate from client upload failures; `Photo.status = FAILED` means processing failed and is retried via the processing driver, not re-uploaded
- Photo records are the source of truth for individual upload state