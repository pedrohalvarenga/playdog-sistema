-- Rede de segurança multi-empresa (Opção 1)
-- Para TODA tabela que tenha a coluna empresa_id:
--   1. Define DEFAULT = Play Dog (registros novos sem empresa_id não quebram mais)
--   2. Preenche registros antigos que ficaram com empresa_id vazio
-- Quando existir uma segunda empresa de verdade, revisar esses defaults.

DO $$
DECLARE
  r RECORD;
  playdog CONSTANT UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'empresa_id'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN empresa_id SET DEFAULT %L',
      r.table_name, playdog
    );
    EXECUTE format(
      'UPDATE public.%I SET empresa_id = %L WHERE empresa_id IS NULL',
      r.table_name, playdog
    );
    RAISE NOTICE 'Protegida: %', r.table_name;
  END LOOP;
END $$;
