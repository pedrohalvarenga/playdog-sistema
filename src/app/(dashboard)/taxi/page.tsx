import { redirect } from 'next/navigation'

// O módulo Taxi Dog virou o módulo Transporte
export default function TaxiDogPage() {
  redirect('/transportes')
}
