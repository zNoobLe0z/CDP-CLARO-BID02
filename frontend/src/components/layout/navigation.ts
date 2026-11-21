import {
  LayoutDashboard,
  ClipboardList,
  History,
  Users,
  Layers3,
  Settings2,
} from 'lucide-react'
export const navigation = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    group: 'Visão geral',
    icon: LayoutDashboard,
    description: 'Avanço físico e indicadores de produção',
  },
  {
    to: '/producao',
    label: 'Produção',
    group: 'Operação de campo',
    icon: ClipboardList,
    description: 'Apontamentos diários por local e atividade',
  },
  {
    to: '/historico',
    label: 'Histórico',
    group: 'Operação de campo',
    icon: History,
    description: 'Medições, rastreabilidade e correções',
  },
  {
    to: '/efetivo',
    label: 'Efetivo',
    group: 'Operação de campo',
    icon: Users,
    description: 'Presença diária por empresa',
  },
  {
    to: '/cadastros',
    label: 'Escopo e cadastros',
    group: 'Estrutura da obra',
    icon: Layers3,
    description: 'Elementos, atividades e quantidades previstas',
  },
  {
    to: '/administracao',
    label: 'Administrar',
    group: 'Estrutura da obra',
    icon: Settings2,
    description: 'Configuração do catálogo e auditoria',
    admin: true,
  },
]
export function availableNavigation(admin: boolean) {
  return navigation.filter((item) => !item.admin || admin)
}
export function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
}
