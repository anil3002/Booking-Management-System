import Link from "next/link";
import type { ReactNode } from "react";
import { AppNav } from "@/components/app-nav";

type PageShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function PageShell({ title, description, children }: PageShellProps) {
  return (
    <main className="min-h-screen text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-[1520px] flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="mb-10 flex flex-col gap-8 rounded-[18px] border border-slate-950/25 bg-slate-950/78 p-6 shadow-2xl shadow-slate-950/25 backdrop-blur-md sm:p-7 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <Link
              href="/"
              className="text-sm font-extrabold uppercase tracking-[0.42em] text-emerald-300 hover:text-emerald-200"
            >
              Hotel Operations
            </Link>
            <h1 className="mt-5 text-5xl font-extrabold leading-none tracking-normal text-white sm:text-6xl xl:max-w-[760px]">
              {title}
            </h1>
            {description ? (
              <p className="mt-6 max-w-3xl text-lg leading-7 text-slate-300 sm:text-xl">
                {description}
              </p>
            ) : null}
          </div>
          <AppNav />
        </header>
        {children}
      </div>
    </main>
  );
}
