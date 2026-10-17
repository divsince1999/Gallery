"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import {
  Globe,
  EyeOff,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  MessageCircle,
  Download,
  QrCode,
  AlertTriangle,
} from "lucide-react";
import QRCode from "qrcode";
import { togglePublishEvent } from "./actions";

interface PublishToggleProps {
  eventId: string;
  initialStatus: "DRAFT" | "PUBLISHED";
  publicId: string;
  eventName: string;
  clientName?: string;
  expiryDate?: string | null;
}

const emptySubscribe = () => () => {};

export default function PublishToggle({
  eventId,
  initialStatus,
  publicId,
  eventName,
  clientName,
  expiryDate,
}: PublishToggleProps) {
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">(initialStatus);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const origin = useSyncExternalStore(
    emptySubscribe,
    () => window.location.origin,
    () => ""
  );

  const isPublished = status === "PUBLISHED";
  const isExpired = Boolean(expiryDate && new Date() > new Date(expiryDate));

  const publicUrl = origin
    ? `${origin}/gallery/${publicId}`
    : `/gallery/${publicId}`;

  // Generate high-resolution QR code encoding public gallery URL
  useEffect(() => {
    if (!publicUrl) return;
    let active = true;
    QRCode.toDataURL(publicUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: "#111827",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch((err) => console.error("Error generating QR code:", err));

    return () => {
      active = false;
    };
  }, [publicUrl]);

  const handleToggle = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    const targetStatus = isPublished ? "DRAFT" : "PUBLISHED";

    try {
      const res = await togglePublishEvent(eventId, targetStatus);
      if (res.status === "DRAFT" || res.status === "PUBLISHED") {
        setStatus(res.status);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update status";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!isPublished) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const clientGreeting =
    clientName && clientName.trim() ? `Hi ${clientName.trim()}` : "Hi";
  const whatsappMessage = `${clientGreeting}, your photos for "${eventName}" are ready to view! Check them out here: ${publicUrl}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;
  const qrFileName = `gallery-qr-${eventName.toLowerCase().replace(/[^a-z0-9_-]/g, "-")}-${publicId.slice(0, 8)}.png`;

  return (
    <div className="bg-white shadow rounded-lg p-5 border border-gray-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div
            className={`w-3 h-3 rounded-full ${
              !isPublished
                ? "bg-amber-400"
                : isExpired
                ? "bg-rose-500"
                : "bg-green-500 animate-pulse"
            }`}
          />
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Gallery Visibility
            </span>
            <div className="flex items-center space-x-2">
              <span
                id="gallery-status-badge"
                className={`font-semibold text-base ${
                  !isPublished
                    ? "text-amber-700"
                    : isExpired
                    ? "text-rose-700"
                    : "text-green-700"
                }`}
              >
                {!isPublished
                  ? "Draft (Unpublished)"
                  : isExpired
                  ? "Published (Expired)"
                  : "Published (Public)"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            id="toggle-publish-button"
            type="button"
            disabled={isLoading}
            onClick={handleToggle}
            className={`inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              isPublished
                ? "border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-red-500"
                : "border-transparent text-white bg-green-600 hover:bg-green-700 focus:ring-green-500"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : isPublished ? (
              <>
                <EyeOff className="w-4 h-4 mr-2 text-gray-500" />
                Unpublish Gallery
              </>
            ) : (
              <>
                <Globe className="w-4 h-4 mr-2" />
                Publish Gallery
              </>
            )}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-3 text-sm text-red-600">
          Error: {errorMessage}
        </div>
      )}

      {/* Warning when Unpublished (Draft) */}
      {!isPublished && (
        <div
          id="unpublished-warning-banner"
          className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg"
        >
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-amber-900">
                Gallery is Unpublished (Draft)
              </h4>
              <p className="mt-1 text-xs text-amber-700 leading-relaxed">
                Sharing options (Copy Link, WhatsApp Share, and QR Code) are disabled while this gallery is in Draft mode. Publish the gallery above to enable sharing and allow your client to view and download photos.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Warning when Expired */}
      {isPublished && isExpired && (
        <div
          id="expired-warning-banner"
          className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-lg"
        >
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-rose-900">
                Gallery Has Expired
              </h4>
              <p className="mt-1 text-xs text-rose-700 leading-relaxed">
                This gallery reached its expiration date on {new Date(expiryDate!).toLocaleDateString()}. Even though the gallery is published, visitors currently receive a 404 error when opening this link or downloading photos. Extend the expiry date in event details to restore client access.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Shareable Link & QR Section when Published */}
      {isPublished ? (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="public-gallery-url-input"
                className="block text-xs font-semibold uppercase tracking-wider text-gray-600"
              >
                Client Gallery Link
              </label>
              <span className="text-xs text-gray-400">
                Publicly accessible without login
              </span>
            </div>

            {/* URL Input & Direct Copy */}
            <div className="mt-1.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                id="public-gallery-url-input"
                type="text"
                readOnly
                value={publicUrl}
                className="flex-1 text-sm font-mono bg-gray-50 border border-gray-300 text-gray-800 rounded-md px-3 py-2 select-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                id="copy-gallery-link-btn"
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                title="Copy client gallery link"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-1.5 text-green-600" />
                    <span className="text-green-600 font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1.5 text-gray-500" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Sharing Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <a
              id="whatsapp-share-btn"
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors"
              title="Share prefilled client message via WhatsApp"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              <span>Share via WhatsApp</span>
            </a>

            <a
              id="view-public-gallery-link"
              href={`/gallery/${publicId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              title="Open public gallery in a new tab"
            >
              <ExternalLink className="w-4 h-4 mr-2 text-gray-500" />
              <span>Open Gallery</span>
            </a>
          </div>

          {/* QR Code Section */}
          <div id="qr-code-section" className="pt-4 border-t border-gray-100">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
              {qrDataUrl ? (
                <div className="p-2 bg-white rounded-lg border border-gray-200 shadow-sm flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    id="gallery-qr-code-image"
                    src={qrDataUrl}
                    alt={`QR Code for ${eventName}`}
                    className="w-36 h-36 sm:w-40 sm:h-40 object-contain rounded"
                  />
                </div>
              ) : (
                <div className="w-36 h-36 sm:w-40 sm:h-40 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center text-gray-400">
                  <QrCode className="w-8 h-8" />
                </div>
              )}

              <div className="flex flex-col justify-center text-center sm:text-left space-y-2 flex-1">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 flex items-center justify-center sm:justify-start gap-1.5">
                    <QrCode className="w-4 h-4 text-gray-600" />
                    Event QR Code
                  </h4>
                  <p className="mt-1 text-xs text-gray-500 max-w-md">
                    Clients and guests can scan this QR code directly from their mobile camera to open the gallery. Download the image to print on welcome boards, event flyers, or table cards.
                  </p>
                </div>

                {qrDataUrl && (
                  <div className="pt-1">
                    <a
                      id="download-qr-btn"
                      href={qrDataUrl}
                      download={qrFileName}
                      className="inline-flex items-center justify-center px-3.5 py-2 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                      title="Download high-resolution QR code PNG"
                    >
                      <Download className="w-4 h-4 mr-1.5 text-gray-500" />
                      Download QR Code (PNG)
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 italic">
            Sharing links and QR code will appear here once the gallery is published.
          </p>
        </div>
      )}
    </div>
  );
}
