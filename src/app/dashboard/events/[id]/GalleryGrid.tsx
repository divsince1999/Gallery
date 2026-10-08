"use client";

import { useState } from "react";
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import { X, AlertCircle, Clock, Loader2, Image as ImageIcon } from "lucide-react";

type GalleryPhoto = {
  id: string;
  status: string;
  thumbKey: string | null;
  webKey: string | null;
  width: number | null;
  height: number | null;
  fileName: string;
};

export default function GalleryGrid({ photos }: { photos: GalleryPhoto[] }) {
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);

  const readyPhotos = photos.filter((p) => p.status === "READY");
  
  // Aggregate stats for non-ready photos
  const uploadedCount = photos.filter((p) => p.status === "UPLOADED").length;
  const processingCount = photos.filter((p) => p.status === "PROCESSING").length;
  const failedCount = photos.filter((p) => p.status === "FAILED").length;
  const pendingCount = photos.filter((p) => p.status === "PENDING").length;

  const hasNonReady = uploadedCount > 0 || processingCount > 0 || failedCount > 0 || pendingCount > 0;
  const baseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";

  return (
    <div className="space-y-6">
      {/* Status Summary for Non-Ready Photos */}
      {hasNonReady && (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-wrap gap-4">
          <div className="flex items-center text-sm text-gray-700">
            <span className="font-semibold mr-2">Queue Status:</span>
          </div>
          {pendingCount > 0 && (
             <div className="flex items-center text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
               <Clock className="w-4 h-4 mr-1.5" />
               {pendingCount} Pending
             </div>
          )}
          {uploadedCount > 0 && (
             <div className="flex items-center text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
               <Clock className="w-4 h-4 mr-1.5" />
               {uploadedCount} Uploaded
             </div>
          )}
          {processingCount > 0 && (
            <div className="flex items-center text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              {processingCount} Processing
            </div>
          )}
          {failedCount > 0 && (
            <div className="flex items-center text-sm text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-100">
              <AlertCircle className="w-4 h-4 mr-1.5" />
              {failedCount} Failed
            </div>
          )}
        </div>
      )}

      {/* Main Gallery Grid */}
      {readyPhotos.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">No ready photos</h3>
          <p className="mt-1 text-sm text-gray-500">
            {photos.length > 0 
              ? "Photos are currently processing and will appear here when ready."
              : "Upload photos to this event to see them in the gallery."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {readyPhotos.map((photo) => (
            <div
              key={photo.id}
              className="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
              onClick={() => setSelectedPhoto(photo)}
            >
              {photo.thumbKey ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`${baseUrl}/${photo.thumbKey}`}
                  alt={photo.fileName}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <ImageIcon className="w-8 h-8" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            </div>
          ))}
        </div>
      )}

      {/* Full Screen Photo Viewer Modal */}
      <Dialog open={!!selectedPhoto} onClose={() => setSelectedPhoto(null)} className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/90 transition-opacity" />
        <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
          <DialogPanel className="relative flex max-w-7xl w-full h-full max-h-[90vh] flex-col bg-transparent">
             <button
                onClick={() => setSelectedPhoto(null)}
                className="absolute -top-4 -right-4 sm:top-0 sm:right-0 p-2 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full transition-colors z-10"
                aria-label="Close viewer"
              >
                <X className="w-6 h-6" />
              </button>
            {selectedPhoto && selectedPhoto.webKey && (
              <div className="relative w-full h-full flex items-center justify-center p-4 sm:p-8">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${baseUrl}/${selectedPhoto.webKey}`}
                  alt={selectedPhoto.fileName}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            )}
          </DialogPanel>
        </div>
      </Dialog>
    </div>
  );
}
