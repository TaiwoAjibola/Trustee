"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2 } from "lucide-react";

const SEED_USERS = [
  { label: "Fiduciary Exec", email: "fiduciary@firsttrustees.com" },
  { label: "Ops Analyst", email: "ops@firsttrustees.com" },
  { label: "Independent Monitor", email: "monitor@tech-cert.org" },
];

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("fiduciary@firsttrustees.com");
  const [password, setPassword] = useState("Pass1234!");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Authentication failed. Verify the credentials.");
      return;
    }
    router.push("/ops-dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="w-8 h-8 text-emerald-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">SYNDESIS Trustee</h1>
            <p className="text-xs text-slate-500">Fiduciary Control Node</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500"
              required
            />
          </div>

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 text-sm transition disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Authenticate
          </button>
        </form>

        <div className="mt-6 border-t border-slate-200 pt-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">
            Seed accounts (MVP auth)
          </p>
          <div className="flex flex-wrap gap-2">
            {SEED_USERS.map((u) => (
              <button
                key={u.email}
                type="button"
                onClick={() => setEmail(u.email)}
                className="text-xs px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-700 text-slate-700 border border-slate-200"
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
