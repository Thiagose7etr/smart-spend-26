import { supabase } from "@/integrations/supabase/client";

export async function clearInvalidAuthSession() {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // If the stored refresh token is already invalid, clear the browser copy manually.
  }

  if (typeof window === "undefined") return;
  for (const key of Object.keys(window.localStorage)) {
    if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
      window.localStorage.removeItem(key);
    }
  }
}