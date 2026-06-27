import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Rotas públicas — não exigem autenticação
  const publicPaths = ['/login', '/cadastro', '/api/cadastro-publico', '/api/cadastro-adaptacao', '/api/upload-foto-pet', '/api/analisar-vacinas', '/api/auth/email-por-nome']
  const isPublic = publicPaths.some(p => pathname.startsWith(p))

  // Chamadas internas (cron / lote) autenticadas por segredo, sem sessão de cookie
  const internalSecret = request.headers.get('x-internal-secret')
  const isInternal = !!internalSecret && internalSecret === process.env.CRON_SECRET

  // Redireciona para login se não autenticado
  if (!user && !isPublic && !isInternal) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redireciona para dashboard se já autenticado tentando acessar login
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|favicon.png|apple-touch-icon.png|manifest.json|icons|.*\\.png$).*)'],
}
