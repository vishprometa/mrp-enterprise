'use client'

import { CrudPage } from '@/components/CrudPage'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Operation Number', label: 'Operation Number' },
  { key: 'Name', label: 'Name' },
  { key: 'Setup Time Minutes', label: 'Setup Time Minutes' },
  { key: 'Run Time Minutes', label: 'Run Time Minutes' },
  { key: 'Move Time Minutes', label: 'Move Time Minutes' },
  { key: 'Queue Time Minutes', label: 'Queue Time Minutes' },
]

const formFields = [
  { name: 'Operation Number', label: 'Operation Number', type: 'number' as const, required: true },
  { name: 'Name', label: 'Name', type: 'text' as const, required: true },
  { name: 'Setup Time Minutes', label: 'Setup Time Minutes', type: 'number' as const },
  { name: 'Run Time Minutes', label: 'Run Time Minutes', type: 'number' as const },
  { name: 'Move Time Minutes', label: 'Move Time Minutes', type: 'number' as const },
  { name: 'Queue Time Minutes', label: 'Queue Time Minutes', type: 'number' as const },
  { name: 'Description', label: 'Description', type: 'textarea' as const },
]

export default function RoutingOpsPage() {
  return <CrudPage tableName={TABLES.ROUTING_OPERATIONS} title="Routing Operations" columns={columns} formFields={formFields} />
}
