# Photo Gallery Platform (V1) - Implementation Plan

This document outlines the finalized, strict-scope technical implementation plan for Version 1 of the photo gallery platform.

## Proposed Changes / Scope

### 1. Foundation & ORM
* **Framework:** Next.js (React, App Router)
* **Language:** TypeScript
* **Styling:** Tailwind CSS
* **Database:** PostgreSQL
* **ORM:** Prisma
* **Storage:** Cloudflare R2

### 2. Authentication (Auth.js)
* **Mechanism:** Single canonical authentication system using **NextAuth.js (Auth.js)** with JWT sessions.
* **Signup/Login:** Photographers register and log in via email and password.
* **Password Hashing:** Passwords will be hashed using `bcryptjs` before being stored in `passwordHash`. Verification compares the input against the hash during the NextAuth `authorize` callback.
* **Protected Routes:** Dashboard routes require an active NextAuth session.
* **Ownership Checks:** Every server-side operation involving an event (mutations, fetching data, generating presigned URLs) must verify the session: `authenticated photographer -> owns event -> allowed operation`.

### 3. Events & Identifiers
* **Identifiers (Kept strictly separate):** 
  * `id`: Internal UUID for database relations and storage paths.
  * `publicId`: A cryptographically random string (e.g., `7kF92mQa`) used *exclusively* for public gallery URLs to prevent ID guessing.
* **Expiry:** Handled strictly via server-side checks. Every request to load a public gallery will verify if `currentTime > expiryDate`. If expired, access is denied. 
* **State:** We derive the event's overall upload/processing status directly from its `Photo` records. No separate `uploadStatus` field on the `Event` to avoid inconsistent duplicated state.
* **Tracking:** Events track `photoCount` and `storageBytes` (sum of original, web, and thumb sizes). No generic analytics/views tracking in V1.

### 4. Storage Architecture (Cloudflare R2)
* **Structure:** A single R2 bucket utilizing internal database UUIDs for object keys.
  ```text
  events/{eventUUID}/photos/{photoUUID}/original.ext
  events/{eventUUID}/photos/{photoUUID}/web.webp
  events/{eventUUID}/photos/{photoUUID}/thumb.webp
  brands/{photographerUUID}/logo.ext
  ```
* **Access Control:** 
  * V1 intentionally has **no gallery password protection**. Galleries are shareable via the unique `publicId` URL.
  * **Web/Thumb/Logo:** Delivered via a public Cloudflare custom domain/CDN. *Important:* Obscure filenames, UUIDs, or `publicId` values are NOT an authorization mechanism; public Web/Thumb access is intentional.
  * **Originals:** Completely private. Downloads require the server to verify the event/photo relationship and generate a temporary presigned GET URL. The server will not allow a user to request an arbitrary R2 object key.

### 5. Upload Architecture & Consistency
* **Flow:** Browser requests presigned PUT URLs from the Next.js backend (which enforces ownership checks). The browser then uploads directly to Cloudflare R2.
* **Queue & Limits:** Client-side queue with 3–5 concurrent uploads and progress tracking.
* **Retry vs. Resumable:** V1 supports **retry/restart of failed files**, not byte-level multipart resumable uploads. (If an 8MB upload fails at 6MB, the next attempt restarts the file from 0).
* **Duplicate Detection:** Basic frontend warning if a file with the same `fileName` + `fileSize` is queued.

### 6. Image Processing
* **Implementation:** Client-side processing (Original -> Web -> Thumbnail) will be the initial V1 implementation.
* **Boundary:** The processing code will be kept behind a clean abstraction/interface so it can later be replaced by server-side/background processing without changing the database schema or gallery architecture.
* **Photo Lifecycle States:**
  * `PENDING`: Record created, upload not yet started.
  * `UPLOADING`: Actively transmitting to R2.
  * `UPLOADED`: Original file successfully reached R2.
  * `PROCESSING`: Generating web/thumb versions.
  * `READY`: Original, web, and thumbnail versions are successfully stored in R2 and their keys are saved in the database. The photo is fully usable by the gallery.
  * `FAILED`: Upload or processing encountered an error. The `processingError` field stores useful error context.

### 7. Gallery & Downloads
* **Gallery:** Mobile-first, responsive masonry grid, lazy loading thumbnails, and a full-screen lightbox for web-sized images.
* **Downloads:** **Individual photo downloads only.** "Download All", ZIP generation, client-side ZIP, and bulk downloads are strictly excluded from V1.

### 8. Sharing
* Copy link, WhatsApp sharing intent, and dynamically generated QR codes.

---

## Final V1 Scope Definition

The V1 flow is strictly limited to:
`Photographer signup/login → profile + brand kit → create event → bulk photo upload → image processing → branded gallery → individual photo download → copy link / WhatsApp / QR`

**Explicitly EXCLUDED from V1:**
* Client selection / favorites / comments / approval
* Private client portal
* AI / face search / selfie search / video
* Payments / subscriptions / affiliates
* CRM / advanced analytics
* Download All / bulk downloads
* Gallery password protection

---

## Prisma Database Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Photographer {
  id            String     @id @default(uuid())
  email         String     @unique
  passwordHash  String
  name          String?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  
  brandKit      BrandKit?
  events        Event[]
}

model BrandKit {
  id             String       @id @default(uuid())
  photographerId String       @unique
  studioName     String
  logoUrl        String?
  primaryColor   String       @default("#000000")
  accentColor    String?
  
  photographer   Photographer @relation(fields: [photographerId], references: [id])
}

model Event {
  id            String       @id @default(uuid()) // Internal UUID
  publicId      String       @unique // Cryptographically random for public URLs
  photographerId String
  name          String
  clientName    String
  date          DateTime
  status        String       @default("DRAFT") // DRAFT, PUBLISHED
  expiryDate    DateTime?
  
  // Storage Accounting
  photoCount    Int          @default(0)
  storageBytes  BigInt       @default(0)
  
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  photographer  Photographer @relation(fields: [photographerId], references: [id])
  photos        Photo[]

  @@index([photographerId])
}

model Photo {
  id                String   @id @default(uuid()) // Internal UUID
  eventId           String
  originalKey       String?  // R2 key based on UUIDs
  webKey            String?  
  thumbKey          String?  
  status            String   @default("PENDING") // PENDING, UPLOADING, UPLOADED, PROCESSING, READY, FAILED
  processingError   String?  // Error context for FAILED state
  fileName          String   
  fileSize          BigInt   
  mimeType          String
  width             Int?
  height            Int?
  
  // Storage Accounting (Granular)
  originalSizeBytes BigInt?
  webSizeBytes      BigInt?
  thumbSizeBytes    BigInt?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  event             Event    @relation(fields: [eventId], references: [id])

  @@index([eventId])
}
```

---

## Phased Implementation Order

### Phase 1 — Foundation & Auth
* Next.js, TypeScript, Tailwind, Prisma, PostgreSQL setup.
* Auth.js (NextAuth) implementation with JWT, `bcryptjs` hashing.
* Photographer profile and Brand kit.

### Phase 2 — Event Management
* Event creation, edit, publish/unpublish, and deletion.
* Secure `publicId` generation and server-side expiry logic.
* Server-side ownership/security checks (auth -> ownership -> operation).
* Foundational storage/photo-count tracking logic.

### Phase 3 — R2 & Upload Engine
* Cloudflare R2 bucket setup utilizing `eventUUID`/`photoUUID` structure.
* API for presigned PUT URLs with event/photo relationship validation.
* Direct browser uploads with queue, 3-5 concurrency control, progress, and basic duplicate detection.
* Upload restart/retry mechanism for failed files.

### Phase 4 — Image Processing
* Client-side original/web/thumbnail generation (abstracted behind an interface).
* Strict processing states (`PENDING` through `READY` and `FAILED` with `processingError`).
* Failure handling and storage accounting.

### Phase 5 — Gallery
* Responsive mobile-first gallery with thumbnails and lazy loading.
* Lightbox utilizing web-sized images.
* Individual original downloads (Server verifies event/photo relationship to generate presigned GET URLs).

### Phase 6 — Sharing & Final Polish
* Copy link, WhatsApp, QR code.
* Responsive testing and upload reliability testing (1,000–2,000 images).
* Comprehensive security review.
