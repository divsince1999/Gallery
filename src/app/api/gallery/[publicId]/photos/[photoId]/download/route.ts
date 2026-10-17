import { NextRequest, NextResponse } from "next/server";
import { generatePhotoDownloadUrl } from "@/lib/downloads";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ publicId: string; photoId: string }> }
) {
  try {
    const { publicId, photoId } = await params;

    const result = await generatePhotoDownloadUrl(publicId, photoId);

    if (!result) {
      return NextResponse.json(
        { error: "Photo not found or unavailable for download" },
        { status: 404 }
      );
    }

    const response = NextResponse.redirect(result.downloadUrl, 302);
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  } catch (error) {
    console.error("Download route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
