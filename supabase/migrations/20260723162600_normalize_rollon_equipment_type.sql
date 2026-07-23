-- Normalizar tipo de equipamento 'rollon' para 'ROLL ON/OFF' nas tabelas frotas e guincho
UPDATE public.frotas
SET tipo = 'ROLL ON/OFF'
WHERE UPPER(TRIM(tipo)) IN ('ROLLON', 'ROLL-ON', 'ROLL ON', 'ROLL ON OFF', 'ROLL ON/OFF');

UPDATE public.guincho
SET tipo = 'ROLL ON/OFF'
WHERE UPPER(TRIM(tipo)) IN ('ROLLON', 'ROLL-ON', 'ROLL ON', 'ROLL ON OFF', 'ROLL ON/OFF');
