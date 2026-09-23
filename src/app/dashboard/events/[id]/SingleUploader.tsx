"use client";

import { useState } from "react";
import { generateUploadUrl, verifyUpload } from "./actions";

export default function SingleUploader({ eventId }: { eventId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<
    "idle" | "getting_url" | "uploading" | "verifying" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setStatus("idle");
      setErrorMessage("");
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      setStatus("getting_url");
      setErrorMessage("");

      const { url, photoId } = await generateUploadUrl(eventId, {
        name: file.name,
        size: file.size,
        type: file.type,
      });

      setStatus("uploading");

      const uploadResponse = await fetch(url, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload to R2 failed: ${uploadResponse.statusText}`);
      }

      setStatus("verifying");

      await verifyUpload(photoId);

      setStatus("success");
    } catch (error) {
      console.error(error);
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "An error occurred during upload");
    }
  };

  return (
    <div className="mt-8 bg-white p-6 rounded-lg shadow border border-gray-200">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Test Single Photo Upload (Foundation)
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select an image
          </label>
          <input
            type="file"
            accept="image/jpeg, image/png, image/webp, image/heic"
            onChange={handleFileChange}
            disabled={status !== "idle" && status !== "error" && status !== "success"}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        {file && (
          <div className="text-sm text-gray-600">
            Selected: <span className="font-medium">{file.name}</span> (
            {(file.size / 1024 / 1024).toFixed(2)} MB)
          </div>
        )}

        {status === "error" && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
            {errorMessage}
          </div>
        )}

        {status === "success" && (
          <div className="text-sm text-green-600 bg-green-50 p-3 rounded">
            Successfully uploaded and verified!
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file || (status !== "idle" && status !== "error")}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {status === "idle" && "Upload to R2"}
          {status === "getting_url" && "Requesting URL..."}
          {status === "uploading" && "Uploading to R2..."}
          {status === "verifying" && "Verifying Upload..."}
          {status === "success" && "Upload Complete"}
          {status === "error" && "Retry Upload"}
        </button>
      </div>
    </div>
  );
}
