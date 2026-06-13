-- ============================================================
-- PLAY DOG — Módulo Adaptação + grupo de reservas no Hotel
-- Execute este script no Supabase SQL Editor
-- ============================================================

-- TABELA: adaptacoes
CREATE TABLE IF NOT EXISTS public.adaptacoes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id   UUID REFERENCES public.empresas(id),
  pet_id       UUID NOT NULL REFERENCES public.pets(id),
  data         DATE NOT NULL,
  hora_entrada TIME NOT NULL,
  hora_saida   TIME,
  status       TEXT NOT NULL DEFAULT 'agendada'
    CHECK (status IN ('agendada','realizada','cancelada')),
  observacoes  TEXT,
  origem       TEXT NOT NULL DEFAULT 'interno'
    CHECK (origem IN ('interno','link')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adaptacoes_data ON public.adaptacoes(data);
CREATE INDEX IF NOT EXISTS idx_adaptacoes_pet  ON public.adaptacoes(pet_id);

DROP TRIGGER IF EXISTS trg_adaptacoes_updated_at ON public.adaptacoes;
CREATE TRIGGER trg_adaptacoes_updated_at
  BEFORE UPDATE ON public.adaptacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.adaptacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adapt_select" ON public.adaptacoes;
CREATE POLICY "adapt_select" ON public.adaptacoes
  FOR SELECT USING (get_my_role() IN ('admin','recepcao','banho_tosa'));

DROP POLICY IF EXISTS "adapt_insert" ON public.adaptacoes;
CREATE POLICY "adapt_insert" ON public.adaptacoes
  FOR INSERT WITH CHECK (get_my_role() IN ('admin','recepcao'));

DROP POLICY IF EXISTS "adapt_update" ON public.adaptacoes;
CREATE POLICY "adapt_update" ON public.adaptacoes
  FOR UPDATE USING (get_my_role() IN ('admin','recepcao'));

DROP POLICY IF EXISTS "adapt_delete" ON public.adaptacoes;
CREATE POLICY "adapt_delete" ON public.adaptacoes
  FOR DELETE USING (get_my_role() = 'admin');

-- HOTEL: agrupa reservas de irmãos (mesmo tutor, hospedados juntos)
ALTER TABLE public.hospedagens ADD COLUMN IF NOT EXISTS grupo_id UUID;
CREATE INDEX IF NOT EXISTS idx_hospedagens_grupo ON public.hospedagens(grupo_id);
