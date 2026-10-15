"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html>
      <body className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <h1 className="text-lg font-bold text-slate-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-500">
            {error.message || "An unexpected error occurred."}
          </p>
          {error.digest && (
            <p className="mt-1 text-xs text-slate-400">Reference: {error.digest}</p>
          )}
          <button
            onClick={reset}
            className="mt-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-sm font-semibold transition"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
