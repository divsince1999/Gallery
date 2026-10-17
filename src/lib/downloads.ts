import { prisma } from "@/lib/db";
import { r2Client, R2_BUCKET_NAME } from "@/lib/r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const PUBLIC_ID_REGEX = /^[a-zA-Z0-9_-]{8,64}$/;

export interface DownloadResult {
  downloadUrl: string;
  fileName: string;
}

/**
 * Validates public event access, photo readiness, and generates a 5-minute
 * presigned GET URL for the original file in the private R2 bucket.
 * 
 * Returns null if any security check fails (event not found, draft, expired,
 * photo not found, photo belongs to another event, photo not READY, or missing originalKey).
 */
export async function generatePhotoDownloadUrl(
  publicId: string,
  photoId: string
): Promise<DownloadResult | null> {
  // 1. Format validation
  if (!publicId || typeof publicId !== "string" || !PUBLIC_ID_REGEX.test(publicId)) {
    return null;
  }
  if (!photoId || typeof photoId !== "string") {
    return null;
  }

  // 2. Query Event and enforce published + unexpired status
  const event = await prisma.event.findUnique({
    where: { publicId },
    select: {
      id: true,
      status: true,
      expiryDate: true,
    },
  });

  if (!event || event.status !== "PUBLISHED") {
    return null;
  }

  if (event.expiryDate && new Date() > new Date(event.expiryDate)) {
    return null;
  }

  // 3. Query Photo and enforce event ownership + READY status
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: {
      id: true,
      eventId: true,
      status: true,
      originalKey: true,
      fileName: true,
    },
  });

  if (
    !photo ||
    photo.eventId !== event.id ||
    photo.status !== "READY" ||
    !photo.originalKey
  ) {
    return null;
  }

  // 4. Generate 5-minute presigned GET URL with Content-Disposition attachment
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: photo.originalKey,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(photo.fileName)}"`,
  });

  const downloadUrl = await getSignedUrl(r2Client, command, { expiresIn: 300 });

  return {
    downloadUrl,
    fileName: photo.fileName,
  };
}
