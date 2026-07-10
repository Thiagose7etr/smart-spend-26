import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Apenas administradores podem excluir usuários.");
    if (data.userId === context.userId) {
      throw new Error("Você não pode excluir a própria conta.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runMigrationSQL = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Apenas administradores podem executar esta ação.");

    const dbUrl = process.env.DATABASE_URL || 
                  process.env.SUPABASE_DB_URL || 
                  process.env.POSTGRES_URL || 
                  process.env.DATABASE_PRIVATE_URL;

    if (!dbUrl) {
      throw new Error("DATABASE_URL não está configurada no ambiente do servidor.");
    }

    const { Client } = await import("pg");
    const client = new Client({
      connectionString: dbUrl,
      ssl: {
        rejectUnauthorized: false
      }
    });
    await client.connect();

    try {
      await client.query(`
        -- 1. Criar a tabela de requisições principal
        CREATE TABLE IF NOT EXISTS public.requisicoes (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          numero serial,
          centro_custo text NOT NULL,
          data date NOT NULL DEFAULT current_date,
          solicitante text NOT NULL,
          status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'comprado', 'entregue')),
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );

        -- 2. Criar a tabela para suportar os múltiplos itens
        CREATE TABLE IF NOT EXISTS public.requisicao_itens (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          requisicao_id uuid NOT NULL REFERENCES public.requisicoes(id) ON DELETE CASCADE,
          descricao text NOT NULL,
          quantidade numeric NOT NULL DEFAULT 1,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );

        -- 3. Habilitar a segurança de linha (RLS) nas duas tabelas
        ALTER TABLE public.requisicoes ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.requisicao_itens ENABLE ROW LEVEL SECURITY;

        -- 4. Conceder permissões de acesso
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.requisicoes TO authenticated;
        GRANT ALL ON public.requisicoes TO service_role;

        GRANT SELECT, INSERT, UPDATE, DELETE ON public.requisicao_itens TO authenticated;
        GRANT ALL ON public.requisicao_itens TO service_role;

        -- 5. Vincular triggers para preencher a data de modificação automaticamente
        DROP TRIGGER IF EXISTS trg_requisicoes_updated ON public.requisicoes;
        CREATE TRIGGER trg_requisicoes_updated BEFORE UPDATE ON public.requisicoes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

        DROP TRIGGER IF EXISTS trg_requisicao_itens_updated ON public.requisicao_itens;
        CREATE TRIGGER trg_requisicao_itens_updated BEFORE UPDATE ON public.requisicao_itens FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

        -- 6. Configurar políticas de acesso por usuário
        DROP POLICY IF EXISTS "requisicoes select" ON public.requisicoes;
        CREATE POLICY "requisicoes select" ON public.requisicoes FOR SELECT TO authenticated USING (public.is_active(auth.uid()));

        DROP POLICY IF EXISTS "requisicoes insert" ON public.requisicoes;
        CREATE POLICY "requisicoes insert" ON public.requisicoes FOR INSERT TO authenticated WITH CHECK (public.can_edit_tab(auth.uid(),'requisicoes'));

        DROP POLICY IF EXISTS "requisicoes update" ON public.requisicoes;
        CREATE POLICY "requisicoes update" ON public.requisicoes FOR UPDATE TO authenticated USING (public.can_edit_tab(auth.uid(),'requisicoes')) WITH CHECK (public.can_edit_tab(auth.uid(),'requisicoes'));

        DROP POLICY IF EXISTS "requisicoes delete" ON public.requisicoes;
        CREATE POLICY "requisicoes delete" ON public.requisicoes FOR DELETE TO authenticated USING (public.can_edit_tab(auth.uid(),'requisicoes'));

        DROP POLICY IF EXISTS "requisicao_itens select" ON public.requisicao_itens;
        CREATE POLICY "requisicao_itens select" ON public.requisicao_itens FOR SELECT TO authenticated USING (public.is_active(auth.uid()));

        DROP POLICY IF EXISTS "requisicao_itens insert" ON public.requisicao_itens;
        CREATE POLICY "requisicao_itens insert" ON public.requisicao_itens FOR INSERT TO authenticated WITH CHECK (public.can_edit_tab(auth.uid(),'requisicoes'));

        DROP POLICY IF EXISTS "requisicao_itens update" ON public.requisicao_itens;
        CREATE POLICY "requisicao_itens update" ON public.requisicao_itens FOR UPDATE TO authenticated USING (public.can_edit_tab(auth.uid(),'requisicoes')) WITH CHECK (public.can_edit_tab(auth.uid(),'requisicoes'));

        DROP POLICY IF EXISTS "requisicao_itens delete" ON public.requisicao_itens;
        CREATE POLICY "requisicao_itens delete" ON public.requisicao_itens FOR DELETE TO authenticated USING (public.can_edit_tab(auth.uid(),'requisicoes'));
      `);
      return { ok: true };
    } finally {
      await client.end();
    }
  });

export const resetUserPasswordAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; newPassword: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Apenas administradores podem redefinir senhas.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });