import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  useCurrentUserAccess,
  DASHBOARD_WIDGETS,
  type AppRole,
  type TabName,
  type DashboardWidget,
} from "@/hooks/use-auth";
import { deleteUserAccount, runMigrationSQL } from "@/lib/admin.functions";
import { Shield, Trash2, Settings2, Users, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: AdminUsersPage,
});

const TABS: { key: TabName; label: string }[] = [
  { key: "compras", label: "Compras" },
  { key: "metas", label: "Metas" },
  { key: "frotas", label: "Frotas" },
  { key: "combustivel", label: "Combustível" },
  { key: "guincho", label: "Guincho" },
  { key: "requisicoes", label: "Requisições" },
];

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  status: "pending" | "active" | "inactive";
  created_at: string;
};

function AdminUsersPage() {
  const navigate = useNavigate();
  const { access, loading } = useCurrentUserAccess();
  const qc = useQueryClient();
  const deleteFn = useServerFn(deleteUserAccount);
  const [permsUserId, setPermsUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && access && !access.isAdmin) {
      toast.error("Acesso restrito a administradores.");
      navigate({ to: "/" });
    }
  }, [access, loading, navigate]);

  const users = useQuery({
    enabled: !!access?.isAdmin,
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [profs, roles] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (profs.error) throw profs.error;
      if (roles.error) throw roles.error;
      const rolesByUser = new Map<string, AppRole[]>();
      for (const r of (roles.data ?? []) as { user_id: string; role: AppRole }[]) {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push(r.role);
        rolesByUser.set(r.user_id, arr);
      }
      return (profs.data as ProfileRow[]).map((p) => ({
        ...p,
        roles: rolesByUser.get(p.id) ?? [],
      }));
    },
  });

  const settings = useQuery({
    enabled: !!access?.isAdmin,
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data as { id: number; max_accounts: number; require_approval: boolean };
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (payload: { max_accounts?: number; require_approval?: boolean }) => {
      const { error } = await supabase.from("app_settings").update(payload).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-settings"] });
      toast.success("Configuração salva.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      // remove all roles then set the one
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Papel atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      await deleteFn({ data: { userId } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Usuário excluído.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runMigration = useMutation({
    mutationFn: async () => {
      await runMigrationSQL();
    },
    onSuccess: () => {
      toast.success("Tabelas de Requisições configuradas com sucesso no Supabase!");
    },
    onError: (e: Error) => {
      toast.error(`Erro ao configurar tabelas: ${e.message}`);
    },
  });

  if (loading || !access?.isAdmin) {
    return (
      <AppShell>
        <div className="text-sm text-muted-foreground">Carregando…</div>
      </AppShell>
    );
  }

  const total = users.data?.length ?? 0;
  const ativos = users.data?.filter((u) => u.status === "active").length ?? 0;
  const pendentes = users.data?.filter((u) => u.status === "pending").length ?? 0;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" /> Administração de usuários
            </h1>
            <p className="text-sm text-muted-foreground">
              Aprove cadastros, defina papéis e libere permissões por aba.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Button
              onClick={() => runMigration.mutate()}
              disabled={runMigration.isPending}
              variant="outline"
              size="sm"
              className="text-xs border-primary/40 hover:bg-primary/10 text-primary cursor-pointer h-7"
            >
              {runMigration.isPending ? "Configurando..." : "Configurar Tabelas de Requisições"}
            </Button>
            <Badge variant="outline">Total: {total}</Badge>
            <Badge className="bg-primary/20 text-primary border-primary/30">Ativos: {ativos}</Badge>
            <Badge variant="outline" className="border-amber-500/40 text-amber-400">
              Pendentes: {pendentes}
            </Badge>
          </div>
        </div>

        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings2 className="h-4 w-4 text-primary" /> Configurações de acesso
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="max">Limite máximo de contas</Label>
              <Input
                id="max"
                type="number"
                min={1}
                value={settings.data?.max_accounts ?? 0}
                onChange={(e) =>
                  qc.setQueryData(["app-settings"], {
                    ...(settings.data ?? {}),
                    max_accounts: Number(e.target.value),
                  })
                }
                onBlur={(e) => updateSettings.mutate({ max_accounts: Number(e.target.value) })}
              />
              <p className="text-[11px] text-muted-foreground">
                Cadastros acima desse número são bloqueados. Total atual: {total}.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Aprovação manual</Label>
              <div className="flex items-center gap-3 h-10">
                <Switch
                  checked={!!settings.data?.require_approval}
                  onCheckedChange={(v) => updateSettings.mutate({ require_approval: v })}
                />
                <span className="text-sm text-muted-foreground">
                  {settings.data?.require_approval
                    ? "Novos usuários ficam pendentes"
                    : "Novos usuários já entram ativos"}
                </span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground bg-card/50 rounded-lg p-3 border border-border/60">
              <div className="font-semibold text-foreground mb-1">Regras de e-mail</div>
              Apenas <span className="text-primary">@translix.com.br</span> pode se cadastrar.
              Administrador: thiagovirtualy.tr@gmail.com.
            </div>
          </CardContent>
        </Card>

        {/* Users list */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" /> Usuários
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">Usuário</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Papel</th>
                  <th className="py-2 pr-3">Cadastro</th>
                  <th className="py-2 pr-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.data?.map((u) => {
                  const currentRole = u.roles[0] ?? "viewer";
                  return (
                    <tr key={u.id} className="border-b border-border/50">
                      <td className="py-3 pr-3">
                        <div className="font-medium">{u.full_name || u.email}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="py-3 pr-3">
                        <Select
                          value={u.status}
                          onValueChange={(v) => setStatus.mutate({ id: u.id, status: v })}
                        >
                          <SelectTrigger className="h-8 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Ativo</SelectItem>
                            <SelectItem value="pending">Pendente</SelectItem>
                            <SelectItem value="inactive">Inativo</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-3 pr-3">
                        <Select
                          value={currentRole}
                          onValueChange={(v) => setRole.mutate({ userId: u.id, role: v as AppRole })}
                        >
                          <SelectTrigger className="h-8 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-3 pr-3 text-xs text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-3 pr-3 text-right">
                        <div className="inline-flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPermsUserId(u.id)}
                          >
                            Permissões
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(`Excluir ${u.email}? Esta ação é irreversível.`))
                                deleteUser.mutate(u.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <PermissionsDialog
        userId={permsUserId}
        onClose={() => setPermsUserId(null)}
      />
    </AppShell>
  );
}

function PermissionsDialog({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const perms = useQuery({
    enabled: !!userId,
    queryKey: ["user-perms", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_tab_permissions")
        .select("tab, can_edit")
        .eq("user_id", userId!);
      if (error) throw error;
      const map: Record<string, { has: boolean; can_edit: boolean }> = {};
      for (const t of TABS) map[t.key] = { has: false, can_edit: false };
      for (const p of (data ?? []) as { tab: string; can_edit: boolean }[]) {
        map[p.tab] = { has: true, can_edit: p.can_edit };
      }
      return map;
    },
  });

  const widgets = useQuery({
    enabled: !!userId,
    queryKey: ["user-widgets", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_dashboard_widgets")
        .select("widget, hidden")
        .eq("user_id", userId!);
      if (error) throw error;
      const map: Record<DashboardWidget, boolean> = {
        kpis: true,
        "gasto-meta": true,
        "top-categorias": true,
        evolucao: true,
        "top-fornecedores": true,
      };
      for (const w of (data ?? []) as { widget: DashboardWidget; hidden: boolean }[]) {
        map[w.widget] = !w.hidden;
      }
      return map;
    },
  });

  const setWidget = useMutation({
    mutationFn: async ({ widget, visible }: { widget: DashboardWidget; visible: boolean }) => {
      if (!userId) return;
      const { error } = await supabase
        .from("user_dashboard_widgets")
        .upsert(
          { user_id: userId, widget, hidden: !visible },
          { onConflict: "user_id,widget" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-widgets", userId] });
      toast.success("Dashboard atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upsert = useMutation({
    mutationFn: async ({ tab, has, can_edit }: { tab: string; has: boolean; can_edit: boolean }) => {
      if (!userId) return;
      if (!has) {
        const { error } = await supabase
          .from("user_tab_permissions")
          .delete()
          .eq("user_id", userId)
          .eq("tab", tab);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_tab_permissions")
          .upsert({ user_id: userId, tab, can_edit }, { onConflict: "user_id,tab" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-perms", userId] });
      toast.success("Permissão atualizada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Permissões do usuário</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          Admins e editores têm acesso total. Para viewers, marque aqui as abas que podem ver/editar.
        </p>
        <div className="space-y-3 mt-2">
          {TABS.map((t) => {
            const p = perms.data?.[t.key] ?? { has: false, can_edit: false };
            return (
              <div
                key={t.key}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3"
              >
                <div className="text-sm font-medium">{t.label}</div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs">
                    <Switch
                      checked={p.has}
                      onCheckedChange={(v) =>
                        upsert.mutate({ tab: t.key, has: v, can_edit: p.can_edit })
                      }
                    />
                    Visualizar
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <Switch
                      checked={p.can_edit}
                      disabled={!p.has}
                      onCheckedChange={(v) =>
                        upsert.mutate({ tab: t.key, has: true, can_edit: v })
                      }
                    />
                    Editar
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6">
          <div className="flex items-center gap-2 mb-2">
            <LayoutDashboard className="h-4 w-4 text-primary" />
            <div className="text-sm font-semibold">Blocos do Dashboard</div>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Escolha quais blocos este usuário vê na tela inicial. Admins sempre veem tudo.
          </p>
          <div className="space-y-2">
            {DASHBOARD_WIDGETS.map((w) => {
              const visible = widgets.data?.[w.key] ?? true;
              return (
                <div
                  key={w.key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3"
                >
                  <div className="text-sm">{w.label}</div>
                  <label className="flex items-center gap-2 text-xs">
                    <Switch
                      checked={visible}
                      onCheckedChange={(v) => setWidget.mutate({ widget: w.key, visible: v })}
                    />
                    Visível
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}