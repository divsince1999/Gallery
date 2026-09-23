import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, User as UserIcon } from "lucide-react";
import SingleUploader from "./SingleUploader";

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
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
          Status: {event.status}
        </span>
      </div>

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
      
      {/* 
        This is a minimal implementation for Phase 2 Step 2.
        Future phases will add the bulk photo uploader and gallery link here. 
      */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
        <div className="flex">
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              R2 Upload Foundation is active. Use the form below to test a single direct-to-R2 upload.
            </p>
          </div>
        </div>
      </div>

      <SingleUploader eventId={event.id} />
    </div>
  );
}
