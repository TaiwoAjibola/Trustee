"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-rose-600 transition"
    >
      <LogOut className="w-3.5 h-3.5" />
      Sign Out
    </button>
  );
}
