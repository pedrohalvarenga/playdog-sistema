-- ============================================================
-- PLAY DOG — Módulo Creche v2
-- Execute no Supabase SQL Editor
-- ============================================================

-- Campos novos em pets
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS identificador TEXT,
  ADD COLUMN IF NOT EXISTS saldo_diarias INTEGER NOT NULL DEFAULT 0;

-- Campos novos em tutores
ALTER TABLE public.tutores
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS preco_personalizado NUMERIC(10,2);

-- ============================================================
-- TABELA: compras_diarias (base financeira)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.compras_diarias (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id           UUID NOT NULL REFERENCES public.pets(id) ON DELETE RESTRICT,
  tutor_id         UUID NOT NULL REFERENCES public.tutores(id) ON DELETE RESTRICT,
  quantidade       INTEGER NOT NULL CHECK (quantidade > 0),
  valor_pago       NUMERIC(10,2) NOT NULL DEFAULT 0,
  forma_pagamento  TEXT NOT NULL CHECK (forma_pagamento IN ('pix_pagbank', 'pix_c6', 'dinheiro', 'debito', 'credito')),
  data             DATE NOT NULL DEFAULT CURRENT_DATE,
  observacoes      TEXT,
  registrado_por   UUID REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compras_diarias_pet ON public.compras_diarias(pet_id);
CREATE INDEX IF NOT EXISTS idx_compras_diarias_tutor ON public.compras_diarias(tutor_id);
CREATE INDEX IF NOT EXISTS idx_compras_diarias_data ON public.compras_diarias(data);

-- ============================================================
-- TABELA: ajustes_saldo (ajuste manual — somente admin)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ajustes_saldo (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id          UUID NOT NULL REFERENCES public.pets(id) ON DELETE RESTRICT,
  quantidade      INTEGER NOT NULL,
  motivo          TEXT NOT NULL,
  registrado_por  UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ajustes_saldo_pet ON public.ajustes_saldo(pet_id);

-- ============================================================
-- TABELA: ocorrencias (histórico por pet)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ocorrencias (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id          UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  descricao       TEXT NOT NULL,
  foto_url        TEXT,
  registrado_por  UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ocorrencias_pet ON public.ocorrencias(pet_id);

-- ============================================================
-- TABELA: config_creche (configurações)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.config_creche (
  chave       TEXT PRIMARY KEY,
  valor       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.config_creche (chave, valor) VALUES
  ('capacidade_diaria', '20'),
  ('envio_extrato_automatico', 'false'),
  ('dia_envio_extrato', '1')
ON CONFLICT (chave) DO NOTHING;

-- ============================================================
-- TABELA: precos_padrao (configurados pelo admin)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.precos_padrao (
  plano       TEXT PRIMARY KEY,
  valor       NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.precos_padrao (plano, valor) VALUES
  ('diaria_avulsa', 0),
  ('pacote_semanal', 0),
  ('pacote_mensal', 0)
ON CONFLICT (plano) DO NOTHING;

-- ============================================================
-- TABELA: envios_extrato (log de envios por e-mail)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.envios_extrato (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tutor_id    UUID NOT NULL REFERENCES public.tutores(id) ON DELETE CASCADE,
  mes         INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano         INTEGER NOT NULL,
  enviado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status      TEXT NOT NULL DEFAULT 'enviado',
  erro        TEXT
);

CREATE INDEX IF NOT EXISTS idx_envios_extrato_tutor ON public.envios_extrato(tutor_id);

-- ============================================================
-- FUNÇÃO: fazer_checkin — atômico (presença + decrementa saldo)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fazer_checkin(
  p_pet_id        UUID,
  p_data          DATE,
  p_registrado_por UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_presenca_id UUID;
BEGIN
  INSERT INTO public.presencas (pet_id, data, checkin_at, registrado_por)
  VALUES (p_pet_id, p_data, NOW(), p_registrado_por)
  RETURNING id INTO v_presenca_id;

  UPDATE public.pets
  SET saldo_diarias = saldo_diarias - 1
  WHERE id = p_pet_id;

  RETURN v_presenca_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RLS: compras_diarias
-- ============================================================
ALTER TABLE public.compras_diarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compras_select" ON public.compras_diarias
  FOR SELECT USING (public.get_my_role() IN ('admin', 'recepcao'));

CREATE POLICY "compras_insert" ON public.compras_diarias
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'recepcao'));

-- ============================================================
-- RLS: ajustes_saldo (somente admin)
-- ============================================================
ALTER TABLE public.ajustes_saldo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ajustes_select" ON public.ajustes_saldo
  FOR SELECT USING (public.get_my_role() IN ('admin', 'recepcao'));

CREATE POLICY "ajustes_insert" ON public.ajustes_saldo
  FOR INSERT WITH CHECK (public.get_my_role() = 'admin');

-- ============================================================
-- RLS: ocorrencias
-- ============================================================
ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ocorrencias_select" ON public.ocorrencias
  FOR SELECT USING (public.get_my_role() IN ('admin', 'recepcao', 'banho_tosa'));

CREATE POLICY "ocorrencias_insert" ON public.ocorrencias
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'recepcao'));

-- ============================================================
-- RLS: config_creche (admin gerencia, recepcao visualiza)
-- ============================================================
ALTER TABLE public.config_creche ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_select" ON public.config_creche
  FOR SELECT USING (public.get_my_role() IN ('admin', 'recepcao'));

CREATE POLICY "config_update" ON public.config_creche
  FOR UPDATE USING (public.get_my_role() = 'admin');

-- ============================================================
-- RLS: precos_padrao
-- ============================================================
ALTER TABLE public.precos_padrao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "precos_select" ON public.precos_padrao
  FOR SELECT USING (public.get_my_role() IN ('admin', 'recepcao'));

CREATE POLICY "precos_update" ON public.precos_padrao
  FOR UPDATE USING (public.get_my_role() = 'admin');

-- ============================================================
-- RLS: envios_extrato
-- ============================================================
ALTER TABLE public.envios_extrato ENABLE ROW LEVEL SECURITY;

CREATE POLICY "envios_select" ON public.envios_extrato
  FOR SELECT USING (public.get_my_role() IN ('admin', 'recepcao'));

CREATE POLICY "envios_insert" ON public.envios_extrato
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'recepcao'));
