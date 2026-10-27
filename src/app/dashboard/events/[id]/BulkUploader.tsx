"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { generateUploadUrl, verifyUpload, runR2Diagnostic, type DiagnosticResult } from "./actions";
import { UploadCloud, XCircle, CheckCircle, AlertCircle, RefreshCw, Loader2, Image as ImageIcon } from "lucide-react";

type UploadState = "QUEUED" | "UPLOADING" | "VERIFYING" | "UPLOADED" | "FAILED" | "DUPLICATE/SKIPPED";

interface QueuedFile {
  id: string; // internal unique id for tracking
  file: File;
  status: UploadState;
  progress: number; // 0-100
  bytesUploaded: number;
  photoId?: string; // from server
  errorMessage?: string;
}

const MAX_CONCURRENT_UPLOADS = 4;

export default function BulkUploader({ eventId }: { eventId: string }) {
  // Authoritative scheduler state
  const filesRef = useRef<QueuedFile[]>([]);
  const activeUploadsRef = useRef<Set<string>>(new Set());

  // React state purely for rendering
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [diagnosticState, setDiagnosticState] = useState<{ running: boolean; result?: DiagnosticResult } | null>(null);
  const queueProcessorRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processQueueRef = useRef<(() => void) | null>(null);
  const isUploadingRef = useRef(false);

  // Stats for the header
  const totalSelected = files.length;
  const totalBytesSelected = files.reduce((acc, f) => acc + f.file.size, 0);
  const totalBytesUploaded = files.reduce((acc, f) => acc + f.bytesUploaded, 0);
  const uploadedCount = files.filter(f => f.status === "UPLOADED").length;
  const failedCount = files.filter(f => f.status === "FAILED").length;
  const skippedCount = files.filter(f => f.status === "DUPLICATE/SKIPPED").length;
  const uploadingCount = files.filter(f => f.status === "UPLOADING" || f.status === "VERIFYING").length;

  const overallProgress = totalBytesSelected > 0 
    ? Math.round((totalBytesUploaded / totalBytesSelected) * 100) 
    : 0;

  // Prevent leaving while uploading
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUploadingRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const updateFile = useCallback((id: string, updates: Partial<QueuedFile>) => {
    filesRef.current = filesRef.current.map(f => f.id === id ? { ...f, ...updates } : f);
    setFiles(filesRef.current);
  }, []);

  const uploadFile = useCallback(async (qf: QueuedFile) => {
    try {
      // 1. JIT Generate URL
      const metadata = { name: qf.file.name, size: qf.file.size, type: qf.file.type };
      const res = await generateUploadUrl(eventId, metadata, qf.photoId);
      
      if (res.duplicate) {
        updateFile(qf.id, { 
          status: "DUPLICATE/SKIPPED", 
          progress: 100, 
          bytesUploaded: qf.file.size 
        });
        return;
      }

      if (!res.url || !res.photoId) {
        throw new Error("Invalid response from server");
      }

      const { url, photoId } = res;
      updateFile(qf.id, { status: "UPLOADING", photoId });

      // 2. XHR Upload for precise progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", url, true);
        xhr.setRequestHeader("Content-Type", qf.file.type);
        
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            updateFile(qf.id, { 
              progress: percentComplete, 
              bytesUploaded: e.loaded 
            });
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(qf.file);
      });

      // 3. Server Verification
      updateFile(qf.id, { status: "VERIFYING" });
      await verifyUpload(photoId);
      
      // 4. Final Success
      updateFile(qf.id, { status: "UPLOADED", bytesUploaded: qf.file.size, progress: 100 });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("photo-uploaded", { detail: { eventId } }));
      }
      
    } catch (error) {
      console.error(`Upload error for ${qf.file.name}:`, error);
      updateFile(qf.id, { 
        status: "FAILED", 
        errorMessage: error instanceof Error ? error.message : "Upload failed" 
      });
    }
  }, [eventId, updateFile]);

  const processQueue = useCallback(() => {
    while (activeUploadsRef.current.size < MAX_CONCURRENT_UPLOADS) {
      const toStart = filesRef.current.find(f => f.status === "QUEUED" && !activeUploadsRef.current.has(f.id));
      if (!toStart) break;

      // Acquire active-upload lock
      activeUploadsRef.current.add(toStart.id);
      
      // Mark as uploading in authoritative state and trigger render
      updateFile(toStart.id, { status: "UPLOADING" });

      // Start the upload asynchronously
      uploadFile(toStart).finally(() => {
        // Release active-upload lock regardless of success or failure
        activeUploadsRef.current.delete(toStart.id);
        
        // Trigger the next tick of the queue
        if (queueProcessorRef.current) clearTimeout(queueProcessorRef.current);
        if (processQueueRef.current) {
          queueProcessorRef.current = setTimeout(processQueueRef.current, 100);
        }
      });
    }

    isUploadingRef.current = activeUploadsRef.current.size > 0;
  }, [uploadFile, updateFile]);

  useEffect(() => {
    processQueueRef.current = processQueue;
  }, [processQueue]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const currentSignatures = new Set(filesRef.current.map(f => `${f.file.name}-${f.file.size}`));
    const newFiles: QueuedFile[] = [];
    
    for (const file of acceptedFiles) {
      const sig = `${file.name}-${file.size}`;
      if (!currentSignatures.has(sig)) {
        currentSignatures.add(sig);
        newFiles.push({
          id: Math.random().toString(36).substring(7) + Date.now(),
          file,
          status: "QUEUED",
          progress: 0,
          bytesUploaded: 0
        });
      }
    }
    
    filesRef.current = [...filesRef.current, ...newFiles];
    setFiles(filesRef.current);

    if (queueProcessorRef.current) clearTimeout(queueProcessorRef.current);
    queueProcessorRef.current = setTimeout(processQueue, 100);
  }, [processQueue]);

  const handleRetry = () => {
    filesRef.current = filesRef.current.map(f => 
      f.status === "FAILED" ? { ...f, status: "QUEUED", progress: 0, bytesUploaded: 0, errorMessage: undefined } : f
    );
    setFiles(filesRef.current);
    
    if (queueProcessorRef.current) clearTimeout(queueProcessorRef.current);
    queueProcessorRef.current = setTimeout(processQueue, 100);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp']
    }
  });

  return (
    <div className="bg-white p-6 rounded-lg shadow border border-gray-200 mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Upload Photos (Bulk)</h2>
        <button
          type="button"
          onClick={async () => {
            setDiagnosticState({ running: true });
            try {
              const res = await runR2Diagnostic(eventId);
              setDiagnosticState({ running: false, result: res });
            } catch {
              setDiagnosticState({
                running: false,
                result: {
                  success: false,
                  bucket: "unknown",
                  errorCode: "DiagnosticInvocationFailed",
                },
              });
            }
          }}
          disabled={diagnosticState?.running}
          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded border border-gray-300 font-medium transition-colors"
        >
          {diagnosticState?.running ? "Running Diagnostic..." : "Run Storage Diagnostic"}
        </button>
      </div>

      {diagnosticState?.result && (
        <div
          className={`mb-4 p-3 rounded text-sm ${
            diagnosticState.result.success
              ? "bg-green-50 text-green-800 border border-green-200"
              : diagnosticState.result.stage === "cleanup"
              ? "bg-amber-50 text-amber-800 border border-amber-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {diagnosticState.result.success ? (
            <p>
              <strong>Diagnostic Passed:</strong> Target bucket <code>{diagnosticState.result.bucket}</code> is authorized for uploads and deletes.
            </p>
          ) : diagnosticState.result.errorCode === "DiagnosticInvocationFailed" ? (
            <p>
              <strong>Diagnostic Failed:</strong> An unexpected error occurred while executing the diagnostic.
            </p>
          ) : diagnosticState.result.stage === "cleanup" ? (
            <p>
              <strong>Diagnostic Incomplete (Cleanup Failed):</strong> Upload probe succeeded, but deletion failed on bucket <code>{diagnosticState.result.bucket}</code> with error <code>{diagnosticState.result.errorCode}</code> (HTTP Status: {diagnosticState.result.httpStatus ?? "N/A"}). The test probe may remain in the bucket.
            </p>
          ) : (
            <p>
              <strong>Diagnostic Failed:</strong> Bucket <code>{diagnosticState.result.bucket}</code> returned error <code>{diagnosticState.result.errorCode}</code> (HTTP Status: {diagnosticState.result.httpStatus ?? "N/A"}).
            </p>
          )}

          {typeof diagnosticState.result.accountIdMatches === "boolean" && (
            <div className="mt-2 pt-2 border-t border-current/20 text-xs flex flex-wrap gap-4">
              <span>Account ID matches expected: <strong>{diagnosticState.result.accountIdMatches ? "true" : "false"}</strong></span>
              <span>Bucket name matches expected: <strong>{diagnosticState.result.bucketNameMatches ? "true" : "false"}</strong></span>
            </div>
          )}
        </div>
      )}
      
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <UploadCloud className="mx-auto h-12 w-12 text-gray-400 mb-3" />
        <p className="text-gray-600 font-medium">Drag & drop photos here, or click to select files</p>
        <p className="text-sm text-gray-500 mt-1">Supports JPEG, PNG, WebP</p>
      </div>

      {totalSelected > 0 && (
        <div className="mt-8 space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 sticky top-0 z-10 shadow-sm">
            <div className="flex justify-between items-end mb-2">
              <div>
                <h3 className="font-medium text-gray-900">Upload Progress</h3>
                <p className="text-sm text-gray-500">
                  {uploadedCount} / {totalSelected} uploaded • {(totalBytesUploaded / 1024 / 1024).toFixed(1)}MB / {(totalBytesSelected / 1024 / 1024).toFixed(1)}MB
                </p>
              </div>
              <div className="text-right text-sm">
                <div className="text-gray-600">Uploading: {uploadingCount}</div>
                {failedCount > 0 && <div className="text-red-600 font-medium">Failed: {failedCount}</div>}
                {skippedCount > 0 && <div className="text-orange-600 font-medium">Skipped Duplicates: {skippedCount}</div>}
              </div>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-blue-600 h-2.5 transition-all duration-300 ease-out" 
                style={{ width: `${overallProgress}%` }}
              ></div>
            </div>

            {failedCount > 0 && (
              <button 
                onClick={handleRetry}
                className="mt-4 flex items-center text-sm text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-md font-medium shadow-sm transition-colors"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry {failedCount} Failed
              </button>
            )}
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[600px] overflow-y-auto">
            <ul className="divide-y divide-gray-200">
              {files.map(f => (
                <li key={f.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3 truncate">
                    <ImageIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="truncate">
                      <p className="text-sm font-medium text-gray-900 truncate" title={f.file.name}>{f.file.name}</p>
                      <p className="text-xs text-gray-500">{(f.file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4 flex-shrink-0 ml-4 w-32 justify-end">
                    {(f.status === "UPLOADING" || f.status === "VERIFYING") && (
                      <div className="flex items-center text-blue-600 text-sm">
                        <Loader2 className="w-4 h-4 mr-2 animate-spin flex-shrink-0" />
                        <span className="w-12 text-right">
                          {f.status === "VERIFYING" ? "Verify" : `${f.progress}%`}
                        </span>
                      </div>
                    )}
                    {f.status === "UPLOADED" && (
                      <div className="flex items-center text-green-600 text-sm font-medium" title="Successfully uploaded">
                        <CheckCircle className="w-5 h-5" />
                      </div>
                    )}
                    {f.status === "DUPLICATE/SKIPPED" && (
                      <div className="flex items-center text-orange-600 text-sm font-medium" title="Skipped (Already exists)">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                    )}
                    {f.status === "FAILED" && (
                      <div className="flex items-center text-red-600 text-sm font-medium" title={f.errorMessage || "Failed"}>
                        <XCircle className="w-5 h-5" />
                      </div>
                    )}
                    {f.status === "QUEUED" && (
                      <div className="text-gray-400 text-sm font-medium">
                        Queued
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
