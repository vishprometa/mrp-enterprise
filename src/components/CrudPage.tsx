'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable } from './DataTable';
import { Modal } from './Modal';
import { RecordForm } from './RecordForm';
import { fetchRecords, createRecord, updateRecord, deleteRecord } from '@/lib/actions';
import type { TableName } from '@/lib/tables';

interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface CrudPageProps {
  tableName: TableName;
  title: string;
  columns: Column[];
  formFields: { name: string; label: string; type: string; options?: string[]; required?: boolean }[];
  pageSize?: number;
}

export function CrudPage({ tableName, title, columns, formFields, pageSize = 25 }: CrudPageProps) {
  const [data, setData] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<any>(null);
  const [detailRecord, setDetailRecord] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchRecords(tableName, page, pageSize, search || undefined);
      setData(res.data || []);
      setTotalCount(res.totalCount ?? res.data?.length ?? 0);
    } catch {
      setData([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [tableName, page, pageSize, search]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (values: Record<string, any>) => {
    await createRecord(tableName, values);
    setModalOpen(false);
    setPage(1);
    load();
  };

  const handleUpdate = async (values: Record<string, any>) => {
    if (!editRecord) return;
    await updateRecord(tableName, editRecord.id, values);
    setEditRecord(null);
    load();
  };

  const handleDelete = async (id: string) => {
    await deleteRecord(tableName, id);
    setDetailRecord(null);
    load();
  };

  return (
    <div>
      <DataTable
        title={title}
        columns={columns}
        data={data}
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onSearch={(q) => { setSearch(q); setPage(1); }}
        onRowClick={(row) => setDetailRecord(row)}
        loading={loading}
        actions={
          <button className="btn btn-primary" onClick={() => { setEditRecord(null); setModalOpen(true); }}>
            + New
          </button>
        }
      />

      {/* Create Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`New ${title.replace(/s$/, '')}`}>
        <RecordForm fields={formFields} onSubmit={handleCreate} onCancel={() => setModalOpen(false)} submitLabel="Create" />
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editRecord} onClose={() => setEditRecord(null)} title={`Edit ${title.replace(/s$/, '')}`}>
        {editRecord && (
          <RecordForm fields={formFields} initialValues={editRecord} onSubmit={handleUpdate} onCancel={() => setEditRecord(null)} submitLabel="Update" />
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detailRecord && !editRecord} onClose={() => setDetailRecord(null)} title="Record Details">
        {detailRecord && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {Object.entries(detailRecord).filter(([k]) => k !== 'id' && k !== 'createdAt' && k !== 'updatedAt' && k !== 'createdBy').map(([key, val]) => (
                <div key={key}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 2 }}>{key}</div>
                  <div style={{ fontSize: 14 }}>{val == null ? '—' : String(val)}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(detailRecord.id)}>Delete</button>
              <button className="btn btn-primary btn-sm" onClick={() => { setEditRecord(detailRecord); }}>Edit</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
