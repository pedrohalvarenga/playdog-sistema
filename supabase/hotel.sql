-- ============================================================
-- PLAY DOG — Módulo Hotel
-- Execute no Supabase SQL Editor
-- ============================================================

-- ============================================================
-- TABELA: hospedagens (reservas de hotel)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hospedagens (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id               UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  checkin_previsto     TIMESTAMPTZ NOT NULL,
  checkout_previsto    TIMESTAMPTZ NOT NULL,
  checkin_real         TIMESTAMPTZ,
  checkout_real        TIMESTAMPTZ,
  valor_diaria         NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_total          NUMERIC(10,2),
  valor_extras         NUMERIC(10,2) DEFAULT 0,
  extras_descricao     TEXT,
  observacoes          TEXT,
  status               TEXT NOT NULL DEFAULT 'reservada'
                         CHECK (status IN ('reservada', 'hospedado', 'finalizada', 'cancelada')),
  motivo_cancelamento  TEXT,
  receita_id           UUID REFERENCES public.receitas(id) ON DELETE SET NULL,
  registrado_por       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  alterado_por         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: plantonistas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.plantonistas (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome         TEXT NOT NULL,
  telefone     TEXT,
  valor_noite  NUMERIC(10,2) NOT NULL DEFAULT 0,
  ativo        BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: escala_plantao (uma linha por noite)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.escala_plantao (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data             DATE NOT NULL UNIQUE,
  plantonista_id   UUID REFERENCES public.plantonistas(id) ON DELETE SET NULL,
  valor_noite      NUMERIC(10,2),
  observacoes      TEXT,
  registrado_por   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  alterado_por     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: config_hotel
-- ============================================================
CREATE TABLE IF NOT EXISTS public.config_hotel (
  chave  TEXT PRIMARY KEY,
  valor  TEXT NOT NULL
);

INSERT INTO public.config_hotel (chave, valor) VALUES
  ('capacidade_max',    '10'),
  ('emails_relatorio',  ''),
  ('hora_relatorio',    '08:00')
ON CONFLICT (chave) DO NOTHING;

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS hospedagens_updated_at ON public.hospedagens;
CREATE TRIGGER hospedagens_updated_at
  BEFORE UPDATE ON public.hospedagens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS plantonistas_updated_at ON public.plantonistas;
CREATE TRIGGER plantonistas_updated_at
  BEFORE UPDATE ON public.plantonistas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS escala_plantao_updated_at ON public.escala_plantao;
CREATE TRIGGER escala_plantao_updated_at
  BEFORE UPDATE ON public.escala_plantao
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.hospedagens     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plantonistas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_plantao  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_hotel    ENABLE ROW LEVEL SECURITY;

-- Helper: retorna role do usuário autenticado
CREATE OR REPLACE FUNCTION public.my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- hospedagens: admin e recepcao leem e escrevem; motorista só lê
CREATE POLICY "hospedagens_select" ON public.hospedagens
  FOR SELECT USING (my_role() IN ('admin', 'recepcao', 'motorista'));

CREATE POLICY "hospedagens_insert" ON public.hospedagens
  FOR INSERT WITH CHECK (my_role() IN ('admin', 'recepcao'));

CREATE POLICY "hospedagens_update" ON public.hospedagens
  FOR UPDATE USING (my_role() IN ('admin', 'recepcao'));

CREATE POLICY "hospedagens_delete" ON public.hospedagens
  FOR DELETE USING (my_role() = 'admin');

-- plantonistas: admin e recepcao
CREATE POLICY "plantonistas_select" ON public.plantonistas
  FOR SELECT USING (my_role() IN ('admin', 'recepcao'));

CREATE POLICY "plantonistas_insert" ON public.plantonistas
  FOR INSERT WITH CHECK (my_role() IN ('admin', 'recepcao'));

CREATE POLICY "plantonistas_update" ON public.plantonistas
  FOR UPDATE USING (my_role() IN ('admin', 'recepcao'));

CREATE POLICY "plantonistas_delete" ON public.plantonistas
  FOR DELETE USING (my_role() = 'admin');

-- escala_plantao: admin e recepcao
CREATE POLICY "escala_select" ON public.escala_plantao
  FOR SELECT USING (my_role() IN ('admin', 'recepcao', 'motorista'));

CREATE POLICY "escala_insert" ON public.escala_plantao
  FOR INSERT WITH CHECK (my_role() IN ('admin', 'recepcao'));

CREATE POLICY "escala_update" ON public.escala_plantao
  FOR UPDATE USING (my_role() IN ('admin', 'recepcao'));

CREATE POLICY "escala_delete" ON public.escala_plantao
  FOR DELETE USING (my_role() = 'admin');

-- config_hotel: todos leem, apenas admin escreve
CREATE POLICY "config_hotel_select" ON public.config_hotel
  FOR SELECT USING (my_role() IN ('admin', 'recepcao', 'motorista', 'banho_tosa'));

CREATE POLICY "config_hotel_insert" ON public.config_hotel
  FOR INSERT WITH CHECK (my_role() = 'admin');

CREATE POLICY "config_hotel_update" ON public.config_hotel
  FOR UPDATE USING (my_role() = 'admin');

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_hospedagens_pet_id   ON public.hospedagens(pet_id);
CREATE INDEX IF NOT EXISTS idx_hospedagens_status   ON public.hospedagens(status);
CREATE INDEX IF NOT EXISTS idx_hospedagens_checkin  ON public.hospedagens(checkin_previsto);
CREATE INDEX IF NOT EXISTS idx_hospedagens_checkout ON public.hospedagens(checkout_previsto);
CREATE INDEX IF NOT EXISTS idx_escala_data          ON public.escala_plantao(data);
