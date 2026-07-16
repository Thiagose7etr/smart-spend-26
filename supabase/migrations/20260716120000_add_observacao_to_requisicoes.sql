-- Adicionar coluna 'observacao' na tabela 'requisicoes'
ALTER TABLE public.requisicoes ADD COLUMN IF NOT EXISTS observacao text;
