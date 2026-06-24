-- ============================================================
-- PLAY DOG — Módulo Tarefas do Dia
-- Checklist de tarefas da semana com IA de sugestão, ordem,
-- atribuição por pessoa, conclusão (check) e lembrete de atrasadas.
-- Execute este script COMPLETO no Supabase SQL Editor.
-- Pode ser executado mais de uma vez sem causar erro.
-- ============================================================

-- ── 1) Permissão de tarefas no perfil ───────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tarefas_perm TEXT
    CHECK (tarefas_perm IN ('gerente','criador'));

-- Seed: Carol (Anna Carolina) e Mari = gerente (criar/editar/excluir);
--       Luiza = criador (só criar). Todos os outros recebem/concluem tarefas.
UPDATE public.profiles SET tarefas_perm = 'gerente'
  WHERE id IN (
    '411743d0-5d43-4a5e-9240-dcd12d128d79', -- Anna Carolina Staico (Carol)
    '230ac3a3-efd2-42d9-a775-0861e6aa34c9'  -- Mari
  );
UPDATE public.profiles SET tarefas_perm = 'criador'
  WHERE id = 'fd1af081-3338-474e-ba89-109c22b4327b'; -- Luiza Moreira Liota

-- Helper: permissão de tarefas do usuário logado
CREATE OR REPLACE FUNCTION public.minha_tarefas_perm()
RETURNS TEXT AS $$
  SELECT tarefas_perm FROM public.profiles WHERE id = auth.uid() AND ativo = true LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ── 2) View de pessoas (para mostrar responsáveis e atribuir) ─
-- A RLS de profiles só deixa o usuário ver o próprio perfil; esta view
-- expõe APENAS id/nome/role das pessoas ativas para todos os logados.
CREATE OR REPLACE VIEW public.pessoas AS
  SELECT id, nome, role FROM public.profiles WHERE ativo = true;
GRANT SELECT ON public.pessoas TO authenticated;

-- ── 3) Catálogo de atividades (cresce conforme escrita manual) ─
CREATE TABLE IF NOT EXISTS public.atividades_tarefas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome        TEXT NOT NULL,
  nome_norm   TEXT GENERATED ALWAYS AS (lower(btrim(nome))) STORED,
  vezes_usada INTEGER NOT NULL DEFAULT 1,
  ultimo_uso  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  empresa_id  UUID,
  criada_por  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_atividades_tarefas_emp_norm
  ON public.atividades_tarefas(empresa_id, nome_norm);

-- ── 4) Tarefas ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tarefas (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo         TEXT NOT NULL,
  data           DATE NOT NULL,
  horario        TIME,
  ordem          INTEGER,
  atribuido_para UUID REFERENCES public.profiles(id),
  status         TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','concluida')),
  concluida_em   TIMESTAMPTZ,
  concluida_por  UUID REFERENCES public.profiles(id),
  observacoes    TEXT,
  atividade_id   UUID REFERENCES public.atividades_tarefas(id),
  empresa_id     UUID,
  criada_por     UUID REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tarefas_data   ON public.tarefas(data);
CREATE INDEX IF NOT EXISTS idx_tarefas_atrib  ON public.tarefas(atribuido_para);
CREATE INDEX IF NOT EXISTS idx_tarefas_status ON public.tarefas(status);

DROP TRIGGER IF EXISTS trg_tarefas_updated_at ON public.tarefas;
CREATE TRIGGER trg_tarefas_updated_at
  BEFORE UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 5) RPCs ─────────────────────────────────────────────────
-- Concluir/desfazer: o responsável pela tarefa OU um gerente.
CREATE OR REPLACE FUNCTION public.tarefa_toggle(p_id UUID, p_concluir BOOLEAN)
RETURNS VOID AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tarefas t
    WHERE t.id = p_id
      AND (t.atribuido_para = v_uid OR public.minha_tarefas_perm() = 'gerente')
  ) THEN
    RAISE EXCEPTION 'sem permissao para concluir esta tarefa';
  END IF;
  UPDATE public.tarefas SET
    status        = CASE WHEN p_concluir THEN 'concluida' ELSE 'pendente' END,
    concluida_em  = CASE WHEN p_concluir THEN NOW() ELSE NULL END,
    concluida_por = CASE WHEN p_concluir THEN v_uid ELSE NULL END
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Registrar atividade no catálogo (toda escrita manual vira atividade reutilizável).
CREATE OR REPLACE FUNCTION public.registrar_atividade(p_nome TEXT, p_empresa UUID)
RETURNS UUID AS $$
DECLARE v_id UUID;
BEGIN
  IF public.minha_tarefas_perm() IS NULL THEN
    RAISE EXCEPTION 'sem permissao para criar atividades';
  END IF;
  INSERT INTO public.atividades_tarefas (nome, empresa_id, criada_por)
  VALUES (btrim(p_nome), p_empresa, auth.uid())
  ON CONFLICT (empresa_id, nome_norm)
  DO UPDATE SET vezes_usada = atividades_tarefas.vezes_usada + 1, ultimo_uso = NOW()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.minha_tarefas_perm()                TO authenticated;
GRANT EXECUTE ON FUNCTION public.tarefa_toggle(UUID, BOOLEAN)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_atividade(TEXT, UUID)     TO authenticated;

-- ── 6) RLS ──────────────────────────────────────────────────
ALTER TABLE public.atividades_tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefas            ENABLE ROW LEVEL SECURITY;

-- Atividades: todos logados leem (autocomplete); criar/atualizar = criador+gerente; apagar = gerente.
DROP POLICY IF EXISTS "ativ_select" ON public.atividades_tarefas;
CREATE POLICY "ativ_select" ON public.atividades_tarefas
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "ativ_insert" ON public.atividades_tarefas;
CREATE POLICY "ativ_insert" ON public.atividades_tarefas
  FOR INSERT WITH CHECK (public.minha_tarefas_perm() IN ('gerente','criador'));
DROP POLICY IF EXISTS "ativ_update" ON public.atividades_tarefas;
CREATE POLICY "ativ_update" ON public.atividades_tarefas
  FOR UPDATE USING (public.minha_tarefas_perm() IN ('gerente','criador'));
DROP POLICY IF EXISTS "ativ_delete" ON public.atividades_tarefas;
CREATE POLICY "ativ_delete" ON public.atividades_tarefas
  FOR DELETE USING (public.minha_tarefas_perm() = 'gerente');

-- Tarefas: todos veem todas; criar = criador+gerente; editar/reordenar/excluir = gerente.
-- (a conclusão/check é feita pela RPC tarefa_toggle, aberta ao responsável.)
DROP POLICY IF EXISTS "tar_select" ON public.tarefas;
CREATE POLICY "tar_select" ON public.tarefas
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "tar_insert" ON public.tarefas;
CREATE POLICY "tar_insert" ON public.tarefas
  FOR INSERT WITH CHECK (public.minha_tarefas_perm() IN ('gerente','criador'));
DROP POLICY IF EXISTS "tar_update" ON public.tarefas;
CREATE POLICY "tar_update" ON public.tarefas
  FOR UPDATE USING (public.minha_tarefas_perm() = 'gerente');
DROP POLICY IF EXISTS "tar_delete" ON public.tarefas;
CREATE POLICY "tar_delete" ON public.tarefas
  FOR DELETE USING (public.minha_tarefas_perm() = 'gerente');

-- ── 7) Menu visível para TODOS ──────────────────────────────
-- Quem tem lista de menus personalizada também passa a ver 'tarefas'.
UPDATE public.profiles
  SET menus = array_append(menus, 'tarefas')
  WHERE menus IS NOT NULL AND NOT ('tarefas' = ANY(menus));
