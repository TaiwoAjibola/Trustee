import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppShell, type AppUser } from "@/components/AppShell";
import { Role } from "@prisma/client";
import { mergeOverlayUsersIntoStore } from "@/lib/userOverlay";


export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  await mergeOverlayUsersIntoStore();
  const role = (session.user as unknown as { role?: Role }).role ?? Role.OPS_ANALYST;
  const user: AppUser = {
    name: session.user.name ?? "User",
    email: session.user.email,
    role,
  };
  return <AppShell role={role} user={user}>{children}</AppShell>;
}
