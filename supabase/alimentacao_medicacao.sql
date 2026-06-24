-- ============================================================
-- PLAY DOG — Alimentação & Medicação (registro diário por pet)
-- Execute este script COMPLETO no Supabase SQL Editor.
-- Registra, por cão e por dia, o status de cada refeição
-- (café / almoço / janta), a instrução da refeição e a medicação.
-- Vale para cães da creche e do hotel.
-- Pode ser executado mais de uma vez sem causar erro.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.registros_alimentacao (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id             UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  data               DATE NOT NULL,
  local              TEXT NOT NULL CHECK (local IN ('creche','hotel')),
  status_cafe        TEXT CHECK (status_cafe   IN ('comeu','ainda_nao','nao_quis_1x','nao_quis_2x')),
  status_almoco      TEXT CHECK (status_almoco IN ('comeu','ainda_nao','nao_quis_1x','nao_quis_2x')),
  status_janta       TEXT CHECK (status_janta  IN ('comeu','ainda_nao','nao_quis_1x','nao_quis_2x')),
  instrucao_refeicao TEXT,
  medicacao          TEXT,
  sem_alimentacao    BOOLEAN NOT NULL DEFAULT false,  -- creche: o cão não levou ração neste dia
  cafe_off           BOOLEAN NOT NULL DEFAULT false,  -- refeição não se aplica a este cão
  almoco_off         BOOLEAN NOT NULL DEFAULT false,
  janta_off          BOOLEAN NOT NULL DEFAULT false,
  empresa_id         UUID DEFAULT '00000000-0000-0000-0000-000000000001',
  registrado_por     UUID REFERENCES public.profiles(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pet_id, data)
);

-- Colunas adicionadas nesta versão (idempotente, caso a tabela já exista)
ALTER TABLE public.registros_alimentacao
  ADD COLUMN IF NOT EXISTS sem_alimentacao BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cafe_off        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS almoco_off      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS janta_off       BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_reg_alim_data ON public.registros_alimentacao(data);
CREATE INDEX IF NOT EXISTS idx_reg_alim_pet  ON public.registros_alimentacao(pet_id);

-- Trigger de updated_at (a função set_updated_at já existe no banco)
DROP TRIGGER IF EXISTS trg_reg_alim_updated_at ON public.registros_alimentacao;
CREATE TRIGGER trg_reg_alim_updated_at
  BEFORE UPDATE ON public.registros_alimentacao
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RLS — todos os perfis operacionais podem ver e registrar
-- (admin, recepção, banho_tosa e motorista). Sem acesso ao financeiro.
-- ============================================================
ALTER TABLE public.registros_alimentacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reg_alim_select" ON public.registros_alimentacao;
CREATE POLICY "reg_alim_select" ON public.registros_alimentacao
  FOR SELECT USING (get_my_role() IN ('admin','recepcao','banho_tosa','motorista'));

DROP POLICY IF EXISTS "reg_alim_insert" ON public.registros_alimentacao;
CREATE POLICY "reg_alim_insert" ON public.registros_alimentacao
  FOR INSERT WITH CHECK (get_my_role() IN ('admin','recepcao','banho_tosa','motorista'));

DROP POLICY IF EXISTS "reg_alim_update" ON public.registros_alimentacao;
CREATE POLICY "reg_alim_update" ON public.registros_alimentacao
  FOR UPDATE USING (get_my_role() IN ('admin','recepcao','banho_tosa','motorista'));
