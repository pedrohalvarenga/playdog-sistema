-- ============================================================
-- PLAY DOG — Atrelar exclusão de receita ao saldo de diárias
--
-- Problema: o trigger creditar_diarias_receita tratava INSERT e UPDATE,
-- mas IGNORAVA DELETE de propósito. Resultado: ao apagar uma receita com
-- "Nº de diárias" no Financeiro, o saldo do pet NÃO era revertido — o pet
-- ficava com diárias de crédito que nunca foram pagas.
--
-- Solução: a função passa a tratar DELETE, subtraindo OLD.num_diarias do
-- saldo do pet. Agora os dois movimentos (financeiro <-> creche) ficam
-- atrelados: criou receita credita, apagou receita estorna.
--
-- Comportamento final:
--  * INSERT  -> credita NEW.num_diarias
--  * UPDATE  -> aplica o delta (ou move entre pets se pet_id mudar)
--  * DELETE  -> estorna OLD.num_diarias (NOVO)
-- ============================================================

CREATE OR REPLACE FUNCTION public.creditar_diarias_receita()
RETURNS TRIGGER AS $func$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.pet_id IS NOT NULL AND COALESCE(NEW.num_diarias, 0) <> 0 THEN
      UPDATE public.pets
        SET saldo_diarias = COALESCE(saldo_diarias, 0) + NEW.num_diarias
        WHERE id = NEW.pet_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF COALESCE(OLD.pet_id::text, '') = COALESCE(NEW.pet_id::text, '') THEN
      -- mesmo pet: aplica só a diferença
      IF NEW.pet_id IS NOT NULL
         AND (COALESCE(NEW.num_diarias, 0) - COALESCE(OLD.num_diarias, 0)) <> 0 THEN
        UPDATE public.pets
          SET saldo_diarias = COALESCE(saldo_diarias, 0)
              + (COALESCE(NEW.num_diarias, 0) - COALESCE(OLD.num_diarias, 0))
          WHERE id = NEW.pet_id;
      END IF;
    ELSE
      -- mudou de pet: remove do antigo, soma no novo
      IF OLD.pet_id IS NOT NULL AND COALESCE(OLD.num_diarias, 0) <> 0 THEN
        UPDATE public.pets
          SET saldo_diarias = COALESCE(saldo_diarias, 0) - OLD.num_diarias
          WHERE id = OLD.pet_id;
      END IF;
      IF NEW.pet_id IS NOT NULL AND COALESCE(NEW.num_diarias, 0) <> 0 THEN
        UPDATE public.pets
          SET saldo_diarias = COALESCE(saldo_diarias, 0) + NEW.num_diarias
          WHERE id = NEW.pet_id;
      END IF;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- estorna o saldo creditado por esta receita
    IF OLD.pet_id IS NOT NULL AND COALESCE(OLD.num_diarias, 0) <> 0 THEN
      UPDATE public.pets
        SET saldo_diarias = COALESCE(saldo_diarias, 0) - OLD.num_diarias
        WHERE id = OLD.pet_id;
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
-- Correção pontual: pet Luna ficou com 9 diárias (10 creditadas - 1 usada)
-- após apagar a receita de 10 diárias. Deveria estar em -1.
-- Subtrai as 10 diárias que nunca foram pagas.
-- ============================================================
UPDATE public.pets
  SET saldo_diarias = COALESCE(saldo_diarias, 0) - 10
  WHERE id = 'b0c58d41-89db-4371-b7a9-3dd82c725bb0'
    AND saldo_diarias = 9;  -- só aplica se ainda estiver no estado errado (9)
