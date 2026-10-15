# Gallery — Current State

_Last updated: 2026-10-15_

## Product
White-label, ad-free photo gallery platform for Indian photographers.

## Current Version
V1

## Development Status
- Phase 1 — VERIFIED
- Phase 2 (Event Management + R2 + upload + processing) — STABILIZED & VERIFIED
- Photographer Gallery (read-only) — STABILIZED & VERIFIED
- Public Client Gallery (unauthenticated viewer + publish toggle + branding + expiry enforcement) — IMPLEMENTED & VERIFIED
- Overall V1 Status: IN PROGRESS (Individual downloads and sharing options remain per implementation_plan.md)

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
- Page-driven for V1: `ProcessingDriver.tsx` coordinates processing (`/api/photos/[id]/process`, max 2 concurrent), halts polling when idle, and wakes up via `photo-uploaded` events from `BulkUploader` or tab visibility changes. Single polling chain and unmount cancellation enforced. No cron/worker.

### Gallery rendering (photographer, read-only)
- `GalleryGrid.tsx`: READY photos only; `thumbKey` for tiles, `webKey` in the viewer; never `originalKey`; responsive grid (2 cols on mobile, up to 6 on desktop); empty state ("No ready photos"); queue status counts for pending/uploaded/processing/failed.
- Full screen Lightbox viewer includes:
  - Previous and Next navigation buttons
  - Keyboard arrow navigation (ArrowLeft / ArrowRight)
  - Close button and Escape key support
  - Image counter indicator (`X / Y`)
  - Pointer-events-none overlay to avoid obscuring tiles

### Public Client Gallery (unauthenticated client viewer)
- Public route: `src/app/gallery/[publicId]/page.tsx`
  - Validates 32-hex `publicId` format; invalid formats return 404 immediately.
  - Enforces `Event.status === "PUBLISHED"`; draft events return 404 (preventing discovery/enumeration).
  - Enforces `Event.expiryDate`; expired events return 404.
  - Photo query filters strictly for `READY` status (`where: { status: "READY" }`).
  - Private original isolation: `originalKey` is never queried or transmitted; tiles use `thumbKey` (480px WebP) and lightbox viewer uses `webKey` (2048px WebP) from the public CDN.
- Photographer publish workflow:
  - `togglePublishEvent` server action in `src/app/dashboard/events/[id]/actions.ts`: enforces active NextAuth session and event ownership verification before updating `Event.status` to `PUBLISHED` or `DRAFT`.
  - `PublishToggle.tsx` component in `src/app/dashboard/events/[id]/page.tsx`: provides one-click publishing/unpublishing, live shareable client URL display, and instant link copying.
- Client gallery component: `src/app/gallery/[publicId]/ClientGallery.tsx`
  - Studio branding: studio name, logo, and brand primary color accent.
  - Responsive thumbnail grid with lazy loading.
  - Fullscreen lightbox viewer with Next/Previous navigation, keyboard controls (`ArrowLeft`, `ArrowRight`, `Escape`), and image counter indicator.
  - Empty state when no ready photos exist.
  - Completely excludes all photographer admin controls, uploaders, and queue statuses.

## Verification Results (2026-10-15)
- TypeScript: `npx tsc --noEmit` passed with 0 errors.
- ESLint: `npm run lint` passed with 0 errors / 0 warnings.
- Production Build: `npm run build` compiled cleanly in 14.3s with dynamic server route `/gallery/[publicId]`.
- Automated Security & Functional Suite:
  - Invalid publicId format -> 404.
  - Non-existent publicId -> 404.
  - Unpublished (DRAFT) event -> 404.
  - Published event with unauthenticated client -> 200, verified studio branding, event title, client name, and photo grid.
  - Original key leakage check -> Passed (no originalKey or private bucket references in HTML).
  - Expired event access -> 404.
  - Immediate unpublishing revocation -> 404.
- Browser E2E Test: Full verification recorded (`public_gallery_test`). Verified studio brand header, event metadata, photo grid, lightbox opening with web-size image, navigation, and modal dismissal.

## Known Limitations
- Manually resetting READY → UPLOADED via external script and reprocessing double-counts `photoCount`/`storageBytes`. (Normal application code never does this).
- Counters only increase; no photo delete/decrement path in V1.
- Processing runs only while the event page is open in the photographer's browser.
- `FAILED` after 3 attempts has no UI retry; failed photos show only as a count, `processingError` is not surfaced.
- Duplicates are detected by file name + size.
- No pagination/virtualization; plain `<img>` tiles.
- `NEXT_PUBLIC_R2_PUBLIC_URL` is a `pub-*.r2.dev` dev domain rather than a custom domain.
- Individual original photo downloads not yet implemented (scheduled for downloads milestone).
- No client selections, favorites, comments, or bulk downloads (strictly excluded from V1).

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