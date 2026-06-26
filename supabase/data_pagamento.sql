-- Adiciona campo data_pagamento para distinguir regime de caixa x competência
ALTER TABLE public.receitas ADD COLUMN IF NOT EXISTS data_pagamento DATE;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS data_pagamento DATE;

-- Backfill histórico: registros já pagos recebem a data do serviço como estimativa
UPDATE public.receitas SET data_pagamento = data WHERE status = 'pago' AND data_pagamento IS NULL;
UPDATE public.despesas SET data_pagamento = data WHERE status = 'pago' AND data_pagamento IS NULL;
