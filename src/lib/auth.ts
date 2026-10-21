import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mergeOverlayUsersIntoStore } from "@/lib/userOverlay";

// Demo/prototype: authentication is validated against the in-memory mock users
// defined/seeded in lib/prisma.ts (a "dummy data" design showcase, not a real
// credential store). Sourcing from the store means team members created through
// User Management can authenticate. Passwords are not checked in this MVP.
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Fiduciary Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;
        await mergeOverlayUsersIntoStore();
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.trim().toLowerCase() },
        });
        if (!user || !user.isActive) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as unknown as { role?: Role }).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as unknown as { role?: Role }).role = token.role as Role;
        (session.user as unknown as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
};
