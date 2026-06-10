-- Áreas de serviço do pet (múltiplas): creche, hotel, banho_tosa, adaptacao
ALTER TABLE pets
  ADD COLUMN IF NOT EXISTS areas_servico TEXT[] DEFAULT '{}';

-- Garante que colunas de vacinas são TEXT (para permitir 'NAO_VACINADO')
ALTER TABLE pets
  ALTER COLUMN vacina_v8_v10   TYPE TEXT USING vacina_v8_v10::TEXT,
  ALTER COLUMN vacina_antirabica TYPE TEXT USING vacina_antirabica::TEXT,
  ALTER COLUMN vacina_gripe    TYPE TEXT USING vacina_gripe::TEXT;

-- Coluna de data no abastecimento (para quando IA preencher data do cupom)
ALTER TABLE abastecimentos
  ADD COLUMN IF NOT EXISTS data DATE DEFAULT CURRENT_DATE;
