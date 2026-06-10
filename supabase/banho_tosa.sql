-- ============================================================
-- PLAY DOG â€” MÃ³dulo Banho & Tosa + Transportes
-- Execute este script no Supabase SQL Editor
-- ============================================================

-- ============================================================
-- TABELA: agendamentos_banho_tosa
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agendamentos_banho_tosa (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id                UUID NOT NULL REFERENCES public.pets(id),
  data                  DATE NOT NULL,
  hora_chegada          TIME NOT NULL,
  hora_saida_prevista   TIME,
  hora_chegada_real     TIMESTAMPTZ,
  hora_saida_real       TIMESTAMPTZ,
  descricao_servico     TEXT NOT NULL,
  valor_servico         NUMERIC(12,2),
  taxi_dog              BOOLEAN NOT NULL DEFAULT false,
  taxi_tipo             TEXT CHECK (taxi_tipo IN ('buscar','levar','ambos')),
  taxi_endereco         TEXT,
  valor_taxi            NUMERIC(12,2),
  status                TEXT NOT NULL DEFAULT 'agendado'
    CHECK (status IN ('agendado','em_atendimento','pronto','entregue','cancelado')),
  motivo_cancelamento   TEXT,
  observacoes           TEXT,
  receita_servico_id    UUID REFERENCES public.receitas(id),
  receita_taxi_id       UUID REFERENCES public.receitas(id),
  registrado_por        UUID REFERENCES public.profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agendamentos_bt_data   ON public.agendamentos_banho_tosa(data);
CREATE INDEX IF NOT EXISTS idx_agendamentos_bt_pet    ON public.agendamentos_banho_tosa(pet_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_bt_status ON public.agendamentos_banho_tosa(status);

-- ============================================================
-- TABELA: transportes
-- GenÃ©rica â€” suporta banho_tosa agora; hotel e creche no futuro.
-- origem_id aponta para o registro de origem (agendamento, hospedagem, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transportes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  origem      TEXT NOT NULL CHECK (origem IN ('banho_tosa','hotel','creche')),
  origem_id   UUID NOT NULL,
  pet_id      UUID NOT NULL REFERENCES public.pets(id),
  data        DATE NOT NULL,
  horario     TIME,
  tipo        TEXT NOT NULL CHECK (tipo IN ('buscar','levar')),
  endereco    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','em_rota','concluido','cancelado')),
  observacoes TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transportes_data    ON public.transportes(data);
CREATE INDEX IF NOT EXISTS idx_transportes_status  ON public.transportes(status);
CREATE INDEX IF NOT EXISTS idx_transportes_origem  ON public.transportes(origem_id);

-- ============================================================
-- TRIGGER: mantÃ©m updated_at atualizado
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agendamentos_bt_updated_at ON public.agendamentos_banho_tosa;
CREATE TRIGGER trg_agendamentos_bt_updated_at
  BEFORE UPDATE ON public.agendamentos_banho_tosa
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.agendamentos_banho_tosa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transportes              ENABLE ROW LEVEL SECURITY;

-- agendamentos_banho_tosa
CREATE POLICY "bt_agend_select" ON public.agendamentos_banho_tosa
  FOR SELECT USING (get_my_role() IN ('admin','recepcao','banho_tosa'));

CREATE POLICY "bt_agend_insert" ON public.agendamentos_banho_tosa
  FOR INSERT WITH CHECK (get_my_role() IN ('admin','recepcao'));

CREATE POLICY "bt_agend_update" ON public.agendamentos_banho_tosa
  FOR UPDATE USING (get_my_role() IN ('admin','recepcao','banho_tosa'));

CREATE POLICY "bt_agend_delete" ON public.agendamentos_banho_tosa
  FOR DELETE USING (get_my_role() = 'admin');

-- transportes
CREATE POLICY "transp_select" ON public.transportes
  FOR SELECT USING (get_my_role() IN ('admin','recepcao','banho_tosa','motorista'));

CREATE POLICY "transp_insert" ON public.transportes
  FOR INSERT WITH CHECK (get_my_role() IN ('admin','recepcao'));

CREATE POLICY "transp_update" ON public.transportes
  FOR UPDATE USING (get_my_role() IN ('admin','recepcao','motorista'));

CREATE POLICY "transp_delete" ON public.transportes
  FOR DELETE USING (get_my_role() = 'admin');

