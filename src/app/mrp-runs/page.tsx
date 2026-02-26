'use client';

import { CrudPage } from '@/components/CrudPage';
import { StatusBadge } from '@/components/StatusBadge';
import { TABLES } from '@/lib/tables';

const columns = [
  { key: 'Run Date', label: 'Run Date', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'Run Type', label: 'Run Type', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Duration Seconds', label: 'Duration Seconds' },
  { key: 'Total Recommendations', label: 'Total Recommendations' },
];

const formFields = [
  { name: 'Run Date', label: 'Run Date', type: 'date' as const, required: true },
  { name: 'Run Type', label: 'Run Type', type: 'select' as const, options: ['Full', 'Net Change', 'Selective'], required: true },
  { name: 'Status', label: 'Status', type: 'select' as const, options: ['Running', 'Completed', 'Failed'] },
  { name: 'Parameters', label: 'Parameters', type: 'textarea' as const },
  { name: 'Duration Seconds', label: 'Duration Seconds', type: 'number' as const },
  { name: 'Total Recommendations', label: 'Total Recommendations', type: 'number' as const },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
];

export default function MrpRunsPage() {
  return (
    <CrudPage
      tableName={TABLES.MRP_RUNS}
      title="MRP Runs"
      columns={columns}
      formFields={formFields}
    />
  );
}
