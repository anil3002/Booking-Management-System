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
      className="flex min-h-40 items-center gap-7 rounded-[18px] border border-slate-950/25 bg-slate-950/72 p-6 shadow-xl shadow-slate-950/15 backdrop-blur-md transition hover:border-emerald-400/60 hover:bg-slate-950/82"
    >
      <span className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-xl bg-emerald-950/80 text-emerald-300">
        {icon}
      </span>
      <span>
        <span className="block text-xl font-extrabold text-white">{title}</span>
        <span className="mt-2 block text-base leading-6 text-slate-300">
          {description}
        </span>
      </span>
    </Link>
  );
}
