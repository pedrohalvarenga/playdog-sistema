-- Adiciona pet_id e tutor_id à tabela despesas (opcionais)
ALTER TABLE despesas
  ADD COLUMN IF NOT EXISTS tutor_id UUID REFERENCES tutores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pet_id UUID REFERENCES pets(id) ON DELETE SET NULL;
