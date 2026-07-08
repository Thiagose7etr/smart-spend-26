import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { clearInvalidAuthSession } from "@/lib/auth-session";

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
  loading: boolean;
};

// Cache global da sessão para evitar lag/flashing nas transições de rotas
let cachedSession: SessionState = { userId: null, email: null, loading: true };

export function useSession() {
  const [state, setState] = useState<SessionState>(cachedSession);

  useEffect(() => {
    let active = true;

    const setVerifiedUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      if (error) {
        await clearInvalidAuthSession();
        const newState = { userId: null, email: null, loading: false };
        cachedSession = newState;
        if (active) setState(newState);
        return;
      }
      const newState = { userId: data?.user?.id ?? null, email: data?.user?.email ?? null, loading: false };
      cachedSession = newState;
      if (active) setState(newState);
    };

    // Só busca as informações se não estiverem no cache
    if (cachedSession.loading) {
      setVerifiedUser();
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) {
        const newState = { userId: null, email: null, loading: false };
        cachedSession = newState;
        setState(newState);
        return;
      }
      setVerifiedUser();
    });

    return () => {
      active = false;
      if (sub?.subscription) {
        try {
          sub.subscription.unsubscribe();
        } catch (e) {
          console.error("Erro ao desinscrever da sessão auth:", e);
        }
      }
    };
  }, []);

  return state;
}

export function useCurrentUserAccess() {
  const { userId, email, loading: sessionLoading } = useSession();

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
      const hiddenWidgetsList: DashboardWidget[] = [];
      for (const w of (widgetsRes.data ?? []) as { widget: DashboardWidget; hidden: boolean }[]) {
        if (w.hidden) hiddenWidgetsList.push(w.widget);
      }
      const isAdmin = roles.includes("admin");
      const isEditor = roles.includes("editor");
      return {
        profile: profileRes.data as { id: string; email: string; full_name: string | null; status: string } | null,
        roles,
        perms,
        isAdmin,
        isEditor,
        hiddenWidgetsList,
      };
    },
  });

  const accessData = query.data;

  // Reconstruir campos e funções não serializáveis no corpo do hook
  const perms = accessData?.perms ?? {};
  const isAdmin = accessData?.isAdmin ?? false;
  const isEditor = accessData?.isEditor ?? false;
  const hiddenWidgetsList = accessData?.hiddenWidgetsList ?? [];
  const hiddenWidgetsSet = new Set<DashboardWidget>(hiddenWidgetsList);

  const canSeeWidget = (w: DashboardWidget) => isAdmin || !hiddenWidgetsSet.has(w);
  const canEdit = (tab: TabName) => isAdmin || isEditor || !!perms[tab];
  const canView = (tab: TabName) => {
    if (isAdmin || isEditor) return true;
    if (tab === "dashboard") return true;
    return perms[tab] !== undefined;
  };

  const access = accessData
    ? {
        ...accessData,
        canSeeWidget,
        canEdit,
        canView,
      }
    : undefined;

  return {
    userId,
    email,
    loading: sessionLoading || query.isLoading,
    access,
    refetch: query.refetch,
  };
}