-- Alterar o check constraint do status da requisição para incluir o status 'parcial'
ALTER TABLE public.requisicoes DROP CONSTRAINT IF EXISTS requisicoes_status_check;
ALTER TABLE public.requisicoes ADD CONSTRAINT requisicoes_status_check CHECK (status IN ('pendente', 'comprado', 'parcial', 'entregue'));
