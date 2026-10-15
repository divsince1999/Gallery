"use client";

import { useState, useCallback, useEffect } from "react";
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import { X, ChevronLeft, ChevronRight, Image as ImageIcon, Calendar, User } from "lucide-react";

export type ClientPhoto = {
  id: string;
  thumbKey: string | null;
  webKey: string | null;
  width: number | null;
  height: number | null;
  fileName: string;
};

export type ClientBrandKit = {
  studioName: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string | null;
} | null;

export type ClientEvent = {
  name: string;
  clientName: string;
  date: string;
};

interface ClientGalleryProps {
  event: ClientEvent;
  brandKit: ClientBrandKit;
  photos: ClientPhoto[];
}

export default function ClientGallery({
  event,
  brandKit,
  photos,
}: ClientGalleryProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<ClientPhoto | null>(null);

  const baseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";
  const studioName = brandKit?.studioName || "Studio Gallery";
  const primaryColor = brandKit?.primaryColor || "#1e293b";

  const selectedIndex = selectedPhoto
    ? photos.findIndex((p) => p.id === selectedPhoto.id)
    : -1;
  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex >= 0 && selectedIndex < photos.length - 1;

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      setSelectedPhoto(photos[selectedIndex - 1]);
    }
  }, [hasPrev, photos, selectedIndex]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      setSelectedPhoto(photos[selectedIndex + 1]);
    }
  }, [hasNext, photos, selectedIndex]);

  useEffect(() => {
    if (!selectedPhoto) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPhoto, handlePrev, handleNext]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-neutral-800">
      {/* Brand Accent Top Line */}
      <div
        className="h-1.5 w-full transition-colors"
        style={{ backgroundColor: primaryColor }}
      />

      {/* Branded Header */}
      <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            {brandKit?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brandKit.logoUrl}
                alt={studioName}
                className="h-10 w-auto object-contain max-w-[140px]"
              />
            ) : (
              <div
                className="h-9 w-9 rounded-lg flex items-center justify-center font-bold text-white text-sm shadow-inner"
                style={{ backgroundColor: primaryColor }}
              >
                {studioName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <span className="text-xs uppercase tracking-widest text-neutral-400 font-medium block">
                {studioName}
              </span>
              <h1 className="text-lg sm:text-xl font-semibold text-white tracking-tight">
                {event.name}
              </h1>
            </div>
          </div>

          {/* Event Metadata Badges */}
          <div className="flex items-center flex-wrap gap-2 sm:gap-3 text-xs text-neutral-400">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800">
              <User className="w-3.5 h-3.5 mr-1.5 text-neutral-400" />
              {event.clientName}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800">
              <Calendar className="w-3.5 h-3.5 mr-1.5 text-neutral-400" />
              {new Date(event.date).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 font-medium text-neutral-300">
              {photos.length} {photos.length === 1 ? "Photo" : "Photos"}
            </span>
          </div>
        </div>
      </header>

      {/* Main Gallery Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {photos.length === 0 ? (
          <div className="border border-dashed border-neutral-800 rounded-2xl p-16 text-center max-w-md mx-auto my-12 bg-neutral-900/30">
            <ImageIcon className="mx-auto h-12 w-12 text-neutral-600 mb-3" />
            <h3 className="text-base font-medium text-neutral-300">
              No photos available
            </h3>
            <p className="mt-1.5 text-sm text-neutral-500">
              This gallery has been published, but no ready photos are available to view yet.
            </p>
          </div>
        ) : (
          <div
            id="public-gallery-grid"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5"
          >
            {photos.map((photo, idx) => (
              <div
                key={photo.id}
                id={`public-photo-tile-${idx}`}
                onClick={() => setSelectedPhoto(photo)}
                className="group relative aspect-square bg-neutral-900 rounded-xl overflow-hidden cursor-pointer ring-1 ring-neutral-800/80 hover:ring-2 hover:ring-neutral-400 transition-all duration-200 transform-gpu hover:scale-[1.01]"
              >
                {photo.thumbKey ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${baseUrl}/${photo.thumbKey}`}
                    alt={photo.fileName}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-600">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                )}
                {/* Subtle Hover Veil */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none" />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Lightbox Viewer */}
      <Dialog
        open={!!selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
        className="relative z-50"
      >
        <DialogBackdrop className="fixed inset-0 bg-black/95 backdrop-blur-sm transition-opacity" />
        <div className="fixed inset-0 flex w-screen items-center justify-center p-2 sm:p-6">
          <DialogPanel className="relative flex max-w-7xl w-full h-full max-h-[92vh] flex-col bg-transparent items-center justify-center">
            {/* Close Button */}
            <button
              id="client-lightbox-close"
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-2 right-2 sm:top-4 sm:right-4 p-2 text-white/70 hover:text-white bg-black/60 hover:bg-black/90 rounded-full transition-colors z-30"
              aria-label="Close viewer"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Previous Button */}
            {hasPrev && (
              <button
                id="client-lightbox-prev"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrev();
                }}
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 text-white/70 hover:text-white bg-black/60 hover:bg-black/90 rounded-full transition-colors z-30"
                aria-label="Previous photo"
              >
                <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
              </button>
            )}

            {/* Next Button */}
            {hasNext && (
              <button
                id="client-lightbox-next"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 text-white/70 hover:text-white bg-black/60 hover:bg-black/90 rounded-full transition-colors z-30"
                aria-label="Next photo"
              >
                <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
              </button>
            )}

            {/* Photo Viewer */}
            {selectedPhoto && selectedPhoto.webKey && (
              <div className="relative w-full h-full flex items-center justify-center p-2 sm:p-6 select-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  id="client-lightbox-image"
                  src={`${baseUrl}/${selectedPhoto.webKey}`}
                  alt={selectedPhoto.fileName}
                  className="max-w-full max-h-full object-contain drop-shadow-2xl"
                />
              </div>
            )}

            {/* Image Counter */}
            {selectedIndex >= 0 && (
              <div
                id="client-lightbox-counter"
                className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 px-3.5 py-1.5 bg-black/70 backdrop-blur-md text-white/90 text-xs sm:text-sm font-medium rounded-full pointer-events-none border border-white/10"
              >
                {selectedIndex + 1} / {photos.length}
              </div>
            )}
          </DialogPanel>
        </div>
      </Dialog>

      {/* Clean Footer */}
      <footer className="border-t border-neutral-900 py-6 text-center text-xs text-neutral-500">
        <p>
          Photographs &copy; {new Date().getFullYear()} {studioName}. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
