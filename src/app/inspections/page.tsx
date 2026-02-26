'use client';

import { CrudPage } from '@/components/CrudPage';
import { StatusBadge } from '@/components/StatusBadge';
import { TABLES } from '@/lib/tables';

const columns = [
  { key: 'Inspection Number', label: 'Inspection Number' },
  { key: 'Inspection Date', label: 'Inspection Date', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'Result', label: 'Result', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Inspector', label: 'Inspector' },
];

const formFields = [
  { name: 'Inspection Number', label: 'Inspection Number', type: 'text' as const, required: true },
  { name: 'Inspection Date', label: 'Inspection Date', type: 'date' as const, required: true },
  { name: 'Result', label: 'Result', type: 'select' as const, options: ['Pass', 'Fail', 'Conditional Pass'] },
  { name: 'Inspector', label: 'Inspector', type: 'text' as const },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
];

export default function InspectionsPage() {
  return (
    <CrudPage
      tableName={TABLES.QUALITY_INSPECTIONS}
      title="Quality Inspections"
      columns={columns}
      formFields={formFields}
    />
  );
}
