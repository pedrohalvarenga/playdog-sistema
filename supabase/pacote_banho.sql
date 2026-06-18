-- ============================================================
-- PLAY DOG — Pacote de Banho (créditos pré-pagos)
-- Execute este script no Supabase SQL Editor
--
-- Mesma lógica do saldo de diárias da creche:
--   * Cada banho comprado  = +1 crédito (saldo_banhos)
--   * Cada banho utilizado = -1 crédito
--   * A compra gera uma receita (área banho_tosa) com num_banhos;
--     um trigger credita o saldo automaticamente — não importa de onde
--     a compra foi feita (cadastro do pet, lançamento rápido, banho & tosa).
-- ============================================================

-- ── pets: tipo de cobrança do banho + saldo de créditos ──────
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS tipo_banho   TEXT NOT NULL DEFAULT 'avulso'
    CHECK (tipo_banho IN ('avulso','pacote')),
  ADD COLUMN IF NOT EXISTS saldo_banhos INTEGER NOT NULL DEFAULT 0;

-- ── receitas: quantos banhos aquele pagamento cobre ──────────
ALTER TABLE public.receitas
  ADD COLUMN IF NOT EXISTS num_banhos INTEGER;

-- ── agendamentos: marca o atendimento pago com crédito do pacote ──
ALTER TABLE public.agendamentos_banho_tosa
  ADD COLUMN IF NOT EXISTS pago_com_pacote BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- TRIGGER: credita saldo_banhos quando a receita tem num_banhos
-- (espelha creditar_diarias_receita da creche)
--  * INSERT credita NEW.num_banhos no pet.
--  * UPDATE aplica só a diferença — ou move entre pets se o pet mudar.
--  * DELETE não reverte (decisão de segurança, igual às diárias).
-- ============================================================
CREATE OR REPLACE FUNCTION public.creditar_banhos_receita()
RETURNS TRIGGER AS $func$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.pet_id IS NOT NULL AND COALESCE(NEW.num_banhos, 0) <> 0 THEN
      UPDATE public.pets
        SET saldo_banhos = COALESCE(saldo_banhos, 0) + NEW.num_banhos
        WHERE id = NEW.pet_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF COALESCE(OLD.pet_id::text, '') = COALESCE(NEW.pet_id::text, '') THEN
      IF NEW.pet_id IS NOT NULL
         AND (COALESCE(NEW.num_banhos, 0) - COALESCE(OLD.num_banhos, 0)) <> 0 THEN
        UPDATE public.pets
          SET saldo_banhos = COALESCE(saldo_banhos, 0)
              + (COALESCE(NEW.num_banhos, 0) - COALESCE(OLD.num_banhos, 0))
          WHERE id = NEW.pet_id;
      END IF;
    ELSE
      IF OLD.pet_id IS NOT NULL AND COALESCE(OLD.num_banhos, 0) <> 0 THEN
        UPDATE public.pets
          SET saldo_banhos = COALESCE(saldo_banhos, 0) - OLD.num_banhos
          WHERE id = OLD.pet_id;
      END IF;
      IF NEW.pet_id IS NOT NULL AND COALESCE(NEW.num_banhos, 0) <> 0 THEN
        UPDATE public.pets
          SET saldo_banhos = COALESCE(saldo_banhos, 0) + NEW.num_banhos
          WHERE id = NEW.pet_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_creditar_banhos_receita ON public.receitas;
CREATE TRIGGER trg_creditar_banhos_receita
AFTER INSERT OR UPDATE ON public.receitas
FOR EACH ROW EXECUTE FUNCTION public.creditar_banhos_receita();

-- ============================================================
-- FUNÇÃO: consumir_credito_banho — desconta 1 crédito de forma atômica
-- Usada quando o atendimento é entregue pago com o pacote.
-- ============================================================
CREATE OR REPLACE FUNCTION public.consumir_credito_banho(p_pet_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_saldo INTEGER;
BEGIN
  UPDATE public.pets
    SET saldo_banhos = COALESCE(saldo_banhos, 0) - 1
    WHERE id = p_pet_id
    RETURNING saldo_banhos INTO v_saldo;
  RETURN v_saldo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
