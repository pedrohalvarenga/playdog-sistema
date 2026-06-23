import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Gera (ou recalcula) a rota do dia: ordena as paradas pela melhor
// sequência usando a Google Routes API (trânsito atual), partindo do
// endereço da Play Dog. Sem chave configurada, cria a rota na ordem
// da lista e avisa.

interface Stop {
  id: string
  endereco: string
}

function enderecoCompleto(endereco: string): string {
  const e = endereco.trim()
  if (/juiz de fora/i.test(e)) return e
  return `${e}, Juiz de Fora - MG, Brasil`
}

async function otimizarComGoogle(apiKey: string, partida: string, stops: Stop[]) {
  const origemDestino = { address: enderecoCompleto(partida) }
  const intermediates = stops.map(s => ({ address: enderecoCompleto(s.endereco) }))

  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.optimizedIntermediateWaypointIndex,routes.distanceMeters,routes.duration',
    },
    body: JSON.stringify({
      origin: origemDestino,
      destination: origemDestino,
      intermediates,
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      optimizeWaypointOrder: stops.length > 1,
      regionCode: 'BR',
      languageCode: 'pt-BR',
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Routes API ${res.status}: ${body.slice(0, 300)}`)
  }

  const json = await res.json()
  const route = json.routes?.[0]
  if (!route) throw new Error('Routes API não retornou rota.')

  const ordemOtimizada: number[] = route.optimizedIntermediateWaypointIndex
    ?? stops.map((_, i) => i)
  const distanciaKm = route.distanceMeters != null ? route.distanceMeters / 1000 : null
  const duracaoMin = route.duration ? Math.round(parseInt(route.duration) / 60) : null

  return { ordemOtimizada, distanciaKm, duracaoMin }
}

// Distância da Play Dog até cada parada (base para precificação futura)
async function distanciasPorParada(apiKey: string, partida: string, stops: Stop[]) {
  const res = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'originIndex,destinationIndex,distanceMeters,condition',
    },
    body: JSON.stringify({
      origins: [{ waypoint: { address: enderecoCompleto(partida) } }],
      destinations: stops.map(s => ({ waypoint: { address: enderecoCompleto(s.endereco) } })),
      travelMode: 'DRIVE',
      regionCode: 'BR',
    }),
  })

  if (!res.ok) return new Map<string, number>()

  const rows = await res.json() as Array<{ destinationIndex?: number; distanceMeters?: number; condition?: string }>
  const mapa = new Map<string, number>()
  for (const row of rows ?? []) {
    if (row.condition === 'ROUTE_EXISTS' && row.destinationIndex != null && row.distanceMeters != null) {
      const stop = stops[row.destinationIndex]
      if (stop) mapa.set(stop.id, Math.round(row.distanceMeters / 10) / 100)
    }
  }
  return mapa
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, ativo').eq('id', user.id).single()
  if (!profile?.ativo || !['admin', 'recepcao'].includes(profile.role)) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const { data, tipo } = await req.json()
  if (!data || !['coleta', 'entrega'].includes(tipo)) {
    return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })
  }

  const trecho = tipo === 'coleta' ? 'buscar' : 'levar'

  // Endereço de partida configurável
  const { data: config } = await supabase
    .from('config_transporte').select('valor').eq('chave', 'endereco_partida').single()
  const partida = config?.valor ?? 'Play Dog, Juiz de Fora - MG'

  // Paradas: pets que vão pelo nosso carro e ainda não foram atendidos
  const { data: stops } = await supabase
    .from('transportes')
    .select('id, endereco, horario, created_at')
    .eq('data', data)
    .eq('tipo', trecho)
    .eq('meio', 'playdog')
    .in('status', ['pendente', 'em_rota'])
    .order('horario', { ascending: true, nullsFirst: false })
    .order('created_at')

  if (!stops || stops.length === 0) {
    return NextResponse.json({ error: 'Nenhum passageiro pelo nosso transporte neste trecho.' }, { status: 400 })
  }

  // Rota do dia (uma coleta e uma entrega por dia)
  const { data: rotaExistente } = await supabase
    .from('rotas').select('*').eq('data', data).eq('tipo', tipo).maybeSingle()

  if (rotaExistente?.status === 'finalizada') {
    return NextResponse.json({ error: 'Esta rota já foi finalizada.' }, { status: 400 })
  }
  if (rotaExistente?.status === 'em_andamento') {
    return NextResponse.json({ error: 'A rota já está em andamento — não dá para recalcular sem reordenar paradas que o motorista já passou.' }, { status: 400 })
  }

  let rotaId = rotaExistente?.id as string | undefined
  if (!rotaId) {
    const { data: nova, error: errRota } = await supabase
      .from('rotas')
      .insert({ data, tipo, endereco_partida: partida, criada_por: user.id })
      .select('id')
      .single()
    if (errRota || !nova) {
      return NextResponse.json({ error: errRota?.message ?? 'Erro ao criar rota.' }, { status: 500 })
    }
    rotaId = nova.id
  }

  // Otimização com Google Maps (trânsito atual)
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  let ordemFinal = stops.map(s => s.id)
  let distanciaKm: number | null = null
  let duracaoMin: number | null = null
  let otimizada = false
  let aviso: string | undefined
  let distMap = new Map<string, number>()

  if (apiKey) {
    try {
      const r = await otimizarComGoogle(apiKey, partida, stops)
      ordemFinal = r.ordemOtimizada.map(i => stops[i].id)
      distanciaKm = r.distanciaKm != null ? Math.round(r.distanciaKm * 100) / 100 : null
      duracaoMin = r.duracaoMin
      otimizada = true
      distMap = await distanciasPorParada(apiKey, partida, stops)
    } catch (e) {
      aviso = `Não foi possível otimizar com o Google Maps (${e instanceof Error ? e.message : 'erro'}). Rota criada na ordem da lista.`
    }
  } else {
    aviso = 'Chave do Google Maps não configurada — rota criada na ordem da lista, sem otimização.'
  }

  // Revincula as paradas atuais à rota, na ordem calculada
  await supabase.from('transportes')
    .update({ rota_id: null, ordem: null })
    .eq('rota_id', rotaId)
    .in('status', ['pendente', 'em_rota'])

  for (let i = 0; i < ordemFinal.length; i++) {
    await supabase.from('transportes').update({
      rota_id: rotaId,
      ordem: i + 1,
      ...(distMap.has(ordemFinal[i]) ? { distancia_km: distMap.get(ordemFinal[i]) } : {}),
    }).eq('id', ordemFinal[i])
  }

  await supabase.from('rotas').update({
    endereco_partida: partida,
    distancia_total_km: distanciaKm,
    duracao_estimada_min: duracaoMin,
    otimizada,
  }).eq('id', rotaId)

  return NextResponse.json({ rotaId, otimizada, aviso })
}
