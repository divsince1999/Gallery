import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, User as UserIcon, Clock } from "lucide-react";
import BulkUploader from "./BulkUploader";
import ProcessingDriver from "./ProcessingDriver";
import GalleryGrid from "./GalleryGrid";
import PublishToggle from "./PublishToggle";

export default async function EventDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      photos: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          status: true,
          thumbKey: true,
          webKey: true,
          width: true,
          height: true,
          fileName: true,
        },
      },
    },
  });

  // Authorization check: Does the event exist and belong to the current user?
  if (!event || event.photographerId !== session.user.id) {
    notFound(); // Important: we return 404 to avoid leaking existence of other users' events
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Link href="/dashboard" className="mr-4 text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{event.name}</h1>
        </div>
      </div>

      <PublishToggle
        eventId={event.id}
        initialStatus={event.status as "DRAFT" | "PUBLISHED"}
        publicId={event.publicId}
        eventName={event.name}
        clientName={event.clientName}
        expiryDate={event.expiryDate ? event.expiryDate.toISOString() : null}
      />

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Event Details</h3>
        </div>
        <div className="px-6 py-5">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500 flex items-center">
                <UserIcon className="h-4 w-4 mr-2" /> Client Name
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{event.clientName}</dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500 flex items-center">
                <Calendar className="h-4 w-4 mr-2" /> Event Date
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{event.date.toLocaleDateString()}</dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500 flex items-center">
                <Clock className="h-4 w-4 mr-2" /> Gallery Expiry
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {event.expiryDate
                  ? `${event.expiryDate.toLocaleDateString()}${
                      new Date() > new Date(event.expiryDate) ? " (Expired)" : ""
                    }`
                  : "No expiration"}
              </dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">Internal ID</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">{event.id}</dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">Public ID</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">{event.publicId}</dd>
            </div>
          </dl>
        </div>
      </div>
      
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
        <div className="flex">
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              Bulk Photo Uploader is active.
            </p>
          </div>
        </div>
      </div>

      <ProcessingDriver eventId={event.id} />
      <BulkUploader eventId={event.id} />

      <div className="pt-8 border-t border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Photographer Gallery</h2>
        <GalleryGrid photos={event.photos} />
      </div>
    </div>
  );
}
