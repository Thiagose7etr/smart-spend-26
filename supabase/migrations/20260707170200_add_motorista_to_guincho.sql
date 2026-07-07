-- Adicionar colunas de motorista na tabela de guincho
ALTER TABLE public.guincho ADD COLUMN IF NOT EXISTS motorista_nome text;
ALTER TABLE public.guincho ADD COLUMN IF NOT EXISTS motorista_telefone text;
