-- Adicionar a coluna senha na tabela de perfis para controle do admin
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS senha text;
