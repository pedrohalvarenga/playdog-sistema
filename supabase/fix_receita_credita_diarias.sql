-- ============================================================
-- PLAY DOG — Correção: receita com "Nº de diárias" não creditava
-- o saldo de diárias do pet (pets.saldo_diarias).
--
-- Causa: o formulário de Receita (Financeiro) gravava num_diarias na
-- tabela receitas, mas nunca atualizava pets.saldo_diarias. Só o fluxo
-- "Comprar diárias" (Creche) creditava o saldo. Os dois eram desligados.
--
-- Solução: trigger no banco que credita/ajusta o saldo do pet sempre que
-- uma receita com num_diarias é criada ou editada — independente de qual
-- tela cria a receita (nova, editar, lançamento rápido).
--
-- Observações:
--  * INSERT credita NEW.num_diarias no pet.
--  * UPDATE aplica apenas a diferença (delta) — ou move entre pets se o
--    pet_id mudar. Editar a receita sem mexer nas diárias não altera saldo.
--  * DELETE NÃO reverte o saldo (decisão de segurança para não bagunçar
--    saldos antigos geridos manualmente). Para corrigir, use Creche →
--    Ajustar saldo.
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
  END IF;
  RETURN NULL;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_creditar_diarias_receita ON public.receitas;
CREATE TRIGGER trg_creditar_diarias_receita
AFTER INSERT OR UPDATE ON public.receitas
FOR EACH ROW EXECUTE FUNCTION public.creditar_diarias_receita();
