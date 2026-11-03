"use client";

import clsx from "clsx";
import {
  Building2,
  Compass,
  LayoutDashboard,
  Settings,
  Users,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: ClipboardList },
  { href: "/discovery", label: "Discovery", icon: Compass },
  { href: "/companies", label: "Companies", icon: Building2, stub: true },
  { href: "/contacts", label: "Contacts", icon: Users, stub: true },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-slate-900 text-slate-100">
      <div className="border-b border-slate-700/80 px-4 py-5">
        <Link href="/" className="block no-underline">
          <div className="font-display text-lg font-semibold tracking-tight text-white">
            Flipping Homes UK
          </div>
          <div className="mt-0.5 text-xs font-medium uppercase tracking-wider text-emerald-300/90">
            Land Finder
          </div>
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2" aria-label="Primary">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm no-underline transition-colors",
                active
                  ? "bg-slate-800 text-white"
                  : "text-slate-300 hover:bg-slate-800/70 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              <span>{item.label}</span>
              {"stub" in item && item.stub ? (
                <span className="ml-auto text-[10px] uppercase tracking-wide text-slate-500">
                  stub
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-700/80 px-4 py-3 text-[11px] text-slate-500">
        Ops CRM · no end-user auth
      </div>
    </aside>
  );
}
