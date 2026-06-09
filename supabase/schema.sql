-- ============================================================
-- PLAY DOG — Schema do Banco de Dados (Fase 1)
-- Execute este script no Supabase SQL Editor
-- ============================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELA: profiles (usuários do sistema)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  nome        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'recepcao' CHECK (role IN ('admin', 'recepcao', 'banho_tosa', 'motorista')),
  ativo       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger para criar profile automaticamente ao criar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'recepcao')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TABELA: tutores
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tutores (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome         TEXT NOT NULL,
  telefone     TEXT NOT NULL,
  whatsapp     TEXT,
  cpf          TEXT,
  endereco     TEXT,
  observacoes  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: pets
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pets (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tutor_id             UUID NOT NULL REFERENCES public.tutores(id) ON DELETE RESTRICT,
  nome                 TEXT NOT NULL,
  raca                 TEXT,
  porte                TEXT NOT NULL DEFAULT 'M' CHECK (porte IN ('P', 'M', 'G')),
  data_nascimento      DATE,
  foto_url             TEXT,
  castrado             BOOLEAN NOT NULL DEFAULT false,
  restricoes           TEXT,
  comportamento        TEXT,
  vacina_v8_v10        DATE,
  vacina_antirabica    DATE,
  vacina_gripe         DATE,
  plano                TEXT NOT NULL DEFAULT 'diaria_avulsa' CHECK (plano IN ('diaria_avulsa', 'pacote_semanal', 'pacote_mensal', 'hotel')),
  plano_diarias_total  INTEGER,
  plano_inicio         DATE,
  plano_fim            DATE,
  ativo                BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: presencas (creche - check-in/check-out)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.presencas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id          UUID NOT NULL REFERENCES public.pets(id) ON DELETE RESTRICT,
  data            DATE NOT NULL,
  checkin_at      TIMESTAMPTZ,
  checkout_at     TIMESTAMPTZ,
  observacoes     TEXT,
  registrado_por  UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Impede duplicata: um pet só pode ter uma presença por dia sem checkout
  UNIQUE(pet_id, data)
);

-- ============================================================
-- TABELA: diaria_saldo (controle de pacotes)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.diaria_saldo (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id               UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  plano                TEXT NOT NULL,
  diarias_contratadas  INTEGER NOT NULL DEFAULT 0,
  diarias_usadas       INTEGER NOT NULL DEFAULT 0,
  periodo_inicio       DATE NOT NULL,
  periodo_fim          DATE NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pets_tutor ON public.pets(tutor_id);
CREATE INDEX IF NOT EXISTS idx_pets_nome ON public.pets USING GIN(to_tsvector('portuguese', nome));
CREATE INDEX IF NOT EXISTS idx_presencas_data ON public.presencas(data);
CREATE INDEX IF NOT EXISTS idx_presencas_pet ON public.presencas(pet_id);
CREATE INDEX IF NOT EXISTS idx_tutores_nome ON public.tutores USING GIN(to_tsvector('portuguese', nome));

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presencas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diaria_saldo ENABLE ROW LEVEL SECURITY;

-- Helper: retorna o role do usuário logado
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND ativo = true LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- PROFILES: usuários veem apenas o próprio perfil; admin vê todos
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.get_my_role() = 'admin');

CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (public.get_my_role() = 'admin');

CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT WITH CHECK (public.get_my_role() = 'admin');

-- TUTORES: recepcao e admin gerenciam; outros apenas leitura
CREATE POLICY "tutores_select" ON public.tutores
  FOR SELECT USING (public.get_my_role() IN ('admin', 'recepcao', 'banho_tosa'));

CREATE POLICY "tutores_insert" ON public.tutores
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'recepcao'));

CREATE POLICY "tutores_update" ON public.tutores
  FOR UPDATE USING (public.get_my_role() IN ('admin', 'recepcao'));

-- PETS: banho_tosa também pode visualizar
CREATE POLICY "pets_select" ON public.pets
  FOR SELECT USING (public.get_my_role() IN ('admin', 'recepcao', 'banho_tosa'));

CREATE POLICY "pets_insert" ON public.pets
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'recepcao'));

CREATE POLICY "pets_update" ON public.pets
  FOR UPDATE USING (public.get_my_role() IN ('admin', 'recepcao'));

-- PRESENCAS: recepcao e admin gerenciam
CREATE POLICY "presencas_select" ON public.presencas
  FOR SELECT USING (public.get_my_role() IN ('admin', 'recepcao', 'banho_tosa'));

CREATE POLICY "presencas_insert" ON public.presencas
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'recepcao'));

CREATE POLICY "presencas_update" ON public.presencas
  FOR UPDATE USING (public.get_my_role() IN ('admin', 'recepcao'));

-- DIARIA_SALDO: somente admin e recepcao
CREATE POLICY "diaria_saldo_select" ON public.diaria_saldo
  FOR SELECT USING (public.get_my_role() IN ('admin', 'recepcao'));

CREATE POLICY "diaria_saldo_insert" ON public.diaria_saldo
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'recepcao'));

-- ============================================================
-- STORAGE: bucket para fotos dos pets
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('pets-fotos', 'pets-fotos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "pets_fotos_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'pets-fotos');

CREATE POLICY "pets_fotos_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'pets-fotos' AND auth.role() = 'authenticated'
  );

-- ============================================================
-- FIM DO SCHEMA
-- ============================================================
