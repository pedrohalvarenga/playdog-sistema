-- Remove policies existentes
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
DROP POLICY IF EXISTS "tutores_select" ON public.tutores;
DROP POLICY IF EXISTS "tutores_insert" ON public.tutores;
DROP POLICY IF EXISTS "tutores_update" ON public.tutores;
DROP POLICY IF EXISTS "pets_select" ON public.pets;
DROP POLICY IF EXISTS "pets_insert" ON public.pets;
DROP POLICY IF EXISTS "pets_update" ON public.pets;
DROP POLICY IF EXISTS "presencas_select" ON public.presencas;
DROP POLICY IF EXISTS "presencas_insert" ON public.presencas;
DROP POLICY IF EXISTS "presencas_update" ON public.presencas;
DROP POLICY IF EXISTS "diaria_saldo_select" ON public.diaria_saldo;
DROP POLICY IF EXISTS "diaria_saldo_insert" ON public.diaria_saldo;
DROP POLICY IF EXISTS "pets_fotos_select" ON storage.objects;
DROP POLICY IF EXISTS "pets_fotos_insert" ON storage.objects;

-- Recria policies
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.get_my_role() = 'admin');

CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (public.get_my_role() = 'admin');

CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "tutores_select" ON public.tutores
  FOR SELECT USING (public.get_my_role() IN ('admin', 'recepcao', 'banho_tosa'));

CREATE POLICY "tutores_insert" ON public.tutores
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'recepcao'));

CREATE POLICY "tutores_update" ON public.tutores
  FOR UPDATE USING (public.get_my_role() IN ('admin', 'recepcao'));

CREATE POLICY "pets_select" ON public.pets
  FOR SELECT USING (public.get_my_role() IN ('admin', 'recepcao', 'banho_tosa'));

CREATE POLICY "pets_insert" ON public.pets
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'recepcao'));

CREATE POLICY "pets_update" ON public.pets
  FOR UPDATE USING (public.get_my_role() IN ('admin', 'recepcao'));

CREATE POLICY "presencas_select" ON public.presencas
  FOR SELECT USING (public.get_my_role() IN ('admin', 'recepcao', 'banho_tosa'));

CREATE POLICY "presencas_insert" ON public.presencas
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'recepcao'));

CREATE POLICY "presencas_update" ON public.presencas
  FOR UPDATE USING (public.get_my_role() IN ('admin', 'recepcao'));

CREATE POLICY "diaria_saldo_select" ON public.diaria_saldo
  FOR SELECT USING (public.get_my_role() IN ('admin', 'recepcao'));

CREATE POLICY "diaria_saldo_insert" ON public.diaria_saldo
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'recepcao'));

CREATE POLICY "pets_fotos_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'pets-fotos');

CREATE POLICY "pets_fotos_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'pets-fotos' AND auth.role() = 'authenticated'
  );
