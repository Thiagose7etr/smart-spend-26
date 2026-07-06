import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ShoppingCart,
  Target,
  Truck,
  Fuel,
  Wrench,
  Shield,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import thcLogo from "@/assets/thc-logo.jpg.asset.json";
import { useCurrentUserAccess, type TabName } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; tab: TabName }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, tab: "dashboard" },
  { to: "/compras", label: "Compras", icon: ShoppingCart, tab: "compras" },
  { to: "/metas", label: "Metas", icon: Target, tab: "metas" },
  { to: "/frotas", label: "Frotas", icon: Truck, tab: "frotas" },
  { to: "/combustivel", label: "Combustível", icon: Fuel, tab: "combustivel" },
  { to: "/guincho", label: "Guincho", icon: Wrench, tab: "guincho" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { access, email } = useCurrentUserAccess();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const nav = NAV.filter((n) => (access ? access.canView(n.tab) : true));

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-64 flex-col border-r border-border bg-sidebar">
        <div className="flex items-center gap-3 px-6 py-6 border-b border-sidebar-border">
          <img
            src={thcLogo.url}
            alt="THcontrol"
            className="h-10 w-10 rounded-xl object-cover"
            style={{ boxShadow: "var(--shadow-glow)" }}
          />
          <div>
            <div className="text-sm font-semibold tracking-wide">THcontrol</div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Fleet & Purchases
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_var(--primary)]"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 transition-colors",
                    active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
                {label}
              </Link>
            );
          })}
          {access?.isAdmin && (
            <Link
              to="/admin/usuarios"
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all mt-2 border-t border-sidebar-border pt-4",
                pathname.startsWith("/admin")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_var(--primary)]"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
              )}
            >
              <Shield className="h-4 w-4 text-primary" />
              Usuários
            </Link>
          )}
        </nav>

        <div className="px-4 py-4 border-t border-sidebar-border">
          {email && (
            <div className="rounded-lg bg-card/60 p-3 text-xs">
              <div className="text-muted-foreground">Conectado como</div>
              <div className="font-medium text-foreground truncate">{email}</div>
              {access && (
                <div className="text-[10px] uppercase tracking-wider text-primary mt-1">
                  {access.isAdmin ? "Admin" : access.isEditor ? "Editor" : "Viewer"}
                </div>
              )}
              <button
                onClick={signOut}
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-3 w-3" /> Sair
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-20 flex items-center justify-between border-b border-border bg-sidebar px-4 py-3">
        <div className="flex items-center gap-2">
          <img src={thcLogo.url} alt="THcontrol" className="h-8 w-8 rounded-lg object-cover" />
          <span className="font-semibold text-sm">THcontrol</span>
        </div>
        <button
          onClick={signOut}
          className="text-xs text-muted-foreground inline-flex items-center gap-1"
        >
          <LogOut className="h-3.5 w-3.5" /> Sair
        </button>
      </div>

      <main className="flex-1 min-w-0 pt-14 md:pt-0">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
          {children}
        </div>

        {/* Mobile bottom nav */}
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-20 grid border-t border-border bg-sidebar"
          style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}
        >
          {nav.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[10px]",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate max-w-full px-1">{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="md:hidden h-14" />
      </main>
    </div>
  );
}