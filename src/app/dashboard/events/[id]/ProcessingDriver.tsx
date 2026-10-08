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

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/processing-status`);
        if (!res.ok) return;
        const data = await res.json();
        
        setStats(data.stats);
        
        const photosToProcess: { id: string }[] = data.photosToProcess || [];
        setBacklog(photosToProcess.length);

        // Claim and start up to 2 concurrent
        for (const photo of photosToProcess) {
          if (activeProcessingRef.current.size >= 2) break;
          
          if (!activeProcessingRef.current.has(photo.id)) {
            activeProcessingRef.current.add(photo.id);
            setActiveCount(activeProcessingRef.current.size);
            
            // Fire and forget
            fetch(`/api/photos/${photo.id}/process`, { method: "POST" })
              .finally(() => {
                activeProcessingRef.current.delete(photo.id);
                setActiveCount(activeProcessingRef.current.size);
                // Trigger immediate poll after one finishes
                if (timerRef.current) clearTimeout(timerRef.current);
                timerRef.current = setTimeout(poll, 1000);
              });
          }
        }
      } catch (error) {
        console.error("Failed to poll processing status", error);
      }

      // Schedule next poll
      timerRef.current = setTimeout(poll, 3000);
    };

    poll();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
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
