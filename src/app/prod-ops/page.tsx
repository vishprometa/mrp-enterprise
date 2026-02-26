'use client';

import { CrudPage } from '@/components/CrudPage';
import { StatusBadge } from '@/components/StatusBadge';
import { TABLES } from '@/lib/tables';

const columns = [
  { key: 'Operation Number', label: 'Operation Number' },
  { key: 'Planned Start', label: 'Planned Start', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'Planned End', label: 'Planned End', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'Planned Duration Minutes', label: 'Planned Duration Minutes' },
  { key: 'Actual Duration Minutes', label: 'Actual Duration Minutes' },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
];

const formFields = [
  { name: 'Operation Number', label: 'Operation Number', type: 'number' as const, required: true },
  { name: 'Planned Start', label: 'Planned Start', type: 'date' as const },
  { name: 'Planned End', label: 'Planned End', type: 'date' as const },
  { name: 'Actual Start', label: 'Actual Start', type: 'date' as const },
  { name: 'Actual End', label: 'Actual End', type: 'date' as const },
  { name: 'Planned Duration Minutes', label: 'Planned Duration Minutes', type: 'number' as const },
  { name: 'Actual Duration Minutes', label: 'Actual Duration Minutes', type: 'number' as const },
  { name: 'Status', label: 'Status', type: 'select' as const, options: ['Pending', 'In Progress', 'Completed', 'Skipped'] },
];

export default function ProdOpsPage() {
  return (
    <CrudPage
      tableName={TABLES.PRODUCTION_ORDER_OPS}
      title="Production Order Operations"
      columns={columns}
      formFields={formFields}
    />
  );
}
