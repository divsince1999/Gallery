"use client";

import { useState } from "react";
import { Globe, EyeOff, Copy, Check, ExternalLink, Loader2 } from "lucide-react";
import { togglePublishEvent } from "./actions";

interface PublishToggleProps {
  eventId: string;
  initialStatus: "DRAFT" | "PUBLISHED";
  publicId: string;
}

export default function PublishToggle({
  eventId,
  initialStatus,
  publicId,
}: PublishToggleProps) {
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">(initialStatus);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isPublished = status === "PUBLISHED";

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

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/gallery/${publicId}`
      : `/gallery/${publicId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-5 border border-gray-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div
            className={`w-3 h-3 rounded-full ${
              isPublished ? "bg-green-500 animate-pulse" : "bg-amber-400"
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
                  isPublished ? "text-green-700" : "text-amber-700"
                }`}
              >
                {isPublished ? "Published (Public)" : "Draft (Unpublished)"}
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

      {/* Shareable Link Widget when Published */}
      {isPublished ? (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Client Gallery Link
          </label>
          <div className="flex items-center space-x-2">
            <input
              id="public-gallery-url-input"
              type="text"
              readOnly
              value={publicUrl}
              className="flex-1 text-sm bg-gray-50 border border-gray-300 text-gray-800 rounded-md px-3 py-1.5 select-all focus:outline-none"
            />
            <button
              id="copy-gallery-link-btn"
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              title="Copy client gallery link"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-1 text-green-600" />
                  <span className="text-green-600 font-medium">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1 text-gray-500" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
            <a
              id="view-public-gallery-link"
              href={`/gallery/${publicId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-1.5 border border-blue-600 shadow-sm text-sm font-medium rounded-md text-blue-600 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              <span>Open</span>
            </a>
          </div>
          <p className="mt-1.5 text-xs text-gray-500">
            Anyone with this link can view the gallery without logging in.
          </p>
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            This gallery is currently private. Publish it when you are ready to share the public link with your client.
          </p>
        </div>
      )}
    </div>
  );
}
