# Gallery — Current State

_Last updated: 2026-10-12_

## Product
White-label, ad-free photo gallery platform for Indian photographers.

## Current Version
V1

## Development Status
- Phase 1 — VERIFIED
- Phase 2 (Event Management + R2 + upload + processing) — STABILIZED & VERIFIED
- Photographer Gallery (read-only) — STABILIZED & VERIFIED (Lightbox with Next/Prev navigation, keyboard controls, responsive grid, R2 public CDN delivery)
- Overall V1 Status: IN PROGRESS — Not yet production-ready (Public/client gallery, individual downloads, expiry enforcement, and sharing remain to be implemented per implementation_plan.md)

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
- Event details page is ownership-gated (404 for other users' events or non-existent events).
- Not built: edit, delete, publish, expiry behaviour (`Event.status` is always DRAFT).

### Cloudflare R2
- Two buckets:
  - `gallery-storage-dev` (private) — originals under `events/{eventId}/originals/{photoId}`
  - `gallery-public` (public) — `events/{eventId}/web/{photoId}.webp` and `events/{eventId}/thumbs/{photoId}.webp`
- Env: `R2_BUCKET_NAME`, `R2_PUBLIC_BUCKET_NAME`, `NEXT_PUBLIC_R2_PUBLIC_URL`.
- Verified: public web/thumb URLs return 200 `image/webp`; original URL returns 404 from public CDN.

### Photo records
- `Photo` has status (`PENDING`, `UPLOADED`, `PROCESSING`, `READY`, `FAILED`), `originalKey/webKey/thumbKey`, `width/height`, `originalSizeBytes/webSizeBytes/thumbSizeBytes`, `processingAttempts`, `processingError`.
- Migration `20261004065359_add_processing_attempts` applied.

### Presigned uploads
- `generateUploadUrl`: auth + ownership, JPEG/PNG/WebP only (HEIC rejected), 50 MB max, race-safe Photo creation (advisory lock, array-based transaction), duplicate detection across all five statuses, 15-minute presigned PUT.
- `verifyUpload`: `HeadObject` existence check, strict `PENDING → UPLOADED`.

### Bulk uploader
- `BulkUploader.tsx`: dropzone, 4 concurrent uploads, XHR progress, retry of failed uploads, `beforeunload` guard, duplicate skipping.
- `SingleUploader.tsx` is no longer rendered (unused foundation component).

### Image processing
- `src/lib/processing.ts` (sharp): EXIF rotate, web 2048px q82 WebP, thumb 480px q75 WebP.
- Optimistic-lock claim, max 3 attempts, then stays `FAILED`.
- On READY: sets sizes/dimensions, clears `processingError`, increments `Event.photoCount` and `Event.storageBytes` (original + web + thumb).
- Page-driven for V1: `ProcessingDriver.tsx` polls `/api/events/[id]/processing-status` every 3s and calls `/api/photos/[id]/process` (max 2 concurrent). No cron/worker.

### Gallery rendering (photographer, read-only)
- `GalleryGrid.tsx`: READY photos only; `thumbKey` for tiles, `webKey` in the viewer; never `originalKey`; responsive grid (2 cols on mobile, up to 6 on desktop); empty state ("No ready photos"); queue status counts for pending/uploaded/processing/failed.
- Full screen Lightbox viewer includes:
  - Previous and Next navigation buttons
  - Keyboard arrow navigation (ArrowLeft / ArrowRight)
  - Close button and Escape key support
  - Image counter indicator (`X / Y`)
  - Pointer-events-none overlay to avoid obscuring tiles

## Verification Results (2026-10-12)
- TypeScript: `npx tsc --noEmit` passed with 0 errors.
- ESLint: `npm run lint` passed with 0 errors / 0 warnings.
- Production Build: `npm run build` compiled cleanly in 11.0s (Next.js 16.3.5 Turbopack).
- Browser E2E Test: Full verification recorded (`e2e_gallery_verification_1791816060100.webp`).
- Ownership Checks: Verified 404 returned when accessing another user's event.
- Storage Isolation: Verified public domain returns 200 for web/thumb derivatives and 404 for originals.

## Known Limitations
- Manually resetting READY → UPLOADED via external script and reprocessing double-counts `photoCount`/`storageBytes`. (Normal application code never does this).
- Counters only increase; no photo delete/decrement path in V1.
- Processing runs only while the event page is open in the photographer's browser.
- `FAILED` after 3 attempts has no UI retry; failed photos show only as a count, `processingError` is not surfaced.
- Duplicates are detected by file name + size.
- No pagination/virtualization; plain `<img>` tiles.
- `NEXT_PUBLIC_R2_PUBLIC_URL` is a `pub-*.r2.dev` dev domain rather than a custom domain.

## Architectural Rules
- `Event.id` = internal UUID
- `Event.publicId` = public gallery identifier
- R2 keys use internal UUIDs
- Originals remain private in `gallery-storage-dev`
- Web/thumb assets are public CDN assets in `gallery-public`
- Every server operation validates authentication + resource ownership
- V1 retry means restart failed uploads, not byte-level resumable uploads
- Processing failures are separate from client upload failures; `Photo.status = FAILED` means processing failed and is retried via the processing driver, not re-uploaded
- Photo records are the source of truth for individual upload state