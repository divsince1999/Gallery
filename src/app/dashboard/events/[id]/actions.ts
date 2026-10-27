"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { r2Client, R2_BUCKET_NAME } from "@/lib/r2";
import { PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { revalidatePath } from "next/cache";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function generateUploadUrl(
  eventId: string,
  fileMetadata: { name: string; size: number; type: string },
  retryPhotoId?: string
) {
  // 1. Authenticate the session
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthenticated");
  }

  // 2. Metadata Validation
  if (!fileMetadata.name || !fileMetadata.size || !fileMetadata.type) {
    throw new Error("Missing required file metadata");
  }
  if (fileMetadata.name.length > 255) {
    throw new Error("Filename too long");
  }
  if (fileMetadata.size > MAX_FILE_SIZE) {
    throw new Error("File size exceeds 50MB limit");
  }
  if (!ALLOWED_MIME_TYPES.includes(fileMetadata.type)) {
    throw new Error("Unsupported file type");
  }

  // 3. Retrieve Event and Verify Ownership
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { photographerId: true, id: true },
  });

  if (!event) {
    throw new Error("Event not found");
  }

  if (event.photographerId !== session.user.id) {
    throw new Error("Unauthorized to upload to this event");
  }

  // 4 & 5. Race-safe find/create with Advisory Lock
  let photo;

  if (retryPhotoId) {
    photo = await prisma.photo.findUnique({ where: { id: retryPhotoId } });
    if (!photo || photo.eventId !== event.id) {
      throw new Error("Invalid photo record for retry");
    }
  } else {
    // Generate a unique lock key based on event + file signature
    const lockKey = `upload:${event.id}:${fileMetadata.name}:${fileMetadata.size}`;

    // Array-based batch transaction: no 5-second JS-DB timeout roundtrip.
    const [, , existingRecords] = await prisma.$transaction([
      prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`,
      prisma.$executeRaw`
        INSERT INTO "Photo" ("id", "eventId", "fileName", "fileSize", "mimeType", "status", "createdAt", "updatedAt")
        SELECT gen_random_uuid(), ${event.id}, ${fileMetadata.name}, ${fileMetadata.size}, ${fileMetadata.type}, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        WHERE NOT EXISTS (
          SELECT 1 FROM "Photo" 
          WHERE "eventId" = ${event.id}
            AND "fileName" = ${fileMetadata.name}
            AND "fileSize" = ${fileMetadata.size}
            AND "status" IN ('PENDING', 'UPLOADED', 'PROCESSING', 'READY', 'FAILED')
        )
      `,
      prisma.photo.findMany({
        where: {
          eventId: event.id,
          fileName: fileMetadata.name,
          fileSize: fileMetadata.size,
          status: { in: ["PENDING", "UPLOADED", "PROCESSING", "READY", "FAILED"] },
        },
      }),
    ]);

    // Explicitly prioritize progressed statuses over PENDING
    const progressed = existingRecords.find((r) => r.status !== "PENDING");
    if (progressed) {
      return { duplicate: true };
    }

    const pending = existingRecords.find((r) => r.status === "PENDING");
    if (!pending) {
      throw new Error("Failed to create or retrieve photo record");
    }
    
    photo = pending;
  }

  // 6. Generate R2 key structure
  const objectKey = `events/${event.id}/originals/${photo.id}`;

  // 7. Update Photo record with the key
  await prisma.photo.update({
    where: { id: photo.id },
    data: { originalKey: objectKey },
  });

  // 8. Generate presigned PUT URL
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: objectKey,
    ContentType: fileMetadata.type,
  });

  // URL expires in 15 minutes
  const url = await getSignedUrl(r2Client, command, { expiresIn: 900 });

  return {
    url,
    photoId: photo.id,
    duplicate: false,
  };
}

export async function verifyUpload(photoId: string) {
  // 1. Authenticate the session
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthenticated");
  }

  // 2. Retrieve Photo and corresponding Event to verify ownership
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    include: {
      event: {
        select: { photographerId: true },
      },
    },
  });

  if (!photo || !photo.originalKey) {
    throw new Error("Photo not found");
  }

  if (photo.event.photographerId !== session.user.id) {
    throw new Error("Unauthorized");
  }

  // 3. Verify object actually exists in R2
  try {
    const command = new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: photo.originalKey,
    });
    await r2Client.send(command);
  } catch {
    // Note: We intentionally leave it PENDING if not found or error, as requested.
    throw new Error("File not found in R2 or upload incomplete");
  }

  // 4. Mark as UPLOADED if it was PENDING
  const result = await prisma.photo.updateMany({
    where: { id: photoId, status: "PENDING" },
    data: { status: "UPLOADED" },
  });

  if (result.count === 0) {
    // If count is 0, the photo was already UPLOADED or further along, or didn't exist.
    // It's safe to return success since it's not PENDING anymore.
  }

  return { success: true };
}

export async function togglePublishEvent(
  eventId: string,
  newStatus: "DRAFT" | "PUBLISHED"
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthenticated");
  }

  if (newStatus !== "DRAFT" && newStatus !== "PUBLISHED") {
    throw new Error("Invalid status");
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { photographerId: true, publicId: true },
  });

  if (!event) {
    throw new Error("Event not found");
  }

  if (event.photographerId !== session.user.id) {
    throw new Error("Unauthorized");
  }

  const updatedEvent = await prisma.event.update({
    where: { id: eventId },
    data: { status: newStatus },
  });

  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath(`/gallery/${event.publicId}`);

  return { success: true, status: updatedEvent.status };
}

export interface DiagnosticResult {
  success: boolean;
  bucket: string;
  stage?: "upload" | "cleanup";
  errorCode?: string;
  httpStatus?: number;
}

export async function runR2Diagnostic(eventId: string): Promise<DiagnosticResult> {
  // 1. Authenticate the session
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthenticated");
  }

  // 2. Verify event ownership (matches repository authorization pattern)
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { photographerId: true },
  });

  if (!event) {
    throw new Error("Event not found");
  }

  if (event.photographerId !== session.user.id) {
    throw new Error("Unauthorized");
  }

  const testKey = `_diagnostic_probe_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.txt`;

  // 3. Attempt harmless upload using production r2Client and R2_BUCKET_NAME
  try {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: testKey,
        Body: "diagnostic-probe",
        ContentType: "text/plain",
      })
    );
  } catch (err: unknown) {
    const error = err as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
    return {
      success: false,
      bucket: R2_BUCKET_NAME,
      stage: "upload",
      errorCode: error.name || error.Code || "UnknownError",
      httpStatus: error.$metadata?.httpStatusCode,
    };
  }

  // 4. Clean up probe object immediately if upload succeeded
  try {
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: testKey,
      })
    );
  } catch (err: unknown) {
    const error = err as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
    return {
      success: false,
      bucket: R2_BUCKET_NAME,
      stage: "cleanup",
      errorCode: error.name || error.Code || "UnknownError",
      httpStatus: error.$metadata?.httpStatusCode,
    };
  }

  return {
    success: true,
    bucket: R2_BUCKET_NAME,
  };
}

