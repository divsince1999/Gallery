import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ClientGallery from "./ClientGallery";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;

  if (!publicId || typeof publicId !== "string") {
    return { title: "Gallery Not Found" };
  }

  const event = await prisma.event.findUnique({
    where: { publicId },
    select: {
      name: true,
      status: true,
      expiryDate: true,
      photographer: {
        select: {
          brandKit: {
            select: {
              studioName: true,
            },
          },
        },
      },
    },
  });

  if (!event || event.status !== "PUBLISHED") {
    return { title: "Gallery Not Found" };
  }

  if (event.expiryDate && new Date() > new Date(event.expiryDate)) {
    return { title: "Gallery Expired" };
  }

  const studioName = event.photographer?.brandKit?.studioName;
  return {
    title: studioName ? `${event.name} | ${studioName}` : `${event.name} | Gallery`,
    description: `Private photo gallery for ${event.name}`,
  };
}

export default async function PublicGalleryPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;

  // Validate publicId format to reject arbitrary strings immediately
  if (!publicId || typeof publicId !== "string" || !/^[a-f0-9]{32}$/i.test(publicId)) {
    notFound();
  }

  const event = await prisma.event.findUnique({
    where: { publicId },
    include: {
      photographer: {
        include: {
          brandKit: true,
        },
      },
      photos: {
        where: { status: "READY" },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          thumbKey: true,
          webKey: true,
          width: true,
          height: true,
          fileName: true,
        },
      },
    },
  });

  // Guard 1: Non-existent event
  if (!event) {
    notFound();
  }

  // Guard 2: Unpublished event
  if (event.status !== "PUBLISHED") {
    notFound();
  }

  // Guard 3: Expired event
  if (event.expiryDate && new Date() > new Date(event.expiryDate)) {
    notFound();
  }

  const clientEvent = {
    name: event.name,
    clientName: event.clientName,
    date: event.date.toISOString(),
  };

  const clientBrandKit = event.photographer.brandKit
    ? {
        studioName: event.photographer.brandKit.studioName,
        logoUrl: event.photographer.brandKit.logoUrl,
        primaryColor: event.photographer.brandKit.primaryColor,
        accentColor: event.photographer.brandKit.accentColor,
      }
    : null;

  return (
    <ClientGallery
      event={clientEvent}
      brandKit={clientBrandKit}
      photos={event.photos}
    />
  );
}
