import Link from "next/link";
import type { ReactNode } from "react";

type ActionButtonProps = {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
};

export function ActionButton({ href, title, description, icon }: ActionButtonProps) {
  return (
    <Link
      href={href}
      className="flex min-h-28 items-center gap-4 rounded-lg border border-rose-200/80 bg-rose-50/80 p-5 shadow-xl shadow-rose-900/10 backdrop-blur-md transition hover:border-teal-300 hover:bg-teal-50/90"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-teal-200 text-teal-950">
        {icon}
      </span>
      <span>
        <span className="block text-lg font-bold text-slate-950">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-slate-600">
          {description}
        </span>
      </span>
    </Link>
  );
}
