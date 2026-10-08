import { prisma } from "@/lib/db";
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_BUCKET_NAME } from "@/lib/r2";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

export async function processPhotoCore(photoId: string, photographerId: string) {
  // 1. Claim & Guard
  const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
  
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    include: { event: { select: { photographerId: true } } }
  });

  if (!photo || photo.event.photographerId !== photographerId) {
    throw new Error("Unauthorized or not found");
  }

  if (photo.processingAttempts >= 3) {
    if (photo.status !== "FAILED") {
       await prisma.photo.update({
         where: { id: photoId },
         data: { status: "FAILED", processingError: "Processing aborted repeatedly" }
       });
    }
    throw new Error("Processing aborted repeatedly");
  }

  if (
    photo.status === "READY" || 
    photo.status === "PENDING" || 
    (photo.status === "PROCESSING" && photo.updatedAt > fiveMinsAgo)
  ) {
    return { skipped: true, reason: `Status is ${photo.status}` };
  }

  // Atomically claim with optimistic locking
  const claimResult = await prisma.photo.updateMany({
    where: { 
      id: photoId,
      status: photo.status,
      updatedAt: photo.updatedAt
    },
    data: {
      status: "PROCESSING",
      processingAttempts: { increment: 1 },
      updatedAt: new Date(),
    }
  });

  if (claimResult.count === 0) {
    return { skipped: true, reason: "Lock contention" };
  }

  // Refetch to get the lock token (updatedAt)
  const claimedPhoto = await prisma.photo.findUniqueOrThrow({ where: { id: photoId }});
  const lockToken = claimedPhoto.updatedAt;

  let originalBytes = 0;
  let webBytes = 0;
  let thumbBytes = 0;
  let width = 0;
  let height = 0;

  try {
    // 2. Download from R2
    console.log(`[${photoId}] Downloading from R2...`);
    if (!claimedPhoto.originalKey) {
      throw new Error("Missing originalKey");
    }

    const getCommand = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: claimedPhoto.originalKey,
    });

    const getResponse = await r2Client.send(getCommand);
    if (!getResponse.Body) {
      throw new Error("Empty body from R2");
    }

    const imageBuffer = Buffer.from(await getResponse.Body.transformToByteArray());
    originalBytes = imageBuffer.length;
    console.log(`[${photoId}] Downloaded ${originalBytes} bytes.`);

    // 3. Process with sharp
    console.log(`[${photoId}] Processing with sharp...`);
    const sharpInstance = sharp(imageBuffer).rotate(); // Apply EXIF orientation
    const metadata = await sharpInstance.metadata();
    width = metadata.width || 0;
    height = metadata.height || 0;

    const webBuffer = await sharpInstance.clone()
      .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    webBytes = webBuffer.length;

    const thumbBuffer = await sharpInstance.clone()
      .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
    thumbBytes = thumbBuffer.length;

    // 4. Upload to public bucket
    const webKey = `events/${claimedPhoto.eventId}/web/${photoId}.webp`;
    const thumbKey = `events/${claimedPhoto.eventId}/thumbs/${photoId}.webp`;

    console.log(`[${photoId}] Uploading web derivative (${webBytes} bytes)...`);
    await r2Client.send(new PutObjectCommand({
      Bucket: R2_PUBLIC_BUCKET_NAME,
      Key: webKey,
      Body: webBuffer,
      ContentType: "image/webp",
    }));

    console.log(`[${photoId}] Uploading thumb derivative (${thumbBytes} bytes)...`);
    await r2Client.send(new PutObjectCommand({
      Bucket: R2_PUBLIC_BUCKET_NAME,
      Key: thumbKey,
      Body: thumbBuffer,
      ContentType: "image/webp",
    }));

    // 5. Finalize
    console.log(`[${photoId}] Finalizing in DB...`);
    await prisma.$transaction(async (tx) => {
      const finalizeResult = await tx.photo.updateMany({
        where: { id: photoId, status: "PROCESSING", updatedAt: lockToken },
        data: {
          status: "READY",
          webKey,
          thumbKey,
          width,
          height,
          originalSizeBytes: originalBytes,
          webSizeBytes: webBytes,
          thumbSizeBytes: thumbBytes,
          processingError: null,
        }
      });

      if (finalizeResult.count > 0) {
        // Safe to increment event accounting because it transitioned from PROCESSING -> READY
        // and we only claim photos that aren't READY yet.
        await tx.event.update({
          where: { id: claimedPhoto.eventId },
          data: {
            photoCount: { increment: 1 },
            storageBytes: { increment: originalBytes + webBytes + thumbBytes }
          }
        });
      }
    });

    return { success: true };

  } catch (error) {
    // 6. Error Handling
    console.error(`Processing error for ${photoId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown processing error";

    await prisma.photo.updateMany({
      where: { id: photoId, status: "PROCESSING", updatedAt: lockToken },
      data: {
        status: "FAILED",
        processingError: errorMessage,
      }
    });

    return { success: false, error: errorMessage };
  }
}
