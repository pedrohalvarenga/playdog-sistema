-- ============================================================
-- PLAY DOG — Permissões granulares de menu por usuário
-- Adiciona profiles.menus (array de chaves de menu). Quando preenchido,
-- a barra de navegação mostra exatamente esses menus para o usuário.
-- Quando NULL, o sistema usa o padrão do perfil (role) — retrocompatível.
-- As chaves correspondem a MENUS em src/lib/menus.ts.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS menus text[];
