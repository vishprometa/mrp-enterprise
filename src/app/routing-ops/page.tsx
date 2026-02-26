'use client'

import { CrudPage } from '@/components/CrudPage'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Operation Number', label: 'Operation Number' },
  { key: 'Operation Name', label: 'Operation Name' },
  { key: 'Setup Time Mins', label: 'Setup Time Mins' },
  { key: 'Run Time Per Unit', label: 'Run Time Per Unit' },
  { key: 'Queue Time Mins', label: 'Queue Time Mins' },
  { key: 'Move Time Mins', label: 'Move Time Mins' },
]

const formFields = [
  { name: 'Operation Number', label: 'Operation Number', type: 'number' as const, required: true },
  { name: 'Operation Name', label: 'Operation Name', type: 'text' as const, required: true },
  { name: 'Description', label: 'Description', type: 'textarea' as const },
  { name: 'Setup Time Mins', label: 'Setup Time Mins', type: 'number' as const },
  { name: 'Run Time Per Unit', label: 'Run Time Per Unit', type: 'number' as const },
  { name: 'Queue Time Mins', label: 'Queue Time Mins', type: 'number' as const },
  { name: 'Move Time Mins', label: 'Move Time Mins', type: 'number' as const },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
]

export default function RoutingOpsPage() {
  return <CrudPage tableName={TABLES.ROUTING_OPERATIONS} title="Routing Operations" columns={columns} formFields={formFields} />
}
