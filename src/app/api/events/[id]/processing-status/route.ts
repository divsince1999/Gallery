import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: eventId } = await params;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { photographerId: true },
    });

    if (!event || event.photographerId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Find photos that need processing
    const photos = await prisma.photo.findMany({
      where: {
        eventId,
        OR: [
          { status: "UPLOADED" },
          { status: "PROCESSING", updatedAt: { lt: fiveMinsAgo } },
          { status: "FAILED", processingAttempts: { lt: 3 } },
        ]
      },
      select: { id: true, status: true, fileName: true, processingAttempts: true },
    });

    const pendingCount = await prisma.photo.count({
      where: { eventId, status: "PENDING" }
    });

    const processingCount = await prisma.photo.count({
      where: { eventId, status: "PROCESSING", updatedAt: { gte: fiveMinsAgo } }
    });
    
    const readyCount = await prisma.photo.count({
      where: { eventId, status: "READY" }
    });
    
    const failedCount = await prisma.photo.count({
      where: { eventId, status: "FAILED" }
    });

    return NextResponse.json({ 
      photosToProcess: photos,
      stats: { pendingCount, processingCount, readyCount, failedCount }
    }, { status: 200 });

  } catch (error) {
    console.error("Processing status API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
