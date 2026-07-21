-- Permitir o status 'inativo' na tabela public.frotas
ALTER TABLE public.frotas DROP CONSTRAINT IF EXISTS frotas_status_check;
ALTER TABLE public.frotas ADD CONSTRAINT frotas_status_check CHECK (status IN ('liberado', 'manutencao', 'inativo'));
