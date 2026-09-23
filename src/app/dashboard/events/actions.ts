"use server";

import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";

function generatePublicId() {
  // Cryptographically secure random identifier
  return randomBytes(16).toString("hex");
}

export async function createEvent(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const name = formData.get("name") as string;
  const clientName = formData.get("clientName") as string;
  const dateStr = formData.get("date") as string;

  if (!name || !clientName || !dateStr) {
    throw new Error("Missing required fields");
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }

  const photographerId = session.user.id;
  let event;
  let retries = 3;

  while (retries > 0) {
    try {
      const publicId = generatePublicId();
      event = await prisma.event.create({
        data: {
          publicId,
          name,
          clientName,
          date,
          photographerId,
        },
      });
      break; // Success
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        retries--;
        if (retries === 0) {
          throw new Error("Failed to generate a unique public event ID");
        }
      } else {
        throw error;
      }
    }
  }

  if (event) {
    revalidatePath("/dashboard");
    redirect(`/dashboard/events/${event.id}`);
  }
}
