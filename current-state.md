# Gallery — Current State

_Last updated: 2026-10-17_

## Product
White-label, ad-free photo gallery platform for Indian photographers.

## Current Version
V1

## Development Status
- Phase 1 — VERIFIED
- Phase 2 (Event Management + R2 + upload + processing) — STABILIZED & VERIFIED
- Photographer Gallery (read-only) — STABILIZED & VERIFIED
- Public Client Gallery (unauthenticated viewer + publish toggle + branding + expiry enforcement) — IMPLEMENTED & VERIFIED
- Optional Gallery Expiry (creation form input + server validation + database persistence) — IMPLEMENTED & VERIFIED
- Individual Original Downloads (short-lived presigned GET URLs from private bucket + access control + download UI) — IMPLEMENTED & VERIFIED
- Gallery Sharing and QR Codes (copy link + WhatsApp share + dynamic QR code generator + download PNG + draft/expiry protection + client share modal) — IMPLEMENTED & VERIFIED
- Overall V1 Status: CORE V1 COMPLETE (All core photographer and client gallery workflows implemented and verified)

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
- `createEvent` server action: auth, validation, random 32-hex `publicId`, retry on collision, optional `expiryDate` parsing and validation.
- Event details page is ownership-gated (404 for other users' events or non-existent events) and displays Event Details including Client Name, Event Date, Gallery Expiry status, and IDs.
- Event publishing and expiry: photographers can toggle between DRAFT and PUBLISHED; optional gallery expiry date can be set during creation or left blank for no expiration; expired galleries return 404.

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
  - Validates `publicId` format via `/^[a-zA-Z0-9_-]{8,64}$/` (accommodating 16-character, 32-character, and alphanumeric public identifiers while rejecting arbitrary/malformed inputs); invalid formats return 404 immediately.
  - Enforces `Event.status === "PUBLISHED"`; draft events return 404 (preventing discovery/enumeration).
  - Enforces `Event.expiryDate`; expired events return 404.
  - Photo query filters strictly for `READY` status (`where: { status: "READY" }`).
  - Private original isolation: `originalKey` is never queried or transmitted; tiles use `thumbKey` (480px WebP) and lightbox viewer uses `webKey` (2048px WebP) from the public CDN.
- Photographer publish workflow:
  - `togglePublishEvent` server action in `src/app/dashboard/events/[id]/actions.ts`: enforces active NextAuth session and event ownership verification before updating `Event.status` to `PUBLISHED` or `DRAFT`.
  - `PublishToggle.tsx` component in `src/app/dashboard/events/[id]/page.tsx`: provides one-click publishing/unpublishing, live shareable client URL display, and instant link copying.
- Client gallery component: `src/app/gallery/[publicId]/ClientGallery.tsx`
  - Studio branding: studio name, logo, and brand primary color accent.
  - Responsive thumbnail grid with lazy loading and hover download actions.
  - Fullscreen lightbox viewer with Next/Previous navigation, keyboard controls (`ArrowLeft`, `ArrowRight`, `Escape`), image counter indicator, and "Download Original" action.
  - Empty state when no ready photos exist.
  - Completely excludes all photographer admin controls, uploaders, and queue statuses.

### Individual Original-Photo Downloads
- Route Handler: `src/app/api/gallery/[publicId]/photos/[photoId]/download/route.ts`
- Core security logic: `src/lib/downloads.ts` (`generatePhotoDownloadUrl`)
- Strict server-side checks:
  1. Validates `publicId` format via `/^[a-zA-Z0-9_-]{8,64}$/`.
  2. Confirms event exists and is `PUBLISHED` (draft events return 404).
  3. Confirms event is not expired (expired events return 404).
  4. Confirms photo exists and strictly belongs to that event (cross-event tampering returns 404).
  5. Confirms photo status is `READY` (non-ready, pending, or failed photos return 404).
  6. Confirms `originalKey` presence in private `gallery-storage-dev` bucket.
- Signs a 5-minute (`expiresIn: 300`) presigned GET URL with `ResponseContentDisposition: attachment; filename="${encodeURIComponent(photo.fileName)}"`.
- Returns a `302 Found` redirect with `Cache-Control: no-store, max-age=0`.
- Client Gallery UI: Download button integrated into both grid tiles (hover) and fullscreen lightbox viewer controls (`#client-lightbox-download`).

### Gallery Sharing and QR Codes
- Photographer Event Dashboard: `src/app/dashboard/events/[id]/PublishToggle.tsx`
  - Copy Link: Prominent action with instant visual confirmation (`Copied!`) and read-only text input (`#public-gallery-url-input`) for desktop and mobile ergonomics.
  - WhatsApp Share: Prefills personalized client greeting (`https://wa.me/?text=...`) including client name, event name, and the working public gallery link.
  - Dynamic QR Code: Real-time QR generation (`qrcode` library, high-resolution PNG) encoding the exact public gallery URL.
  - Download QR Code: Direct PNG download button (`#download-qr-btn`) allowing photographers to save the QR code for print marketing, welcome signage, or reception table cards.
  - Draft & Expiry Protection: Clear warning banners `#unpublished-warning-banner` and `#expired-warning-banner`. Sharing controls are gated during DRAFT mode to prevent accidental client exposure to 404 links.
- Client Public Gallery Share Modal: `src/app/gallery/[publicId]/ClientGallery.tsx`
  - Header Share Button (`#client-share-button`): Opens an elegant sharing dialog.
  - Allows clients and guests to copy link, share via WhatsApp, or display the QR code for on-screen mobile scanning.

## Verification Results (2026-10-17 — Gallery Sharing and QR Codes)
- TypeScript: `npx tsc --noEmit` passed with 0 errors.
- ESLint: `npm run lint` passed with 0 errors / 0 warnings.
- Production Build: `npm run build` compiled cleanly in 1.8s (Next.js 16.3.5 Turbopack).
- Automated Sharing & QR Suite (`scratch/verify_sharing_qr.ts`):
  - Copy Link produces exact working public gallery URL (`http://localhost:3000/gallery/...`).
  - WhatsApp Share URL contains pre-filled message with exact public gallery URL.
  - QR Code PNG generated via `qrcode` and decoded via `jsQR` matches public gallery URL with 100% fidelity.
  - Unauthenticated/incognito request to published gallery returns `200 OK`.
  - Draft gallery returns `404 Not Found`.
  - Expired gallery returns `404 Not Found`.
- Browser E2E Test: Full verification recorded (`verify_sharing_qr_1792230777811.webp`). Verified photographer dashboard sharing controls, copy link feedback, WhatsApp link, QR code render and download, and client gallery share modal.

## Verification Results (2026-10-17 — Individual Downloads)
- TypeScript: `npx tsc --noEmit` passed with 0 errors.
- ESLint: `npm run lint` passed with 0 errors / 0 warnings.
- Production Build: `npm run build` compiled cleanly in 2.3s (Next.js 16.3.5 Turbopack); compiled dynamic route `ƒ /api/gallery/[publicId]/photos/[photoId]/download`.
- Automated Individual Download Suite:
  - Valid photo download: `302 Found` redirect to presigned GET URL -> fetched binary stream from R2 (HTTP `200 OK`, verified complete original byte payload and `attachment; filename` header).
  - Cross-event photo access tampering: `404 Not Found`.
  - Draft event photo download: `404 Not Found`.
  - Expired event photo download: `404 Not Found`.
  - Non-READY photo download: `404 Not Found`.
  - Invalid public ID / photo ID: `404 Not Found`.
  - Direct public CDN access to originalKey: `404 Not Found` (storage isolation maintained).
- Automated Expiry Tests:
  - Event creation with blank expiry -> stored as `null`, published gallery returns `200 OK`.
  - Event creation with future expiry -> stored as future timestamp (`2026-12-31T00:00:00.000Z`), published gallery returns `200 OK`.
  - Event creation with past expiry -> stored as past timestamp (`2026-10-10T00:00:00.000Z`), published gallery returns `404 Not Found`.
  - Server validation: blank/whitespace/null parses to `null`, valid date strings parse to Date, invalid date strings correctly throw `Invalid expiry date`.
- Browser E2E Test: Full verification recorded (`verify_client_download`). Verified lightbox download button rendering with valid download URL pointing to `/api/gallery/.../download`.

## Verification Results (2026-10-15)
- TypeScript: `npx tsc --noEmit` passed with 0 errors.
- ESLint: `npm run lint` passed with 0 errors / 0 warnings.
- Production Build: `npm run build` compiled cleanly in 14.3s with dynamic server route `/gallery/[publicId]`.
- Automated Security & Functional Suite:
  - Invalid publicId format (e.g. punctuation, short length) -> 404.
  - Non-existent publicId -> 404.
  - Unpublished (DRAFT) event -> 404.
  - Published 16-character publicId (`d1b5374d9beea244`) -> 200 OK.
  - Published 32-character publicId (`f02a9276c92c5e472e5ef498f693c342`) -> 200 OK.
  - Original key leakage check -> Passed (0 occurrences of `gallery-storage-dev` or `/originals/` in HTML).
  - Expired event access -> 404.
  - Immediate unpublishing revocation -> 404.
- Browser E2E Test: Full verification recorded (`verify_reported_url` and `public_gallery_test`). Verified studio brand header, event metadata, photo grid, lightbox opening with web-size image, navigation, and modal dismissal.

## Known Limitations
- Manually resetting READY → UPLOADED via external script and reprocessing double-counts `photoCount`/`storageBytes`. (Normal application code never does this).
- Counters only increase; no photo delete/decrement path in V1.
- Processing runs only while the event page is open in the photographer's browser.
- `FAILED` after 3 attempts has no UI retry; failed photos show only as a count, `processingError` is not surfaced.
- Duplicates are detected by file name + size.
- No pagination/virtualization; plain `<img>` tiles.
- `NEXT_PUBLIC_R2_PUBLIC_URL` is a `pub-*.r2.dev` dev domain rather than a custom domain.
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