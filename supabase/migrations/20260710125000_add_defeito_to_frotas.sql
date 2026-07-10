-- Adicionar coluna defeito na tabela de frotas
ALTER TABLE public.frotas ADD COLUMN IF NOT EXISTS defeito text;
