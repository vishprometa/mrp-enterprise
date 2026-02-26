'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Forecast Date', label: 'Forecast Date', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'Period', label: 'Period', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Quantity', label: 'Quantity' },
  { key: 'Confidence Pct', label: 'Confidence Pct' },
  { key: 'Method', label: 'Method', render: (v: any) => <StatusBadge value={v} /> },
]

const formFields = [
  { name: 'Forecast Date', label: 'Forecast Date', type: 'date' as const, required: true },
  { name: 'Period', label: 'Period', type: 'select' as const, options: ['Weekly', 'Monthly', 'Quarterly', 'Yearly'] },
  { name: 'Quantity', label: 'Quantity', type: 'number' as const, required: true },
  { name: 'Confidence Pct', label: 'Confidence Pct', type: 'number' as const },
  { name: 'Method', label: 'Method', type: 'select' as const, options: ['Historical', 'Moving Average', 'Exponential Smoothing', 'Manual', 'Regression'] },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
]

export default function ForecastsPage() {
  return <CrudPage tableName={TABLES.DEMAND_FORECASTS} title="Demand Forecasts" columns={columns} formFields={formFields} />
}
