import type { ReactNode } from "react";
import { cn } from "@/lib/classnames";

type BadgeProps = {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "info" | "danger" | "accent";
  className?: string;
};

const tones = {
  neutral: "border-slate-700 bg-slate-800 text-slate-300",
  success: "border-emerald-800 bg-emerald-950/60 text-emerald-300",
  warning: "border-amber-800 bg-amber-950/50 text-amber-300",
  info: "border-sky-800 bg-sky-950/50 text-sky-300",
  danger: "border-red-800 bg-red-950/50 text-red-300",
  accent: "border-emerald-800 bg-emerald-950/60 text-emerald-300",
};

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
