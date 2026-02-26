'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable } from './DataTable';
import { Modal } from './Modal';
import { RecordForm } from './RecordForm';
import { fetchRecords, createRecord, updateRecord, deleteRecord } from '@/lib/actions';
import type { TableName } from '@/lib/tables';
import { StatusBadge } from './StatusBadge';

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
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New {title.replace(/s$/, '')}
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
            <div className="detail-grid" style={{ marginBottom: 24 }}>
              {Object.entries(detailRecord)
                .filter(([k]) => !['id', 'createdAt', 'updatedAt', 'createdBy'].includes(k))
                .map(([key, val]) => (
                  <div key={key}>
                    <div className="detail-field-label">{key}</div>
                    <div className="detail-field-value">
                      {val == null || val === '' ? (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      ) : typeof val === 'boolean' ? (
                        <StatusBadge value={val ? 'Active' : 'Inactive'} />
                      ) : (
                        String(val)
                      )}
                    </div>
                  </div>
                ))}
            </div>
            <div className="form-actions" style={{ marginTop: 0, paddingTop: 16 }}>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(detailRecord.id)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Delete
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => { setEditRecord(detailRecord); }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
