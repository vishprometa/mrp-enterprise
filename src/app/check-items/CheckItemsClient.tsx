'use client';

import { useState, useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { createRecord, updateRecord, deleteRecord } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { Modal } from '@/components/Modal';
import { RecordForm } from '@/components/RecordForm';
import { StatusBadge } from '@/components/StatusBadge';

/* ═══════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════ */

const CHART_TOOLTIP = {
  contentStyle: { background: '#1a2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 },
  labelStyle: { color: '#94a3b8' },
  itemStyle: { color: '#f1f5f9' },
};
const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#64748b', '#6366f1', '#a855f7'];
const PAGE_SIZE = 25;

const formFields = [
  { name: 'Check Name', label: 'Check Name', type: 'text' as const, required: true },
  { name: 'Parameter', label: 'Parameter', type: 'text' as const },
  { name: 'Target Value', label: 'Target Value', type: 'text' as const },
  { name: 'Actual Value', label: 'Actual Value', type: 'text' as const },
  { name: 'Tolerance', label: 'Tolerance', type: 'text' as const },
  { name: 'Result', label: 'Result', type: 'select' as const, options: ['Pass', 'Fail', 'Conditional', 'Pending'] },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
];

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function CheckItemsClient({ checkItems: initialData }: { checkItems: Record<string, any>[] }) {
  const [records, setRecords] = useState(initialData);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'delete' | null>(null);
  const [selected, setSelected] = useState<Record<string, any> | null>(null);

  // ── KPI calculations ─────────────────────
  const stats = useMemo(() => {
    let passCount = 0;
    let failCount = 0;

    for (const r of records) {
      const result = Array.isArray(r['Result']) ? r['Result'][0] : (r['Result'] || '');
      if (result === 'Pass') passCount++;
      if (result === 'Fail') failCount++;
    }

    const total = records.length;
    const passRate = total > 0 ? ((passCount / total) * 100).toFixed(1) : '0';

    return { total, passCount, failCount, passRate };
  }, [records]);

  // ── Chart: Results Distribution ───────────
  const chartData = useMemo(() => {
    const resultCounts: Record<string, number> = {};
    for (const r of records) {
      const result = Array.isArray(r['Result']) ? r['Result'][0] : (r['Result'] || 'Unknown');
      resultCounts[result] = (resultCounts[result] || 0) + 1;
    }
    return Object.entries(resultCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [records]);

  // ── Filtered & paginated ───────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter((r) => {
      const result = Array.isArray(r['Result']) ? r['Result'][0] : (r['Result'] || '');
      return (
        (r['Check Name'] || '').toLowerCase().includes(q) ||
        (r['Parameter'] || '').toLowerCase().includes(q) ||
        result.toLowerCase().includes(q) ||
        (r['Target Value'] || '').toLowerCase().includes(q) ||
        (r['Actual Value'] || '').toLowerCase().includes(q) ||
        (r['Notes'] || '').toLowerCase().includes(q)
      );
    });
  }, [records, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── CRUD handlers ──────────────────────────
  const handleCreate = async (values: Record<string, any>) => {
    await createRecord(TABLES.QUALITY_CHECK_ITEMS, values);
    setModalMode(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleUpdate = async (values: Record<string, any>) => {
    if (!selected) return;
    await updateRecord(TABLES.QUALITY_CHECK_ITEMS, selected.id, values);
    setModalMode(null);
    setSelected(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleDelete = async () => {
    if (!selected) return;
    await deleteRecord(TABLES.QUALITY_CHECK_ITEMS, selected.id);
    setRecords((prev) => prev.filter((r) => r.id !== selected.id));
    setModalMode(null);
    setSelected(null);
  };

  return (
    <div>
      {/* ── Header ───────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Quality Check Items</h1>
          <p className="page-subtitle">Inspection checklist items &mdash; parameter measurements, tolerances, and pass/fail results</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setSelected(null); setModalMode('create'); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Check
        </button>
      </div>

      {/* ── Stats Row ────────────────────────── */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Checks</div>
          <div className="kpi-value" style={{ color: '#6366f1' }}>{stats.total}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Pass Count</div>
          <div className="kpi-value" style={{ color: '#10b981' }}>{stats.passCount}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Fail Count</div>
          <div className="kpi-value" style={{ color: '#ef4444' }}>{stats.failCount}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Pass Rate</div>
          <div className="kpi-value" style={{ color: Number(stats.passRate) >= 90 ? '#10b981' : Number(stats.passRate) >= 70 ? '#f59e0b' : '#ef4444' }}>{stats.passRate}%</div>
        </div>
      </div>

      {/* ── Chart ─────────────────────────────── */}
      {chartData.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 24 }}>
          <h3>Results Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value" stroke="none">
                {chartData.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...CHART_TOOLTIP} formatter={(value: any) => [value, 'Checks']} />
              <Legend verticalAlign="bottom" iconType="circle" iconSize={8} formatter={(value: string) => <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 500 }}>{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Data Table ────────────────────────── */}
      <div className="glass-card">
        <div className="toolbar">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            All Check Items
            <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: 'var(--text-dim)' }}>({filtered.length})</span>
          </h3>
          <div className="search-bar">
            <span className="search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
            </span>
            <input className="input" placeholder="Search checks..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ width: 260 }} />
          </div>
        </div>

        {paginated.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity={0.3}>
                <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
              </svg>
            </div>
            {search ? 'No records match your search' : 'No quality check items yet'}
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Check Name</th>
                    <th>Parameter</th>
                    <th>Target</th>
                    <th>Actual</th>
                    <th>Tolerance</th>
                    <th>Result</th>
                    <th>Notes</th>
                    <th style={{ width: 90 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((r) => {
                    const result = Array.isArray(r['Result']) ? r['Result'][0] : r['Result'];
                    return (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600, color: 'var(--text)' }}>{r['Check Name'] || '--'}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{r['Parameter'] || '--'}</td>
                        <td><span className="mono-text">{r['Target Value'] || '--'}</span></td>
                        <td><span className="mono-text">{r['Actual Value'] || '--'}</span></td>
                        <td><span className="mono-text">{r['Tolerance'] || '--'}</span></td>
                        <td><StatusBadge value={result} /></td>
                        <td style={{ color: 'var(--text-muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r['Notes'] || '--'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(r); setModalMode('edit'); }} title="Edit">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(r); setModalMode('delete'); }} title="Delete" style={{ color: 'var(--danger)' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <div className="pagination-info">
                  Showing {(page - 1) * PAGE_SIZE + 1}&ndash;{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
                  <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Create Modal ──────────────────────── */}
      <Modal open={modalMode === 'create'} onClose={() => setModalMode(null)} title="Add Quality Check">
        <RecordForm fields={formFields} onSubmit={handleCreate} onCancel={() => setModalMode(null)} submitLabel="Create" />
      </Modal>

      {/* ── Edit Modal ────────────────────────── */}
      <Modal open={modalMode === 'edit'} onClose={() => { setModalMode(null); setSelected(null); }} title="Edit Quality Check">
        {selected && (
          <RecordForm fields={formFields} initialValues={selected} onSubmit={handleUpdate} onCancel={() => { setModalMode(null); setSelected(null); }} submitLabel="Update" />
        )}
      </Modal>

      {/* ── Delete Confirmation ────────────────── */}
      <Modal open={modalMode === 'delete'} onClose={() => { setModalMode(null); setSelected(null); }} title="Delete Quality Check">
        {selected && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Are you sure you want to delete <strong style={{ color: 'var(--text)' }}>{selected['Check Name'] || 'this check item'}</strong>? This action cannot be undone.
            </p>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => { setModalMode(null); setSelected(null); }}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
