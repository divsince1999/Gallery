"use server";

import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

export async function signup(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const name = formData.get("name") as string;

  if (!email || !password || password.length < 6) {
    return { error: "Invalid email or password (min 6 chars)" };
  }

  const existingUser = await prisma.photographer.findUnique({
    where: { email },
  });

  if (existingUser) {
    return { error: "Email already exists" };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.photographer.create({
    data: {
      email,
      passwordHash,
      name,
    },
  });

  redirect("/login?registered=true");
}
