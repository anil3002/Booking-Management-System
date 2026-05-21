import Link from "next/link";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/check-in", label: "Check-in" },
  { href: "/check-out", label: "Check-out" },
  { href: "/upcoming", label: "Upcoming bookings" },
  { href: "/rooms", label: "Rooms" },
];

export function AppNav() {
  return (
    <nav className="flex w-full max-w-full flex-wrap gap-1 rounded-xl border border-slate-800 bg-slate-950/85 p-1.5 shadow-lg shadow-slate-950/25 xl:w-auto xl:flex-nowrap xl:shrink-0">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex-1 whitespace-nowrap rounded-lg px-3 py-2.5 text-center text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800/80 hover:text-slate-50 sm:px-4 sm:text-base xl:flex-none"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
