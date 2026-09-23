"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { r2Client, R2_BUCKET_NAME } from "@/lib/r2";
import { PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export async function generateUploadUrl(
  eventId: string,
  fileMetadata: { name: string; size: number; type: string }
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

  // 4. Create Photo record with PENDING status
  const photo = await prisma.photo.create({
    data: {
      eventId: event.id,
      fileName: fileMetadata.name,
      fileSize: fileMetadata.size,
      mimeType: fileMetadata.type,
      status: "PENDING",
    },
  });

  // 5. Generate R2 key structure
  const objectKey = `events/${event.id}/originals/${photo.id}`;

  // 6. Update Photo record with the key
  await prisma.photo.update({
    where: { id: photo.id },
    data: { originalKey: objectKey },
  });

  // 7. Generate presigned PUT URL
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: objectKey,
    ContentType: fileMetadata.type,
    ContentLength: fileMetadata.size,
  });

  // URL expires in 15 minutes
  const url = await getSignedUrl(r2Client, command, { expiresIn: 900 });

  return {
    url,
    photoId: photo.id,
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

  // 4. Mark as UPLOADED
  await prisma.photo.update({
    where: { id: photoId },
    data: { status: "UPLOADED" },
  });

  return { success: true };
}
