'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Percent } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import DateInput from '@/components/ui/DateInput'
import FotoComCrop from '@/components/ui/FotoComCrop'
import CurrencyInput from '@/components/financeiro/CurrencyInput'
import { AREA_LABELS, formatCurrency } from '@/lib/financeiro'
import { getEmpresaId } from '@/lib/empresa'
import { ROLE_LABELS, formatDate } from '@/lib/utils'
import type { AreaNegocio } from '@/types/financeiro'
import type { Funcionario, ComissaoRegra } from '@/types/funcionario'
import type { Profile, UserRole } from '@/types'

// Áreas que podem gerar comissão (todas menos "geral")
const AREAS_COMISSAO = (Object.keys(AREA_LABELS) as AreaNegocio[]).filter(a => a !== 'geral')
const ROLES: UserRole[] = ['admin', 'recepcao', 'banho_tosa', 'motorista']

interface RegraEdit {
  tipo: AreaNegocio
  percentual: string
  // Preservados ao salvar (configurados via regras avançadas / SQL):
  tipo_calculo?: 'percentual' | 'por_presenca_creche'
  valor_fixo?: number | null
  faturamento_limite?: number | null
  percentual_acima?: number | null
  vigencia_inicio?: string | null
}

export default function FuncionarioForm({ funcionario }: { funcionario?: Funcionario }) {
  const router = useRouter()
  const editId = funcionario?.id
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  // Foto
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoAtual, setFotoAtual] = useState<string | null>(funcionario?.foto_url ?? null)

  // Campos
  const [nome, setNome] = useState(funcionario?.nome ?? '')
  const [cpf, setCpf] = useState(funcionario?.cpf ?? '')
  const [rg, setRg] = useState(funcionario?.rg ?? '')
  const [nascimento, setNascimento] = useState(funcionario?.data_nascimento ?? '')
  const [email, setEmail] = useState(funcionario?.email ?? '')
  const [telefone, setTelefone] = useState(funcionario?.telefone ?? '')
  const [cargo, setCargo] = useState(funcionario?.cargo ?? '')
  const [salario, setSalario] = useState(funcionario?.salario ?? 0)
  const [admissao, setAdmissao] = useState(funcionario?.data_admissao ?? '')
  const [diaPagamento, setDiaPagamento] = useState<number | ''>(funcionario?.dia_pagamento ?? '')
  const [tamCalca, setTamCalca] = useState(funcionario?.tam_calca ?? '')
  const [tamCamisa, setTamCamisa] = useState(funcionario?.tam_camisa ?? '')
  const [tamSapato, setTamSapato] = useState(funcionario?.tam_sapato ?? '')
  const [observacoes, setObservacoes] = useState(funcionario?.observacoes ?? '')

  // Acesso ao sistema
  const [usuarioId, setUsuarioId] = useState(funcionario?.usuario_id ?? '')
  const [roleSel, setRoleSel] = useState<UserRole | ''>('')
  const [usuarios, setUsuarios] = useState<Profile[]>([])

  // Comissão
  const [recebeComissao, setRecebeComissao] = useState(funcionario?.recebe_comissao ?? false)
  const [regras, setRegras] = useState<RegraEdit[]>([])
  const [novoTipoCalc, setNovoTipoCalc] = useState<'percentual' | 'por_presenca_creche'>('percentual')
  const [novaArea, setNovaArea] = useState<AreaNegocio>('banho_tosa')
  const [novoPct, setNovoPct] = useState('')
  const [novoEscalona, setNovoEscalona] = useState(false)
  const [novoLimite, setNovoLimite] = useState(0)          // faturamento_limite
  const [novoPctAcima, setNovoPctAcima] = useState('')
  const [novoValorFixo, setNovoValorFixo] = useState(0)    // R$ por presença
  const [novaVigencia, setNovaVigencia] = useState('')     // a partir de

  useEffect(() => {
    const supabase = createClient()
    supabase.from('profiles').select('*').order('nome').then(({ data }) => {
      const lista = (data as Profile[]) ?? []
      setUsuarios(lista)
      if (funcionario?.usuario_id) {
        const u = lista.find(x => x.id === funcionario.usuario_id)
        if (u) setRoleSel(u.role)
      }
    })
    if (editId) {
      supabase.from('comissao_regras').select('*').eq('funcionario_id', editId).then(({ data }) => {
        const rs = (data as ComissaoRegra[]) ?? []
        setRegras(rs.map(r => ({
          tipo: r.tipo,
          percentual: String(r.percentual),
          tipo_calculo: r.tipo_calculo ?? 'percentual',
          valor_fixo: r.valor_fixo ?? null,
          faturamento_limite: r.faturamento_limite ?? null,
          percentual_acima: r.percentual_acima ?? null,
          vigencia_inicio: r.vigencia_inicio ?? null,
        })))
      })
    }
  }, [editId, funcionario?.usuario_id])

  function adicionarRegra() {
    setErro('')
    if (novoTipoCalc === 'por_presenca_creche') {
      const area: AreaNegocio = 'creche'
      if (!novoValorFixo || novoValorFixo <= 0) { setErro('Informe o valor por presença.'); return }
      if (regras.some(r => r.tipo === area)) { setErro('Já existe regra para a Creche.'); return }
      setRegras([...regras, {
        tipo: area, percentual: '0', tipo_calculo: 'por_presenca_creche',
        valor_fixo: novoValorFixo, faturamento_limite: null, percentual_acima: null,
        vigencia_inicio: novaVigencia || null,
      }])
    } else {
      const pct = parseFloat(novoPct.replace(',', '.'))
      if (isNaN(pct) || pct <= 0) { setErro('Informe um percentual válido.'); return }
      if (regras.some(r => r.tipo === novaArea)) { setErro('Já existe regra para essa área.'); return }
      let limite: number | null = null
      let pctAcima: number | null = null
      if (novoEscalona) {
        const pa = parseFloat(novoPctAcima.replace(',', '.'))
        if (!novoLimite || novoLimite <= 0 || isNaN(pa) || pa <= 0) {
          setErro('Preencha o faturamento-limite e o % acima para escalonar.'); return
        }
        limite = novoLimite; pctAcima = pa
      }
      setRegras([...regras, {
        tipo: novaArea, percentual: String(pct), tipo_calculo: 'percentual',
        valor_fixo: null, faturamento_limite: limite, percentual_acima: pctAcima,
        vigencia_inicio: null,
      }])
    }
    setNovoPct(''); setNovoPctAcima(''); setNovoValorFixo(0); setNovoLimite(0)
    setNovoEscalona(false); setNovaVigencia('')
  }

  function removerRegra(tipo: AreaNegocio) {
    setRegras(regras.filter(r => r.tipo !== tipo))
  }

  async function salvar() {
    if (!nome.trim()) { setErro('Informe o nome.'); return }
    setErro(''); setLoading(true)
    const supabase = createClient()

    // Foto
    let fotoUrl = fotoAtual
    if (fotoFile) {
      const fd = new FormData()
      fd.append('arquivo', fotoFile)
      const res = await fetch('/api/upload-foto-funcionario', { method: 'POST', body: fd })
      if (res.ok) { fotoUrl = (await res.json()).url }
      else { setLoading(false); setErro('Erro ao enviar foto.'); return }
    }

    const dados = {
      nome: nome.trim(),
      cpf: cpf || null,
      rg: rg || null,
      data_nascimento: nascimento || null,
      email: email || null,
      telefone: telefone || null,
      cargo: cargo || null,
      salario: salario ?? 0,
      data_admissao: admissao || null,
      dia_pagamento: diaPagamento === '' ? null : diaPagamento,
      tam_calca: tamCalca || null,
      tam_camisa: tamCamisa || null,
      tam_sapato: tamSapato || null,
      usuario_id: usuarioId || null,
      recebe_comissao: recebeComissao,
      observacoes: observacoes || null,
      foto_url: fotoUrl,
    }

    let funcId = editId
    if (editId) {
      const { error } = await supabase.from('funcionarios').update(dados).eq('id', editId)
      if (error) { setLoading(false); setErro(error.message); return }
    } else {
      const empresaId = await getEmpresaId(supabase)
      const { data, error } = await supabase.from('funcionarios')
        .insert({ ...dados, empresa_id: empresaId, ativo: true }).select('id').single()
      if (error || !data) { setLoading(false); setErro(error?.message ?? 'Erro ao salvar.'); return }
      funcId = data.id
    }

    // Sincroniza regras de comissão (substitui as existentes)
    if (funcId) {
      await supabase.from('comissao_regras').delete().eq('funcionario_id', funcId)
      if (recebeComissao && regras.length > 0) {
        // Preserva a configuração avançada (escalonamento / por presença) para
        // não apagar a regra ao editar outros dados do funcionário.
        await supabase.from('comissao_regras').insert(
          regras.map(r => ({
            funcionario_id: funcId,
            tipo: r.tipo,
            percentual: parseFloat(r.percentual) || 0,
            tipo_calculo: r.tipo_calculo ?? 'percentual',
            valor_fixo: r.valor_fixo ?? null,
            faturamento_limite: r.faturamento_limite ?? null,
            percentual_acima: r.percentual_acima ?? null,
            vigencia_inicio: r.vigencia_inicio ?? null,
          }))
        )
      }
    }

    // Atualiza o perfil de acesso vinculado (reaproveita o sistema de roles)
    if (usuarioId && roleSel) {
      await supabase.from('profiles').update({ role: roleSel }).eq('id', usuarioId)
    }

    router.push(funcId ? `/funcionarios/${funcId}` : '/funcionarios')
    router.refresh()
  }

  return (
    <div className="py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href={editId ? `/funcionarios/${editId}` : '/funcionarios'} className="p-2 rounded-xl text-gray-400">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">{editId ? 'Editar funcionário' : 'Cadastrar funcionário'}</h1>
      </div>

      <div className="flex flex-col gap-5">
        {/* Foto */}
        <section className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col items-center gap-3">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide self-start">Foto</h2>
          <FotoComCrop
            fotoAtual={fotoAtual}
            previewUrl={fotoPreview}
            onFotoProcessada={(file, preview) => { setFotoFile(file); setFotoPreview(preview); setFotoAtual(null) }}
            onRemover={() => { setFotoFile(null); setFotoPreview(null); setFotoAtual(null) }}
          />
        </section>

        {/* Dados pessoais */}
        <section className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-4">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Dados pessoais</h2>
          <Input label="Nome completo" value={nome} onChange={e => setNome(e.target.value)} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="CPF" value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" />
            <Input label="RG" value={rg} onChange={e => setRg(e.target.value)} />
          </div>
          <DateInput label="Data de nascimento" value={nascimento} onChange={setNascimento} />
          <Input label="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          <Input label="Telefone / WhatsApp" type="tel" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(32) 99999-9999" />
        </section>

        {/* Profissional */}
        <section className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-4">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Dados profissionais</h2>
          <Input label="Cargo" value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Ex: Recepção, Banho & Tosa..." />
          <CurrencyInput label="Salário mensal" value={salario} onChange={setSalario} />
          <div className="grid grid-cols-2 gap-3">
            <DateInput label="Data de admissão" value={admissao} onChange={setAdmissao} />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Dia do pagamento</label>
              <input type="number" min="1" max="31" value={diaPagamento}
                onChange={e => setDiaPagamento(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                placeholder="Ex: 5"
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white" />
            </div>
          </div>
        </section>

        {/* Uniformes */}
        <section className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-4">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Uniformes</h2>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Calça" value={tamCalca} onChange={e => setTamCalca(e.target.value)} placeholder="Ex: 42" />
            <Input label="Camisa" value={tamCamisa} onChange={e => setTamCamisa(e.target.value)} placeholder="Ex: M" />
            <Input label="Sapato" value={tamSapato} onChange={e => setTamSapato(e.target.value)} placeholder="Ex: 39" />
          </div>
        </section>

        {/* Acesso ao sistema */}
        <section className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-4">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Acesso ao sistema</h2>
          <p className="text-xs text-gray-400">
            Vincule este funcionário a um login para gerenciar o que ele vê e faz. Crie novos logins em Administração.
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">Usuário / login</label>
            <select value={usuarioId} onChange={e => {
              setUsuarioId(e.target.value)
              const u = usuarios.find(x => x.id === e.target.value)
              setRoleSel(u?.role ?? '')
            }}
              className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white">
              <option value="">Sem acesso ao sistema</option>
              {usuarios.map(u => (
                <option key={u.id} value={u.id}>{u.nome} ({u.email})</option>
              ))}
            </select>
          </div>
          {usuarioId && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Permissões (perfil de acesso)</label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map(r => (
                  <button key={r} type="button" onClick={() => setRoleSel(r)}
                    className={`py-2.5 rounded-2xl text-sm font-semibold border-2 transition-colors ${
                      roleSel === r ? 'border-brand-purple bg-purple-50 text-brand-purple' : 'border-gray-200 bg-white text-gray-600'
                    }`}>
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Comissão */}
        <section className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide flex items-center gap-1.5">
              <Percent size={14} /> Comissão
            </h2>
            <button type="button" onClick={() => setRecebeComissao(!recebeComissao)}
              className={`w-12 h-7 rounded-full transition-all relative ${recebeComissao ? 'bg-brand-teal' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${recebeComissao ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <p className="text-xs text-gray-400">Recebe comissão sobre serviços que executou?</p>

          {recebeComissao && (
            <div className="flex flex-col gap-3">
              {regras.length > 0 && (
                <div className="flex flex-col gap-2">
                  {regras.map(r => (
                    <div key={r.tipo} className="flex items-center gap-2 bg-teal-50 rounded-2xl px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-teal-800">{AREA_LABELS[r.tipo]}</span>
                        {r.tipo_calculo === 'por_presenca_creche' && (
                          <span className="block text-xs text-teal-600">
                            {formatCurrency(r.valor_fixo ?? 0)} por presença{r.vigencia_inicio ? ` · desde ${formatDate(r.vigencia_inicio)}` : ''}
                          </span>
                        )}
                        {r.tipo_calculo !== 'por_presenca_creche' && r.faturamento_limite != null && r.percentual_acima != null && (
                          <span className="block text-xs text-teal-600">
                            {r.percentual_acima}% quando o faturamento do mês passar de {formatCurrency(r.faturamento_limite)}
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-teal-700 flex-shrink-0">
                        {r.tipo_calculo === 'por_presenca_creche' ? `${formatCurrency(r.valor_fixo ?? 0)}/presença` : `${r.percentual}%`}
                      </span>
                      <button type="button" onClick={() => removerRegra(r.tipo)} className="text-red-400 p-1">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-3 bg-gray-50 rounded-2xl p-3">
                {/* Tipo de comissão */}
                <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-200">
                  <button type="button" onClick={() => setNovoTipoCalc('percentual')}
                    className={`flex-1 text-xs py-2 rounded-lg font-semibold transition-colors ${novoTipoCalc === 'percentual' ? 'bg-brand-teal text-white' : 'text-gray-500'}`}>
                    % do serviço
                  </button>
                  <button type="button" onClick={() => setNovoTipoCalc('por_presenca_creche')}
                    className={`flex-1 text-xs py-2 rounded-lg font-semibold transition-colors ${novoTipoCalc === 'por_presenca_creche' ? 'bg-brand-teal text-white' : 'text-gray-500'}`}>
                    R$ por presença (creche)
                  </button>
                </div>

                {novoTipoCalc === 'percentual' ? (
                  <>
                    <div className="flex items-end gap-2">
                      <div className="flex-1 flex flex-col gap-1">
                        <label className="text-xs font-semibold text-gray-500">Área</label>
                        <select value={novaArea} onChange={e => setNovaArea(e.target.value as AreaNegocio)}
                          className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 focus:border-brand-teal outline-none text-sm bg-white">
                          {AREAS_COMISSAO.map(a => (<option key={a} value={a}>{AREA_LABELS[a]}</option>))}
                        </select>
                      </div>
                      <div className="w-24 flex flex-col gap-1">
                        <label className="text-xs font-semibold text-gray-500">%</label>
                        <input type="number" inputMode="decimal" min="0" max="100" step="0.5" value={novoPct}
                          onChange={e => setNovoPct(e.target.value)} placeholder="5"
                          className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 focus:border-brand-teal outline-none text-sm" />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-600">
                      <input type="checkbox" checked={novoEscalona} onChange={e => setNovoEscalona(e.target.checked)} className="w-4 h-4 accent-brand-teal" />
                      Escalonar: aumentar o % quando o faturamento do mês passar de um valor
                    </label>
                    {novoEscalona && (
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <CurrencyInput label="Acima deste faturamento (mês)" value={novoLimite} onChange={setNovoLimite} />
                        </div>
                        <div className="w-24 flex flex-col gap-1">
                          <label className="text-xs font-semibold text-gray-500">passa a %</label>
                          <input type="number" inputMode="decimal" min="0" max="100" step="0.5" value={novoPctAcima}
                            onChange={e => setNovoPctAcima(e.target.value)} placeholder="10"
                            className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 focus:border-brand-teal outline-none text-sm" />
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs text-gray-500">Cada presença de cachorro na creche paga este valor.</p>
                    <CurrencyInput label="Valor por presença" value={novoValorFixo} onChange={setNovoValorFixo} />
                    <DateInput label="A partir de (opcional)" value={novaVigencia} onChange={setNovaVigencia} />
                  </div>
                )}

                <button type="button" onClick={adicionarRegra}
                  className="w-full py-2.5 rounded-xl bg-brand-teal text-white font-semibold text-sm flex items-center justify-center gap-1.5">
                  <Plus size={16} /> Adicionar regra
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Observações */}
        <section className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-3">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Observações</h2>
          <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3}
            className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-brand-purple outline-none text-base bg-white resize-none"
            placeholder="Anotações internas sobre o funcionário" />
        </section>

        {erro && <p className="text-sm text-red-500 text-center bg-red-50 rounded-2xl py-3">{erro}</p>}

        <Button size="lg" onClick={salvar} loading={loading}>
          {editId ? 'Salvar alterações' : 'Cadastrar funcionário'}
        </Button>
      </div>
    </div>
  )
}
