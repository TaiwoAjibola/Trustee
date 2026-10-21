import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "syndesis_created_users";
export const MAX_OVERLAY_USERS = 20;

export type OverlayUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  professionalBody?: string;
  registrationNumber?: string;
};

export async function readOverlayUsers(): Promise<OverlayUser[]> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    return Array.isArray(parsed) ? (parsed as OverlayUser[]) : [];
  } catch {
    return [];
  }
}

async function writeOverlayUsers(users: OverlayUser[]) {
  const store = await cookies();
  store.set(COOKIE_NAME, encodeURIComponent(JSON.stringify(users)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function upsertOverlayUser(user: OverlayUser) {
  const users = (await readOverlayUsers()).filter((u) => u.email !== user.email);
  await writeOverlayUsers([...users, user]);
}

export async function mergeOverlayUsersIntoStore() {
  const users = await readOverlayUsers();
  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (!existing) {
      await prisma.user.create({
        data: {
          id: u.id,
          name: u.name,
          email: u.email,
          hashedPassword: "hashed_pass",
          role: u.role,
          isActive: u.isActive,
          createdAt: new Date(u.createdAt),
          updatedAt: new Date(u.updatedAt),
        },
      });
    } else if (
      existing.isActive !== u.isActive ||
      existing.name !== u.name ||
      existing.role !== u.role
    ) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { isActive: u.isActive, name: u.name, role: u.role, updatedAt: new Date(u.updatedAt) },
      });
    }

    if (u.role === Role.INDEPENDENT_MONITOR) {
      const cred = await prisma.monitorCredential.findUnique({ where: { userId: u.id } });
      if (!cred) {
        await prisma.monitorCredential.create({
          data: {
            userId: u.id,
            professionalBody: u.professionalBody || "Pending verification",
            registrationNumber: u.registrationNumber || "—",
            piInsuranceVerified: false,
            kycStatus: "PENDING",
            createdAt: new Date(u.createdAt),
            updatedAt: new Date(u.updatedAt),
          },
        });
      }
    }
  }
}
