import Link from "next/link";
import type { ReactNode } from "react";

type PageShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function PageShell({ title, description, children }: PageShellProps) {
  return (
    <main className="min-h-screen text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-5 flex items-start justify-between gap-4 rounded-lg border border-amber-200/80 bg-amber-50/80 p-4 shadow-xl shadow-orange-900/10 backdrop-blur-md">
          <div>
            <Link
              href="/"
              className="text-sm font-semibold text-rose-700 hover:text-slate-950"
            >
              Hotel Booking
            </Link>
            <h1 className="mt-2 text-3xl font-bold tracking-normal text-slate-950">
              {title}
            </h1>
            {description ? (
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                {description}
              </p>
            ) : null}
          </div>
          <Link
            href="/rooms"
            className="rounded-md border border-teal-200 bg-teal-100 px-3 py-2 text-sm font-semibold text-teal-900 shadow-sm hover:bg-teal-200"
          >
            Rooms
          </Link>
        </header>
        {children}
      </div>
    </main>
  );
}
