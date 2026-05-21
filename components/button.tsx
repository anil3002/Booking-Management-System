import { cn } from "@/lib/classnames";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  fullWidth?: boolean;
};

const variants = {
  primary:
    "border-transparent bg-emerald-700 text-white hover:bg-emerald-800 disabled:bg-slate-400",
  secondary:
    "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:bg-slate-100 disabled:text-slate-400",
  ghost:
    "border-transparent bg-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-50 disabled:text-slate-600",
  danger:
    "border-red-900/70 bg-red-950/40 text-red-300 hover:bg-red-950 disabled:text-red-800",
};

export function Button({
  variant = "primary",
  fullWidth,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-11 items-center justify-center rounded-md border px-4 text-sm font-bold shadow-sm transition outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed",
        variants[variant],
        fullWidth && "w-full",
        className,
      )}
    />
  );
}
