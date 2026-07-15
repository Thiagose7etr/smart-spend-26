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
  Sun,
  Moon,
  ClipboardList,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type ReactNode, useState } from "react";
import thcLogo from "@/assets/thc-logo.jpg";
import { useCurrentUserAccess, type TabName } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTheme } from "@/hooks/use-theme";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; tab: TabName; color?: string }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, tab: "dashboard" },
  { to: "/compras", label: "Compras", icon: ShoppingCart, tab: "compras" },
  { to: "/metas", label: "Metas", icon: Target, tab: "metas" },
  { to: "/frotas", label: "Frotas", icon: Truck, tab: "frotas" },
  { to: "/combustivel", label: "Combustível", icon: Fuel, tab: "combustivel" },
  { to: "/guincho", label: "Guincho", icon: Wrench, tab: "guincho" },
  { to: "/requisicoes", label: "Requisição", icon: ClipboardList, tab: "requisicoes", color: "yellow" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { access, email } = useCurrentUserAccess();
  const displayName =
    access?.profile?.full_name?.trim() ||
    email?.split("@")[0] ||
    "";
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!oldPassword) {
      toast.error("Por favor, digite sua senha antiga.");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setChangingPassword(true);
    try {
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email: email || "",
        password: oldPassword,
      });
      if (loginErr) {
        throw new Error("Senha antiga incorreta. Verifique os dados digitados.");
      }

      const { error: authErr } = await supabase.auth.updateUser({ password: newPassword });
      if (authErr) throw authErr;

      if (access?.profile?.id) {
        const { error: dbErr } = await supabase.from("profiles").update({ senha: newPassword }).eq("id", access.profile.id);
        if (dbErr) console.warn("Aviso: Não foi possível salvar no perfil:", dbErr.message);
      }

      toast.success("Sua senha foi alterada com sucesso!");
      setPasswordDialogOpen(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar senha");
    } finally {
      setChangingPassword(false);
    }
  }

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
            src={thcLogo}
            alt="THcontrol"
            className="h-10 w-10 rounded-xl object-cover"
            style={{ boxShadow: "var(--shadow-glow)" }}
          />
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-wide flex items-center gap-2">
              <span>THcontrol</span>
              {displayName && (
                <span className="text-primary font-medium truncate max-w-[110px]">
                  · {displayName}
                </span>
              )}
            </div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Fleet & Purchases
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(({ to, label, icon: Icon, color }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            const isYellow = color === "yellow";
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? isYellow
                      ? "bg-yellow-500/10 text-yellow-400 shadow-[inset_2px_0_0_theme(colors.yellow.400)]"
                      : "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_var(--primary)]"
                    : isYellow
                      ? "text-yellow-500/70 hover:text-yellow-400 hover:bg-yellow-500/10"
                      : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 transition-colors",
                    active
                      ? isYellow ? "text-yellow-400" : "text-primary"
                      : isYellow ? "text-yellow-500/70 group-hover:text-yellow-400" : "text-muted-foreground group-hover:text-foreground",
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
              <div className="mt-2 flex items-center justify-between">
                <button
                  onClick={signOut}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <LogOut className="h-3 w-3" /> Sair
                </button>
                <button
                  onClick={() => setPasswordDialogOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <KeyRound className="h-3 w-3" /> Senha
                </button>
                <button
                  onClick={toggleTheme}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-sidebar-border text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title={theme === "dark" ? "Modo Claro" : "Modo Escuro"}
                >
                  {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-20 flex items-center justify-between border-b border-border bg-sidebar px-4 py-3">
        <div className="flex items-center gap-2">
          <img src={thcLogo} alt="THcontrol" className="h-8 w-8 rounded-lg object-cover" />
          <span className="font-semibold text-sm">THcontrol</span>
          {displayName && (
            <span className="text-xs text-primary font-medium truncate max-w-[110px]">
              · {displayName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {access?.isAdmin && (
            <Link
              to="/admin/usuarios"
              className={cn(
                "text-xs inline-flex items-center gap-1",
                pathname.startsWith("/admin")
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Shield className="h-3.5 w-3.5" /> Admin
            </Link>
          )}
          <button
            onClick={toggleTheme}
            className="text-muted-foreground hover:text-foreground p-1 transition-colors inline-flex items-center"
            title={theme === "dark" ? "Modo Claro" : "Modo Escuro"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setPasswordDialogOpen(true)}
            className="text-xs text-muted-foreground inline-flex items-center gap-1 ml-1 cursor-pointer"
          >
            <KeyRound className="h-3.5 w-3.5" /> Senha
          </button>
          <button
            onClick={signOut}
            className="text-xs text-muted-foreground inline-flex items-center gap-1 ml-1"
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
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
          {nav.map(({ to, label, icon: Icon, color }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            const isYellow = color === "yellow";
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[10px]",
                  active
                    ? isYellow ? "text-yellow-400" : "text-primary"
                    : isYellow ? "text-yellow-500/70" : "text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate max-w-full px-1">{label}</span>
              </Link>
            );
          })}
        </nav>
      </main>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> Alterar minha senha
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="old-password">Senha Antiga</Label>
              <Input
                id="old-password"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Sua senha atual"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Nova Senha</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Digite a senha novamente"
                required
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setPasswordDialogOpen(false)} disabled={changingPassword}>
                Cancelar
              </Button>
              <Button type="submit" disabled={changingPassword}>
                {changingPassword ? "Alterando..." : "Salvar Senha"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}