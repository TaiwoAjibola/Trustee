import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { Role } from "@prisma/client";

// Demo/prototype: authentication is validated against the in-memory mock users
// defined in lib/prisma.ts (this is a "dummy data" design showcase, not a real
// credential store). Passwords are not checked for the MVP seed accounts.
const DEMO_USERS = [
  { id: "user_fidu", name: "Adewale Fiduciary Lead", email: "fiduciary@firsttrustees.com", role: Role.FIDUCIARY_EXEC },
  { id: "user_mon", name: "Engr. Kabir (Independent Monitor)", email: "monitor@tech-cert.org", role: Role.INDEPENDENT_MONITOR },
];

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
        const user = DEMO_USERS.find(
          (u) => u.email.toLowerCase() === credentials.email.toLowerCase(),
        );
        if (!user) return null;
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
