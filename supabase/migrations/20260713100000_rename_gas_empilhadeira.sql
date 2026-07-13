-- Renomear a categoria de GAS EMPILHADEIRA para GAS DE EMPILHADEIRA nas tabelas do Supabase
UPDATE public.compras 
SET tipo = 'GAS DE EMPILHADEIRA' 
WHERE tipo = 'GAS EMPILHADEIRA';

UPDATE public.metas 
SET categoria = 'GAS DE EMPILHADEIRA' 
WHERE categoria = 'GAS EMPILHADEIRA';
