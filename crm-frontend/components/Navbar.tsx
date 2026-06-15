"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "dashboard", exact: true },
  { href: "/chat", label: "AI Chat", icon: "forum" },
  { href: "/campaigns", label: "Campaigns", icon: "campaign" },
  { href: "/customers", label: "Customers", icon: "group" },
  { href: "/segments", label: "Segments", icon: "layers" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <>
      {/* Top Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-surface/70 dark:bg-surface/70 backdrop-blur-xl border-b border-white/5 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] flex justify-between items-center px-gutter h-16">
        <div className="flex items-center gap-4">
          <span className="font-headline-lg-mobile text-headline-lg-mobile font-bold tracking-tighter text-primary">LOOM</span>
          <div className="hidden lg:flex items-center gap-6 ml-8">
            <Link href="/"><span className={cn("transition-all cursor-pointer", pathname === "/" ? "text-primary font-bold" : "text-on-surface-variant hover:bg-white/5 px-3 py-1 rounded-lg")}>Dashboard</span></Link>
            <Link href="/customers"><span className={cn("transition-all cursor-pointer", pathname.startsWith("/customers") ? "text-primary font-bold" : "text-on-surface-variant hover:bg-white/5 px-3 py-1 rounded-lg")}>Customers</span></Link>
            <Link href="/campaigns"><span className={cn("transition-all cursor-pointer", pathname.startsWith("/campaigns") ? "text-primary font-bold" : "text-on-surface-variant hover:bg-white/5 px-3 py-1 rounded-lg")}>Campaigns</span></Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="material-symbols-outlined text-primary p-2 hover:bg-white/5 rounded-full transition-all">notifications</button>
          <div className="w-8 h-8 rounded-full border border-primary/30 overflow-hidden bg-white/10 flex items-center justify-center">
            <span className="text-xs font-bold text-white">L</span>
          </div>
        </div>
      </nav>

      {/* Side Navigation (Desktop Only) */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-[280px] bg-surface-container-low dark:bg-surface-container-low border-r border-white/5 shadow-2xl flex-col p-md z-40 pt-24">
        <div className="flex items-center gap-4 mb-10 px-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-primary-container to-secondary-container flex items-center justify-center shadow-lg">
            <span className="material-symbols-outlined text-white text-2xl">monitoring</span>
          </div>
          <div>
            <h3 className="font-title-md text-on-surface font-bold leading-tight">LOOM Team</h3>
            <p className="text-on-surface-variant/70 text-xs tracking-wide uppercase">Marketing Admin</p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {NAV_ITEMS.map(({ href, label, icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={cn(
                "flex items-center gap-4 px-4 py-3 transition-all ease-out duration-200 rounded-lg group",
                active ? "text-primary font-bold bg-primary/10" : "text-on-surface-variant hover:bg-white/5"
              )}>
                <span className={cn("material-symbols-outlined", !active && "group-hover:text-primary")}>{icon}</span>
                <span className="font-body-md">{label}</span>
              </Link>
            );
          })}
        </div>
        <div className="mt-auto glass-card p-4 rounded-xl border border-primary/20">
          <p className="text-xs text-primary/80 font-bold mb-2">LOOM CLOUD</p>
          <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
            <div className="bg-primary w-3/4 h-full"></div>
          </div>
          <p className="text-[10px] text-on-surface-variant mt-2">75% Storage used</p>
        </div>
      </aside>
    </>
  );
}
