-- ============================================================
-- PLAY DOG — Módulo Transporte (Taxi Dog)
-- Execute este script COMPLETO no Supabase SQL Editor.
-- Ele já inclui as tabelas do módulo Banho & Tosa (que ainda
-- não haviam sido criadas no banco) e expande a tabela genérica
-- de transportes com rotas, veículo e abastecimentos.
-- Pode ser executado mais de uma vez sem causar erro.
-- ============================================================

-- ============================================================
-- 1. TABELA: agendamentos_banho_tosa (módulo 5)
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
-- 2. TABELA: rotas (uma coleta e uma entrega por dia)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rotas (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data                 DATE NOT NULL,
  tipo                 TEXT NOT NULL CHECK (tipo IN ('coleta','entrega')),
  status               TEXT NOT NULL DEFAULT 'planejada'
    CHECK (status IN ('planejada','em_andamento','finalizada')),
  endereco_partida     TEXT,
  km_inicial           NUMERIC(10,1),
  km_final             NUMERIC(10,1),
  distancia_total_km   NUMERIC(8,2),
  duracao_estimada_min INTEGER,
  otimizada            BOOLEAN NOT NULL DEFAULT false,
  iniciada_em          TIMESTAMPTZ,
  finalizada_em        TIMESTAMPTZ,
  motorista_id         UUID REFERENCES public.profiles(id),
  criada_por           UUID REFERENCES public.profiles(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (data, tipo)
);

CREATE INDEX IF NOT EXISTS idx_rotas_data ON public.rotas(data);

-- ============================================================
-- 3. TABELA: transportes (genérica do módulo 5, expandida)
-- tipo 'buscar' = IDA (rota de coleta, manhã)
-- tipo 'levar'  = VOLTA (rota de entrega, tarde)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transportes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  origem      TEXT NOT NULL CHECK (origem IN ('banho_tosa','hotel','creche')),
  origem_id   UUID,
  pet_id      UUID NOT NULL REFERENCES public.pets(id),
  data        DATE NOT NULL,
  horario     TIME,
  tipo        TEXT NOT NULL CHECK (tipo IN ('buscar','levar')),
  endereco    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pendente',
  observacoes TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Expansão (caso a tabela já exista com o formato antigo)
ALTER TABLE public.transportes ALTER COLUMN origem_id DROP NOT NULL;
ALTER TABLE public.transportes
  ADD COLUMN IF NOT EXISTS meio              TEXT NOT NULL DEFAULT 'playdog' CHECK (meio IN ('playdog','tutor')),
  ADD COLUMN IF NOT EXISTS telefone          TEXT,
  ADD COLUMN IF NOT EXISTS rota_id           UUID REFERENCES public.rotas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ordem             INTEGER,
  ADD COLUMN IF NOT EXISTS concluido_em      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS concluido_por     UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS motivo_imprevisto TEXT,
  ADD COLUMN IF NOT EXISTS distancia_km      NUMERIC(8,2);

-- Status ganha o valor 'imprevisto'
ALTER TABLE public.transportes DROP CONSTRAINT IF EXISTS transportes_status_check;
ALTER TABLE public.transportes ADD CONSTRAINT transportes_status_check
  CHECK (status IN ('pendente','em_rota','concluido','imprevisto','cancelado'));

CREATE INDEX IF NOT EXISTS idx_transportes_data   ON public.transportes(data);
CREATE INDEX IF NOT EXISTS idx_transportes_status ON public.transportes(status);
CREATE INDEX IF NOT EXISTS idx_transportes_origem ON public.transportes(origem_id);
CREATE INDEX IF NOT EXISTS idx_transportes_rota   ON public.transportes(rota_id);

-- ============================================================
-- 4. TABELA: abastecimentos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.abastecimentos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  km_painel     NUMERIC(10,1) NOT NULL,
  litros        NUMERIC(8,2) NOT NULL,
  valor_total   NUMERIC(12,2) NOT NULL,
  cupom_url     TEXT,
  motorista_id  UUID REFERENCES public.profiles(id),
  despesa_id    UUID REFERENCES public.despesas(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_abastecimentos_data ON public.abastecimentos(data);

-- ============================================================
-- 5. TABELA: manutencoes_veiculo
-- ============================================================
CREATE TABLE IF NOT EXISTS public.manutencoes_veiculo (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data            DATE NOT NULL DEFAULT CURRENT_DATE,
  descricao       TEXT NOT NULL,
  valor           NUMERIC(12,2) NOT NULL,
  km              NUMERIC(10,1),
  despesa_id      UUID REFERENCES public.despesas(id),
  registrado_por  UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. TABELA: config_transporte
-- ============================================================
CREATE TABLE IF NOT EXISTS public.config_transporte (
  chave       TEXT PRIMARY KEY,
  valor       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.config_transporte (chave, valor) VALUES
  ('endereco_partida', 'Play Dog, Juiz de Fora - MG'),
  ('pagamento_motorista_valor', '350')
ON CONFLICT (chave) DO NOTHING;

-- ============================================================
-- 7. ROW LEVEL SECURITY
-- (usa public.get_my_role(), criada no schema da Fase 1)
-- ============================================================
ALTER TABLE public.agendamentos_banho_tosa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transportes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rotas                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abastecimentos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manutencoes_veiculo     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_transporte       ENABLE ROW LEVEL SECURITY;

-- agendamentos_banho_tosa
DROP POLICY IF EXISTS "bt_agend_select" ON public.agendamentos_banho_tosa;
DROP POLICY IF EXISTS "bt_agend_insert" ON public.agendamentos_banho_tosa;
DROP POLICY IF EXISTS "bt_agend_update" ON public.agendamentos_banho_tosa;
DROP POLICY IF EXISTS "bt_agend_delete" ON public.agendamentos_banho_tosa;

CREATE POLICY "bt_agend_select" ON public.agendamentos_banho_tosa
  FOR SELECT USING (public.get_my_role() IN ('admin','recepcao','banho_tosa'));
CREATE POLICY "bt_agend_insert" ON public.agendamentos_banho_tosa
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin','recepcao'));
CREATE POLICY "bt_agend_update" ON public.agendamentos_banho_tosa
  FOR UPDATE USING (public.get_my_role() IN ('admin','recepcao','banho_tosa'));
CREATE POLICY "bt_agend_delete" ON public.agendamentos_banho_tosa
  FOR DELETE USING (public.get_my_role() = 'admin');

-- transportes: motorista lê e atualiza (embarques/entregas);
-- recepção monta e remove; banho_tosa só visualiza
DROP POLICY IF EXISTS "transp_select" ON public.transportes;
DROP POLICY IF EXISTS "transp_insert" ON public.transportes;
DROP POLICY IF EXISTS "transp_update" ON public.transportes;
DROP POLICY IF EXISTS "transp_delete" ON public.transportes;

CREATE POLICY "transp_select" ON public.transportes
  FOR SELECT USING (public.get_my_role() IN ('admin','recepcao','banho_tosa','motorista'));
CREATE POLICY "transp_insert" ON public.transportes
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin','recepcao'));
CREATE POLICY "transp_update" ON public.transportes
  FOR UPDATE USING (public.get_my_role() IN ('admin','recepcao','motorista'));
CREATE POLICY "transp_delete" ON public.transportes
  FOR DELETE USING (public.get_my_role() IN ('admin','recepcao'));

-- rotas: motorista inicia/finaliza (km e status); recepção cria
DROP POLICY IF EXISTS "rotas_select" ON public.rotas;
DROP POLICY IF EXISTS "rotas_insert" ON public.rotas;
DROP POLICY IF EXISTS "rotas_update" ON public.rotas;
DROP POLICY IF EXISTS "rotas_delete" ON public.rotas;

CREATE POLICY "rotas_select" ON public.rotas
  FOR SELECT USING (public.get_my_role() IN ('admin','recepcao','motorista'));
CREATE POLICY "rotas_insert" ON public.rotas
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin','recepcao'));
CREATE POLICY "rotas_update" ON public.rotas
  FOR UPDATE USING (public.get_my_role() IN ('admin','recepcao','motorista'));
CREATE POLICY "rotas_delete" ON public.rotas
  FOR DELETE USING (public.get_my_role() = 'admin');

-- abastecimentos: motorista registra; admin gerencia
DROP POLICY IF EXISTS "abast_select" ON public.abastecimentos;
DROP POLICY IF EXISTS "abast_insert" ON public.abastecimentos;
DROP POLICY IF EXISTS "abast_update" ON public.abastecimentos;
DROP POLICY IF EXISTS "abast_delete" ON public.abastecimentos;

CREATE POLICY "abast_select" ON public.abastecimentos
  FOR SELECT USING (public.get_my_role() IN ('admin','recepcao','motorista'));
CREATE POLICY "abast_insert" ON public.abastecimentos
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin','recepcao','motorista'));
CREATE POLICY "abast_update" ON public.abastecimentos
  FOR UPDATE USING (public.get_my_role() = 'admin');
CREATE POLICY "abast_delete" ON public.abastecimentos
  FOR DELETE USING (public.get_my_role() = 'admin');

-- manutenções: recepção e admin registram
DROP POLICY IF EXISTS "manut_select" ON public.manutencoes_veiculo;
DROP POLICY IF EXISTS "manut_insert" ON public.manutencoes_veiculo;
DROP POLICY IF EXISTS "manut_update" ON public.manutencoes_veiculo;
DROP POLICY IF EXISTS "manut_delete" ON public.manutencoes_veiculo;

CREATE POLICY "manut_select" ON public.manutencoes_veiculo
  FOR SELECT USING (public.get_my_role() IN ('admin','recepcao'));
CREATE POLICY "manut_insert" ON public.manutencoes_veiculo
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin','recepcao'));
CREATE POLICY "manut_update" ON public.manutencoes_veiculo
  FOR UPDATE USING (public.get_my_role() = 'admin');
CREATE POLICY "manut_delete" ON public.manutencoes_veiculo
  FOR DELETE USING (public.get_my_role() = 'admin');

-- config_transporte: todos os perfis leem; admin edita
DROP POLICY IF EXISTS "config_transp_select" ON public.config_transporte;
DROP POLICY IF EXISTS "config_transp_update" ON public.config_transporte;
DROP POLICY IF EXISTS "config_transp_insert" ON public.config_transporte;

CREATE POLICY "config_transp_select" ON public.config_transporte
  FOR SELECT USING (public.get_my_role() IN ('admin','recepcao','banho_tosa','motorista'));
CREATE POLICY "config_transp_update" ON public.config_transporte
  FOR UPDATE USING (public.get_my_role() = 'admin');
CREATE POLICY "config_transp_insert" ON public.config_transporte
  FOR INSERT WITH CHECK (public.get_my_role() = 'admin');

-- ============================================================
-- 8. Acesso do motorista a pets/tutores: SOMENTE nome, foto,
-- identificador, endereço e telefone — via views restritas.
-- O motorista NÃO lê as tabelas completas (vacinas, CPF,
-- observações, planos etc. ficam fora do alcance dele).
-- ============================================================
DROP POLICY IF EXISTS "pets_select" ON public.pets;
CREATE POLICY "pets_select" ON public.pets
  FOR SELECT USING (public.get_my_role() IN ('admin','recepcao','banho_tosa'));

DROP POLICY IF EXISTS "tutores_select" ON public.tutores;
CREATE POLICY "tutores_select" ON public.tutores
  FOR SELECT USING (public.get_my_role() IN ('admin','recepcao','banho_tosa'));

-- Views com colunas mínimas (rodam como owner, ignoram o RLS da
-- tabela base; o WHERE com get_my_role() controla quem lê)
CREATE OR REPLACE VIEW public.pets_rota AS
  SELECT id, nome, identificador, foto_url, tutor_id
  FROM public.pets
  WHERE public.get_my_role() IN ('admin','recepcao','banho_tosa','motorista');

CREATE OR REPLACE VIEW public.tutores_rota AS
  SELECT id, nome, telefone, whatsapp, endereco
  FROM public.tutores
  WHERE public.get_my_role() IN ('admin','recepcao','banho_tosa','motorista');

GRANT SELECT ON public.pets_rota TO authenticated;
GRANT SELECT ON public.tutores_rota TO authenticated;

-- ============================================================
-- FIM — Módulo Transporte
-- ============================================================
