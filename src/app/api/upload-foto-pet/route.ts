import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('arquivo') as File | null
  if (!file) return NextResponse.json({ error: 'Sem arquivo' }, { status: 400 })

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `pets/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const bytes = await file.arrayBuffer()
  const { error } = await adminClient.storage
    .from('fotos')
    .upload(path, bytes, { contentType: file.type || 'image/jpeg', upsert: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data } = adminClient.storage.from('fotos').getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
