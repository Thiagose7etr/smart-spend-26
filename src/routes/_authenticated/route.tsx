import { createFileRoute, Outlet, redirect, isRedirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { clearInvalidAuthSession } from "@/lib/auth-session";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const res = await supabase.auth.getSession();
      const session = res.data?.session;
      if (res.error || !session) {
        if (res.error) await clearInvalidAuthSession();
        throw redirect({ to: "/auth" });
      }
      return { user: session.user };
    } catch (err) {
      if (isRedirect(err)) {
        throw err;
      }
      console.error("Erro de autenticação no beforeLoad:", err);
      throw redirect({ to: "/auth" });
    }
  },
  component: () => <Outlet />,
});