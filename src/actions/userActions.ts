"use server";

import { prisma } from "@/lib/prisma";
import { KycStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  MAX_OVERLAY_USERS,
  mergeOverlayUsersIntoStore,
  readOverlayUsers,
  upsertOverlayUser,
} from "@/lib/userOverlay";

const ALLOWED_ROLES: Role[] = [Role.FIDUCIARY_EXEC, Role.INDEPENDENT_MONITOR];

async function currentTrustee() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized: No active session.");
  const role = (session.user as unknown as { role: Role }).role;
  if (role === Role.INDEPENDENT_MONITOR) {
    throw new Error("Independent Monitors cannot manage the trustee team.");
  }
  await mergeOverlayUsersIntoStore();
  return {
    id: (session.user as unknown as { id: string }).id,
    name: session.user.name ?? "System",
    role,
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createUser(data: {
  name: string;
  email: string;
  role: Role;
  professionalBody?: string;
  registrationNumber?: string;
}) {
  await currentTrustee();

  const name = (data.name ?? "").trim();
  const email = (data.email ?? "").trim().toLowerCase();

  if (name.length < 2) throw new Error("Please enter the person's full name.");
  if (!EMAIL_RE.test(email)) throw new Error("Please enter a valid email address.");
  if (!ALLOWED_ROLES.includes(data.role)) {
    throw new Error("Role must be Trustee or Independent Monitor.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("A user with this email already exists.");

  const overlay = await readOverlayUsers();
  if (!overlay.some((u) => u.email === email) && overlay.length >= MAX_OVERLAY_USERS) {
    throw new Error(
      `This demo allows up to ${MAX_OVERLAY_USERS} additional accounts. Suspend one before adding another.`
    );
  }

  const now = new Date();
  const user = await prisma.user.create({
    data: {
      name,
      email,
      hashedPassword: "hashed_pass",
      role: data.role,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  });

  const isMonitor = data.role === Role.INDEPENDENT_MONITOR;
  const professionalBody = (data.professionalBody ?? "").trim() || "Pending verification";
  const registrationNumber = (data.registrationNumber ?? "").trim() || "—";

  if (isMonitor) {
    await prisma.monitorCredential.create({
      data: {
        userId: user.id,
        professionalBody,
        registrationNumber,
        piInsuranceVerified: false,
        kycStatus: KycStatus.PENDING,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  await upsertOverlayUser({
    id: user.id,
    name,
    email,
    role: data.role,
    isActive: true,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...(isMonitor ? { professionalBody, registrationNumber } : {}),
  });

  revalidatePath("/trustee-dashboard/users");
  revalidatePath("/trustee-dashboard/monitors");
  return user;
}

export async function setUserActive(userId: string, isActive: boolean) {
  const actor = await currentTrustee();
  if (actor.id === userId && !isActive) {
    throw new Error("You cannot suspend your own account.");
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { isActive, updatedAt: new Date() },
  });
  if (!user) throw new Error("User not found.");

  const existingOverlay = (await readOverlayUsers()).find((u) => u.email === user.email);
  await upsertOverlayUser({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive,
    createdAt: new Date(user.createdAt).toISOString(),
    updatedAt: new Date(user.updatedAt ?? new Date()).toISOString(),
    professionalBody: existingOverlay?.professionalBody,
    registrationNumber: existingOverlay?.registrationNumber,
  });

  revalidatePath("/trustee-dashboard/users");
  revalidatePath("/trustee-dashboard/monitors");
  return user;
}
