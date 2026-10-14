"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

export default function ProcessingDriver({ eventId }: { eventId: string }) {
  const [stats, setStats] = useState<{
    pendingCount: number;
    processingCount: number;
    readyCount: number;
    failedCount: number;
  } | null>(null);
  
  const [backlog, setBacklog] = useState(0);
  const [activeCount, setActiveCount] = useState(0);

  const activeProcessingRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPollingRef = useRef(false);
  const needsRepollRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const schedulePoll = (delayMs: number) => {
      if (isCancelled) return;
      if (isPollingRef.current) {
        needsRepollRef.current = true;
        return;
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        poll();
      }, delayMs);
    };

    const poll = async () => {
      if (isCancelled || isPollingRef.current) return;
      isPollingRef.current = true;

      abortControllerRef.current = new AbortController();
      let nextPollDelay: number | null = null;

      try {
        const res = await fetch(`/api/events/${eventId}/processing-status`, {
          signal: abortControllerRef.current.signal,
        });

        if (isCancelled) return;

        if (!res.ok) {
          nextPollDelay = 5000;
          return;
        }

        const data = await res.json();
        if (isCancelled) return;

        setStats(data.stats);

        const photosToProcess: { id: string }[] = data.photosToProcess || [];
        setBacklog(photosToProcess.length);

        // Claim and start up to 2 concurrent
        for (const photo of photosToProcess) {
          if (activeProcessingRef.current.size >= 2) break;

          if (!activeProcessingRef.current.has(photo.id)) {
            activeProcessingRef.current.add(photo.id);
            setActiveCount(activeProcessingRef.current.size);

            fetch(`/api/photos/${photo.id}/process`, { method: "POST" })
              .finally(() => {
                if (isCancelled) return;
                activeProcessingRef.current.delete(photo.id);
                setActiveCount(activeProcessingRef.current.size);
                schedulePoll(500);
              });
          }
        }

        const { pendingCount = 0, processingCount = 0 } = data.stats || {};
        const isIdle =
          photosToProcess.length === 0 &&
          processingCount === 0 &&
          pendingCount === 0 &&
          activeProcessingRef.current.size === 0;

        if (!isIdle) {
          nextPollDelay = 3000;
        }
      } catch (error) {
        if (isCancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error("Failed to poll processing status", error);
        nextPollDelay = 5000;
      } finally {
        isPollingRef.current = false;
        abortControllerRef.current = null;
        if (!isCancelled) {
          if (needsRepollRef.current) {
            needsRepollRef.current = false;
            schedulePoll(500);
          } else if (nextPollDelay !== null) {
            schedulePoll(nextPollDelay);
          }
        }
      }
    };

    const handlePhotoUploaded = (e: Event) => {
      const customEvent = e as CustomEvent<{ eventId?: string }>;
      if (!customEvent.detail?.eventId || customEvent.detail.eventId === eventId) {
        schedulePoll(0);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        schedulePoll(0);
      }
    };

    window.addEventListener("photo-uploaded", handlePhotoUploaded);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    schedulePoll(0);

    return () => {
      isCancelled = true;
      needsRepollRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      window.removeEventListener("photo-uploaded", handlePhotoUploaded);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [eventId]);

  if (!stats) return null;

  const totalActive = stats.processingCount + backlog;
  if (totalActive === 0 && stats.failedCount === 0) return null;

  return (
    <div className="mt-8 bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-center justify-between shadow-sm">
      <div className="flex items-center space-x-3">
        {totalActive > 0 ? (
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
        ) : (
          <div className="w-5 h-5" />
        )}
        <div>
          <h3 className="text-sm font-medium text-blue-900">
            {totalActive > 0 ? "Processing Photos" : "Processing Complete"}
          </h3>
          <p className="text-xs text-blue-700">
            {totalActive > 0 
              ? `${activeCount} processing now, ${Math.max(0, backlog - activeCount)} in queue...`
              : "All valid uploads processed."}
          </p>
        </div>
      </div>
      <div className="text-right text-xs text-blue-800 space-x-3">
        <span className="font-medium">Ready: {stats.readyCount}</span>
        {stats.failedCount > 0 && <span className="font-medium text-red-600">Failed: {stats.failedCount}</span>}
      </div>
    </div>
  );
}
