-- ============================================================
-- PLAY DOG — Módulo Veterinário (agendamentos de atendimento)
-- Execute este script COMPLETO no Supabase SQL Editor.
-- Simples: apenas marca atendimentos veterinários (sem financeiro).
-- Pode ser executado mais de uma vez sem causar erro.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.agendamentos_veterinario (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id               UUID NOT NULL REFERENCES public.pets(id),
  data                 DATE NOT NULL,
  hora                 TIME,
  motivo               TEXT NOT NULL,
  observacoes          TEXT,
  status               TEXT NOT NULL DEFAULT 'agendado'
    CHECK (status IN ('agendado','realizado','cancelado')),
  motivo_cancelamento  TEXT,
  registrado_por       UUID REFERENCES public.profiles(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agend_vet_data   ON public.agendamentos_veterinario(data);
CREATE INDEX IF NOT EXISTS idx_agend_vet_pet    ON public.agendamentos_veterinario(pet_id);
CREATE INDEX IF NOT EXISTS idx_agend_vet_status ON public.agendamentos_veterinario(status);

-- Trigger de updated_at (a função set_updated_at já existe no banco)
DROP TRIGGER IF EXISTS trg_agend_vet_updated_at ON public.agendamentos_veterinario;
CREATE TRIGGER trg_agend_vet_updated_at
  BEFORE UPDATE ON public.agendamentos_veterinario
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RLS — mesmo padrão do Banho & Tosa (admin e recepção)
-- ============================================================
ALTER TABLE public.agendamentos_veterinario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vet_agend_select" ON public.agendamentos_veterinario;
CREATE POLICY "vet_agend_select" ON public.agendamentos_veterinario
  FOR SELECT USING (get_my_role() IN ('admin','recepcao'));

DROP POLICY IF EXISTS "vet_agend_insert" ON public.agendamentos_veterinario;
CREATE POLICY "vet_agend_insert" ON public.agendamentos_veterinario
  FOR INSERT WITH CHECK (get_my_role() IN ('admin','recepcao'));

DROP POLICY IF EXISTS "vet_agend_update" ON public.agendamentos_veterinario;
CREATE POLICY "vet_agend_update" ON public.agendamentos_veterinario
  FOR UPDATE USING (get_my_role() IN ('admin','recepcao'));

DROP POLICY IF EXISTS "vet_agend_delete" ON public.agendamentos_veterinario;
CREATE POLICY "vet_agend_delete" ON public.agendamentos_veterinario
  FOR DELETE USING (get_my_role() = 'admin');
