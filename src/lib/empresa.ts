import type { SupabaseClient } from '@supabase/supabase-js'

// Resolve o empresa_id do usuário logado (estrutura multi-empresa).
// Inserts em tutores/pets exigem o campo; sem ele o banco rejeita.
export async function getEmpresaId(supabase: SupabaseClient): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select('empresa_id')
    .eq('id', user.id)
    .single()
  return data?.empresa_id ?? null
}
