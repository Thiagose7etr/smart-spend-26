-- Adicionar coluna cotacao jsonb para salvar rascunhos de cotações em requisições
ALTER TABLE public.requisicoes
ADD COLUMN IF NOT EXISTS cotacao jsonb DEFAULT null;
