// Validação compartilhada para uploads de imagem (rotas que usam service-role).
// Protege contra arquivos grandes ou tipos arbitrários em endpoints públicos.

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024 // 8 MB
export const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

// Retorna uma mensagem de erro se o arquivo for inválido, ou null se estiver ok.
export function validarImagem(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) return 'Arquivo muito grande (máx. 8 MB).'
  if (!TIPOS_IMAGEM.includes(file.type || '')) return 'Formato não suportado. Envie uma imagem (JPG, PNG, WebP ou GIF).'
  return null
}
