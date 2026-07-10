-- Alterar tabela frotas para adicionar status
ALTER TABLE public.frotas ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'liberado' CHECK (status IN ('liberado', 'manutencao'));

-- Criar tabela de requisições
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

-- Criar tabela de itens de requisição
CREATE TABLE IF NOT EXISTS public.requisicao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisicao_id uuid NOT NULL REFERENCES public.requisicoes(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.requisicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requisicao_itens ENABLE ROW LEVEL SECURITY;

-- Conceder permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requisicoes TO authenticated;
GRANT ALL ON public.requisicoes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.requisicao_itens TO authenticated;
GRANT ALL ON public.requisicao_itens TO service_role;

-- Triggers de updated_at
CREATE TRIGGER trg_requisicoes_updated BEFORE UPDATE ON public.requisicoes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_requisicao_itens_updated BEFORE UPDATE ON public.requisicao_itens FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Políticas RLS
CREATE POLICY "requisicoes select" ON public.requisicoes FOR SELECT TO authenticated USING (public.is_active(auth.uid()));
CREATE POLICY "requisicoes insert" ON public.requisicoes FOR INSERT TO authenticated WITH CHECK (public.can_edit_tab(auth.uid(),'requisicoes'));
CREATE POLICY "requisicoes update" ON public.requisicoes FOR UPDATE TO authenticated USING (public.can_edit_tab(auth.uid(),'requisicoes')) WITH CHECK (public.can_edit_tab(auth.uid(),'requisicoes'));
CREATE POLICY "requisicoes delete" ON public.requisicoes FOR DELETE TO authenticated USING (public.can_edit_tab(auth.uid(),'requisicoes'));

CREATE POLICY "requisicao_itens select" ON public.requisicao_itens FOR SELECT TO authenticated USING (public.is_active(auth.uid()));
CREATE POLICY "requisicao_itens insert" ON public.requisicao_itens FOR INSERT TO authenticated WITH CHECK (public.can_edit_tab(auth.uid(),'requisicoes'));
CREATE POLICY "requisicao_itens update" ON public.requisicao_itens FOR UPDATE TO authenticated USING (public.can_edit_tab(auth.uid(),'requisicoes')) WITH CHECK (public.can_edit_tab(auth.uid(),'requisicoes'));
CREATE POLICY "requisicao_itens delete" ON public.requisicao_itens FOR DELETE TO authenticated USING (public.can_edit_tab(auth.uid(),'requisicoes'));
