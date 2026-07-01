-- Atribui à Bia (Beatriz) os serviços de banho & tosa ENTREGUES hoje (01/07)
-- que ficaram sem "executado_por", para a comissão de 5% valer.
-- Só serviços (não venda de pacote, num_banhos nulo) e só os sem executor.
UPDATE public.receitas
  SET executado_por = '9a696ddd-7ba8-4f81-8559-bb235fde7888'  -- Beatriz Rodrigues Cabral da Silva
  WHERE area = 'banho_tosa'
    AND data = '2026-07-01'
    AND executado_por IS NULL
    AND COALESCE(num_banhos, 0) = 0;
