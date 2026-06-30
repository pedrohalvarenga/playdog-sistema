-- ============================================================
-- PLAY DOG — Correções da auditoria financeira (30/06/2026)
-- Rode este script INTEIRO no Supabase → SQL Editor.
-- É seguro rodar mais de uma vez (idempotente).
--
-- Conteúdo:
--  (1) data_pagamento sempre coerente (regime de caixa).
--  (2) Diárias/banhos só são creditados ao pet quando a receita está PAGA
--      (antes creditava já no "Em aberto"). Cancelar/editar para pendente
--      estorna; excluir estorna; pagar credita.
--  (3) v_saldo_contas deixa de vazar o total de despesas para a recepção.
-- ============================================================


-- ============================================================
-- (1) data_pagamento — regime de caixa
-- ============================================================

-- Backfill: todo lançamento PAGO sem data de pagamento recebe a data de
-- competência como melhor estimativa do dia em que o dinheiro entrou/saiu.
UPDATE public.receitas SET data_pagamento = data
  WHERE status = 'pago' AND data_pagamento IS NULL;
UPDATE public.despesas SET data_pagamento = data
  WHERE status = 'pago' AND data_pagamento IS NULL;

-- Pendentes e cancelados não têm data de caixa.
UPDATE public.receitas SET data_pagamento = NULL
  WHERE status <> 'pago' AND data_pagamento IS NOT NULL;
UPDATE public.despesas SET data_pagamento = NULL
  WHERE status <> 'pago' AND data_pagamento IS NOT NULL;

-- Gatilho que mantém isso coerente daqui pra frente.
CREATE OR REPLACE FUNCTION public.sync_data_pagamento()
RETURNS TRIGGER AS $func$
BEGIN
  IF NEW.status = 'pago' THEN
    IF NEW.data_pagamento IS NULL THEN
      NEW.data_pagamento := COALESCE(NEW.data, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
    END IF;
  ELSE
    NEW.data_pagamento := NULL;
  END IF;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_data_pagamento_receitas ON public.receitas;
CREATE TRIGGER trg_sync_data_pagamento_receitas
BEFORE INSERT OR UPDATE ON public.receitas
FOR EACH ROW EXECUTE FUNCTION public.sync_data_pagamento();

DROP TRIGGER IF EXISTS trg_sync_data_pagamento_despesas ON public.despesas;
CREATE TRIGGER trg_sync_data_pagamento_despesas
BEFORE INSERT OR UPDATE ON public.despesas
FOR EACH ROW EXECUTE FUNCTION public.sync_data_pagamento();


-- ============================================================
-- (2) DIÁRIAS — só credita o pet quando a receita está PAGA
--   Contribuição da receita ao saldo = num_diarias SE status='pago', senão 0.
--   INSERT/UPDATE/DELETE aplicam a diferença dessa contribuição.
-- ============================================================
CREATE OR REPLACE FUNCTION public.creditar_diarias_receita()
RETURNS TRIGGER AS $func$
DECLARE
  v_old INTEGER := 0;
  v_new INTEGER := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new := CASE WHEN NEW.status = 'pago' THEN COALESCE(NEW.num_diarias, 0) ELSE 0 END;
    IF NEW.pet_id IS NOT NULL AND v_new <> 0 THEN
      UPDATE public.pets SET saldo_diarias = COALESCE(saldo_diarias, 0) + v_new WHERE id = NEW.pet_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    v_old := CASE WHEN OLD.status = 'pago' THEN COALESCE(OLD.num_diarias, 0) ELSE 0 END;
    v_new := CASE WHEN NEW.status = 'pago' THEN COALESCE(NEW.num_diarias, 0) ELSE 0 END;
    IF COALESCE(OLD.pet_id::text, '') = COALESCE(NEW.pet_id::text, '') THEN
      IF NEW.pet_id IS NOT NULL AND (v_new - v_old) <> 0 THEN
        UPDATE public.pets SET saldo_diarias = COALESCE(saldo_diarias, 0) + (v_new - v_old) WHERE id = NEW.pet_id;
      END IF;
    ELSE
      IF OLD.pet_id IS NOT NULL AND v_old <> 0 THEN
        UPDATE public.pets SET saldo_diarias = COALESCE(saldo_diarias, 0) - v_old WHERE id = OLD.pet_id;
      END IF;
      IF NEW.pet_id IS NOT NULL AND v_new <> 0 THEN
        UPDATE public.pets SET saldo_diarias = COALESCE(saldo_diarias, 0) + v_new WHERE id = NEW.pet_id;
      END IF;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_old := CASE WHEN OLD.status = 'pago' THEN COALESCE(OLD.num_diarias, 0) ELSE 0 END;
    IF OLD.pet_id IS NOT NULL AND v_old <> 0 THEN
      UPDATE public.pets SET saldo_diarias = COALESCE(saldo_diarias, 0) - v_old WHERE id = OLD.pet_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_creditar_diarias_receita ON public.receitas;
CREATE TRIGGER trg_creditar_diarias_receita
AFTER INSERT OR UPDATE OR DELETE ON public.receitas
FOR EACH ROW EXECUTE FUNCTION public.creditar_diarias_receita();


-- ============================================================
-- (2b) BANHOS — mesma regra (só credita quando PAGA) + estorno no DELETE
-- ============================================================
CREATE OR REPLACE FUNCTION public.creditar_banhos_receita()
RETURNS TRIGGER AS $func$
DECLARE
  v_old INTEGER := 0;
  v_new INTEGER := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new := CASE WHEN NEW.status = 'pago' THEN COALESCE(NEW.num_banhos, 0) ELSE 0 END;
    IF NEW.pet_id IS NOT NULL AND v_new <> 0 THEN
      UPDATE public.pets SET saldo_banhos = COALESCE(saldo_banhos, 0) + v_new WHERE id = NEW.pet_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    v_old := CASE WHEN OLD.status = 'pago' THEN COALESCE(OLD.num_banhos, 0) ELSE 0 END;
    v_new := CASE WHEN NEW.status = 'pago' THEN COALESCE(NEW.num_banhos, 0) ELSE 0 END;
    IF COALESCE(OLD.pet_id::text, '') = COALESCE(NEW.pet_id::text, '') THEN
      IF NEW.pet_id IS NOT NULL AND (v_new - v_old) <> 0 THEN
        UPDATE public.pets SET saldo_banhos = COALESCE(saldo_banhos, 0) + (v_new - v_old) WHERE id = NEW.pet_id;
      END IF;
    ELSE
      IF OLD.pet_id IS NOT NULL AND v_old <> 0 THEN
        UPDATE public.pets SET saldo_banhos = COALESCE(saldo_banhos, 0) - v_old WHERE id = OLD.pet_id;
      END IF;
      IF NEW.pet_id IS NOT NULL AND v_new <> 0 THEN
        UPDATE public.pets SET saldo_banhos = COALESCE(saldo_banhos, 0) + v_new WHERE id = NEW.pet_id;
      END IF;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_old := CASE WHEN OLD.status = 'pago' THEN COALESCE(OLD.num_banhos, 0) ELSE 0 END;
    IF OLD.pet_id IS NOT NULL AND v_old <> 0 THEN
      UPDATE public.pets SET saldo_banhos = COALESCE(saldo_banhos, 0) - v_old WHERE id = OLD.pet_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_creditar_banhos_receita ON public.receitas;
CREATE TRIGGER trg_creditar_banhos_receita
AFTER INSERT OR UPDATE OR DELETE ON public.receitas
FOR EACH ROW EXECUTE FUNCTION public.creditar_banhos_receita();


-- ============================================================
-- (2c) RECONCILIAÇÃO — tira o crédito que receitas NÃO pagas tinham
--   recebido pela regra antiga (que creditava já no "Em aberto").
--   Só roda para receitas pendentes/canceladas que tenham num_diarias/
--   num_banhos. Se não houver nenhuma, não muda nada.
-- ============================================================
UPDATE public.pets p
  SET saldo_diarias = COALESCE(p.saldo_diarias, 0) - x.total
FROM (
  SELECT pet_id, SUM(COALESCE(num_diarias, 0)) AS total
  FROM public.receitas
  WHERE status <> 'pago' AND pet_id IS NOT NULL AND COALESCE(num_diarias, 0) <> 0
  GROUP BY pet_id
) x
WHERE p.id = x.pet_id AND x.total <> 0;

UPDATE public.pets p
  SET saldo_banhos = COALESCE(p.saldo_banhos, 0) - x.total
FROM (
  SELECT pet_id, SUM(COALESCE(num_banhos, 0)) AS total
  FROM public.receitas
  WHERE status <> 'pago' AND pet_id IS NOT NULL AND COALESCE(num_banhos, 0) <> 0
  GROUP BY pet_id
) x
WHERE p.id = x.pet_id AND x.total <> 0;


-- ============================================================
-- (3) v_saldo_contas — não vazar despesas para a recepção
--   security_invoker faz a view respeitar o RLS de quem consulta:
--   a recepção (sem acesso a despesas) deixa de ver o total de despesas.
-- ============================================================
ALTER VIEW public.v_saldo_contas SET (security_invoker = on);


-- ============================================================
-- FIM
-- ============================================================
