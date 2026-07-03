
-- =========== COMPRAS ===========
CREATE TABLE public.compras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nf TEXT,
  fornecedor TEXT,
  data_emissao DATE,
  item TEXT,
  quant NUMERIC DEFAULT 1,
  valor_unit NUMERIC DEFAULT 0,
  valor_total NUMERIC DEFAULT 0,
  frota TEXT,
  prazo_pag TEXT,
  tipo TEXT,
  mes TEXT,
  ano INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compras TO anon, authenticated;
GRANT ALL ON public.compras TO service_role;
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public full access compras" ON public.compras FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_compras_data ON public.compras(data_emissao);
CREATE INDEX idx_compras_tipo ON public.compras(tipo);
CREATE INDEX idx_compras_mes_ano ON public.compras(ano, mes);

-- =========== METAS ===========
CREATE TABLE public.metas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria TEXT NOT NULL,
  mes TEXT NOT NULL,
  ano INTEGER NOT NULL,
  valor_meta NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(categoria, mes, ano)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.metas TO anon, authenticated;
GRANT ALL ON public.metas TO service_role;
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public full access metas" ON public.metas FOR ALL USING (true) WITH CHECK (true);

-- =========== FROTAS ===========
CREATE TABLE public.frotas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  placa TEXT,
  tipo TEXT,
  modelo TEXT,
  marca TEXT,
  chassi TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frotas TO anon, authenticated;
GRANT ALL ON public.frotas TO service_role;
ALTER TABLE public.frotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public full access frotas" ON public.frotas FOR ALL USING (true) WITH CHECK (true);

-- =========== COMBUSTIVEL ===========
CREATE TABLE public.combustivel (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL,
  tipo TEXT NOT NULL, -- 'S10' | 'S500'
  movimento TEXT NOT NULL, -- 'ENTRADA' | 'SAIDA' | 'ESTOQUE'
  quantidade NUMERIC NOT NULL DEFAULT 0,
  frota TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.combustivel TO anon, authenticated;
GRANT ALL ON public.combustivel TO service_role;
ALTER TABLE public.combustivel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public full access combustivel" ON public.combustivel FOR ALL USING (true) WITH CHECK (true);

-- =========== GUINCHO ===========
CREATE TABLE public.guincho (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE,
  frota TEXT,
  tipo TEXT,
  modelo TEXT,
  peso_kg NUMERIC,
  problema TEXT,
  endereco_retirada TEXT,
  endereco_entrega TEXT,
  status TEXT DEFAULT 'PENDENTE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guincho TO anon, authenticated;
GRANT ALL ON public.guincho TO service_role;
ALTER TABLE public.guincho ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public full access guincho" ON public.guincho FOR ALL USING (true) WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_compras_updated BEFORE UPDATE ON public.compras FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_metas_updated BEFORE UPDATE ON public.metas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_frotas_updated BEFORE UPDATE ON public.frotas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_combustivel_updated BEFORE UPDATE ON public.combustivel FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_guincho_updated BEFORE UPDATE ON public.guincho FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
