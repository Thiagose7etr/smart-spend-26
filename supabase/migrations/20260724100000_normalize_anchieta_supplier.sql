-- Normalizar nome do fornecedor 'Anchieta' nas despesas de compras
UPDATE public.compras
SET fornecedor = 'ANCHIETA PEÇAS'
WHERE UPPER(TRIM(fornecedor)) IN ('ANCHIETA', 'ANCHEITA', 'ANCHIETA PECAS', 'ANCHIETA PEÇAS');
