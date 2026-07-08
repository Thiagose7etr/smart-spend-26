import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { clearInvalidAuthSession } from "@/lib/auth-session";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      if (error) await clearInvalidAuthSession();
      throw redirect({ to: "/auth" });
    }
    return { user: session.user };
  },
  component: () => <Outlet />,
});