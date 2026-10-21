"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Role } from "@prisma/client";
import { createUser } from "@/actions/userActions";
import { UserPlus, Loader2, CheckCircle2 } from "lucide-react";

export function CreateUserForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(Role.FIDUCIARY_EXEC);
  const [professionalBody, setProfessionalBody] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isMonitor = role === Role.INDEPENDENT_MONITOR;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const user = await createUser({
          name,
          email,
          role,
          professionalBody,
          registrationNumber,
        });
        setSuccess(
          `${user.name} was added as ${
            role === Role.INDEPENDENT_MONITOR ? "an Independent Monitor" : "a Trustee"
          }.`
        );
        setName("");
        setEmail("");
        setProfessionalBody("");
        setRegistrationNumber("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create user.");
      }
    });
  }

  const fieldClass =
    "mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500";

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
    >
      <div className="flex items-center gap-2">
        <UserPlus className="w-5 h-5 text-emerald-600" />
        <h2 className="text-md font-bold text-slate-900">Add a team member</h2>
      </div>
      <p className="text-xs text-slate-500">
        Attribute a role to a new person. Trustees join the control team; monitors
        enter the KYC registry and can be appointed to projects.
      </p>

      <div>
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          Full name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ngozi Adeyemi"
          className={fieldClass}
          required
        />
      </div>

      <div>
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@firsttrustees.com"
          className={fieldClass}
          required
        />
      </div>

      <div>
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          Role
        </label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className={fieldClass}
        >
          <option value={Role.FIDUCIARY_EXEC}>Trustee</option>
          <option value={Role.INDEPENDENT_MONITOR}>Independent Monitor</option>
        </select>
      </div>

      {isMonitor && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg bg-violet-50/60 border border-violet-100 p-3">
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Professional body
            </label>
            <input
              value={professionalBody}
              onChange={(e) => setProfessionalBody(e.target.value)}
              placeholder="e.g. COREN"
              className={fieldClass}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Registration no.
            </label>
            <input
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              placeholder="e.g. RCOREN-22981"
              className={fieldClass}
            />
          </div>
        </div>
      )}

      {error && <p className="text-xs text-rose-600">{error}</p>}
      {success && (
        <p className="text-xs text-emerald-700 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> {success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 text-sm transition disabled:opacity-60"
      >
        {pending && <Loader2 className="w-4 h-4 animate-spin" />}
        {pending ? "Creating…" : "Create user"}
      </button>

      <p className="text-[11px] text-slate-400">
        Prototype auth: the new user signs in with this email. Password validation is
        disabled in this demo.
      </p>
    </form>
  );
}
