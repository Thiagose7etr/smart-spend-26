import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "editor" | "viewer";
export type TabName = "dashboard" | "compras" | "metas" | "frotas" | "combustivel" | "guincho";
export type DashboardWidget =
  | "kpis"
  | "gasto-meta"
  | "top-categorias"
  | "evolucao"
  | "top-fornecedores";

export const DASHBOARD_WIDGETS: { key: DashboardWidget; label: string }[] = [
  { key: "kpis", label: "Indicadores (KPIs)" },
  { key: "gasto-meta", label: "Gasto x Meta por mês" },
  { key: "top-categorias", label: "Top categorias" },
  { key: "evolucao", label: "Evolução mensal" },
  { key: "top-fornecedores", label: "Top fornecedores" },
];

export type SessionState = {
  userId: string | null;
  email: string | null;
};

export function useSession() {
  const [state, setState] = useState<SessionState>({ userId: null, email: null });
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setState({ userId: data.user?.id ?? null, email: data.user?.email ?? null });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setState({ userId: session?.user?.id ?? null, email: session?.user?.email ?? null });
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return state;
}

export function useCurrentUserAccess() {
  const { userId, email } = useSession();

  const query = useQuery({
    enabled: !!userId,
    queryKey: ["me-access", userId],
    queryFn: async () => {
      const [profileRes, rolesRes, permsRes, widgetsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId!).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId!),
        supabase.from("user_tab_permissions").select("tab, can_edit").eq("user_id", userId!),
        supabase
          .from("user_dashboard_widgets")
          .select("widget, hidden")
          .eq("user_id", userId!),
      ]);
      const roles = ((rolesRes.data ?? []) as { role: AppRole }[]).map((r) => r.role);
      const perms: Partial<Record<TabName, boolean>> = {};
      for (const p of (permsRes.data ?? []) as { tab: TabName; can_edit: boolean }[]) {
        perms[p.tab] = p.can_edit;
      }
      const hiddenWidgets = new Set<DashboardWidget>();
      for (const w of (widgetsRes.data ?? []) as { widget: DashboardWidget; hidden: boolean }[]) {
        if (w.hidden) hiddenWidgets.add(w.widget);
      }
      const isAdmin = roles.includes("admin");
      const isEditor = roles.includes("editor");
      return {
        profile: profileRes.data as { id: string; email: string; full_name: string | null; status: string } | null,
        roles,
        perms,
        isAdmin,
        isEditor,
        hiddenWidgets,
        canSeeWidget: (w: DashboardWidget) => isAdmin || !hiddenWidgets.has(w),
        canEdit: (tab: TabName) => isAdmin || isEditor || !!perms[tab],
        canView: (tab: TabName) => {
          if (isAdmin || isEditor) return true;
          if (tab === "dashboard") return true;
          return perms[tab] !== undefined;
        },
      };
    },
  });

  return {
    userId,
    email,
    loading: query.isLoading,
    access: query.data,
    refetch: query.refetch,
  };
}