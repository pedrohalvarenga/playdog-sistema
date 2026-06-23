import { redirect } from 'next/navigation'

// Tela antiga de check-in substituída pelo fluxo da página /creche (que debita
// o saldo de diárias via /api/creche/checkin). Mantida como redirect para não
// quebrar links antigos e evitar registro de presença sem débito de saldo.
export default function CheckinLegadoPage() {
  redirect('/creche')
}
