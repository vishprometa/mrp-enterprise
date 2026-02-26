'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Forecast Period', label: 'Forecast Period' },
  { key: 'Forecast Date', label: 'Forecast Date', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'Quantity', label: 'Quantity' },
  { key: 'Confidence Percent', label: 'Confidence Percent' },
  { key: 'Method', label: 'Method' },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
]

const formFields = [
  { name: 'Forecast Period', label: 'Forecast Period', type: 'text' as const, required: true },
  { name: 'Forecast Date', label: 'Forecast Date', type: 'date' as const, required: true },
  { name: 'Quantity', label: 'Quantity', type: 'number' as const, required: true },
  { name: 'Confidence Percent', label: 'Confidence Percent', type: 'number' as const },
  {
    name: 'Method',
    label: 'Method',
    type: 'select' as const,
    options: ['Historical', 'Moving Average', 'Exponential Smoothing', 'Manual'],
  },
  {
    name: 'Status',
    label: 'Status',
    type: 'select' as const,
    options: ['Draft', 'Active', 'Approved'],
  },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
]

export default function ForecastsPage() {
  return <CrudPage tableName={TABLES.DEMAND_FORECASTS} title="Demand Forecasts" columns={columns} formFields={formFields} />
}
