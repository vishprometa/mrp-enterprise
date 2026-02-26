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
const COLORS = ['#6366f1', '#f97316', '#10b981', '#06b6d4', '#f59e0b', '#a855f7'];
const PAGE_SIZE = 25;

const formFields = [
  { name: 'Quantity', label: 'Quantity', type: 'number' as const, required: true },
  { name: 'Unit Price', label: 'Unit Price', type: 'number' as const },
  { name: 'Total Price', label: 'Total Price', type: 'number' as const },
  { name: 'Received Qty', label: 'Received Qty', type: 'number' as const },
  { name: 'Status', label: 'Status', type: 'select' as const, options: ['Pending', 'Ordered', 'Partially Received', 'Received', 'Cancelled'] },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
];

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function PoLinesClient({ poLines: initialData }: { poLines: Record<string, any>[] }) {
  const [records, setRecords] = useState(initialData);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'delete' | null>(null);
  const [selected, setSelected] = useState<Record<string, any> | null>(null);

  // ── KPI calculations ─────────────────────
  const stats = useMemo(() => {
    let totalValue = 0;
    let totalUnitPrice = 0;
    let priceCount = 0;
    let totalQty = 0;
    let totalReceived = 0;

    for (const r of records) {
      totalValue += Number(r['Total Price'] ?? 0);
      const up = Number(r['Unit Price'] ?? 0);
      if (up > 0) { totalUnitPrice += up; priceCount++; }
      totalQty += Number(r['Quantity'] ?? 0);
      totalReceived += Number(r['Received Qty'] ?? 0);
    }

    return {
      totalLines: records.length,
      totalValue,
      avgUnitPrice: priceCount > 0 ? totalUnitPrice / priceCount : 0,
      receivedPct: totalQty > 0 ? ((totalReceived / totalQty) * 100).toFixed(1) : '0',
    };
  }, [records]);

  // ── Chart: Lines by Status ────────────────
  const chartData = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    for (const r of records) {
      const status = Array.isArray(r['Status']) ? r['Status'][0] : (r['Status'] || 'Unknown');
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    }
    return Object.entries(statusCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [records]);

  // ── Filtered & paginated ───────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter((r) => {
      const status = Array.isArray(r['Status']) ? r['Status'][0] : (r['Status'] || '');
      return (
        status.toLowerCase().includes(q) ||
        String(r['Quantity'] ?? '').includes(q) ||
        String(r['Total Price'] ?? '').includes(q) ||
        (r['Notes'] || '').toLowerCase().includes(q) ||
        String(r['Reference Number'] ?? '').toLowerCase().includes(q)
      );
    });
  }, [records, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── CRUD handlers ──────────────────────────
  const handleCreate = async (values: Record<string, any>) => {
    await createRecord(TABLES.PURCHASE_ORDER_LINES, values);
    setModalMode(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleUpdate = async (values: Record<string, any>) => {
    if (!selected) return;
    await updateRecord(TABLES.PURCHASE_ORDER_LINES, selected.id, values);
    setModalMode(null);
    setSelected(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleDelete = async () => {
    if (!selected) return;
    await deleteRecord(TABLES.PURCHASE_ORDER_LINES, selected.id);
    setRecords((prev) => prev.filter((r) => r.id !== selected.id));
    setModalMode(null);
    setSelected(null);
  };

  return (
    <div>
      {/* ── Header ───────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Purchase Order Lines</h1>
          <p className="page-subtitle">PO line items &mdash; quantities, pricing, and receiving status</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setSelected(null); setModalMode('create'); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Line
        </button>
      </div>

      {/* ── Stats Row ────────────────────────── */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Lines</div>
          <div className="kpi-value" style={{ color: '#6366f1' }}>{stats.totalLines}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Value</div>
          <div className="kpi-value" style={{ color: '#f97316' }}>${stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Avg Unit Price</div>
          <div className="kpi-value" style={{ color: '#10b981' }}>${stats.avgUnitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Received %</div>
          <div className="kpi-value" style={{ color: '#06b6d4' }}>{stats.receivedPct}%</div>
        </div>
      </div>

      {/* ── Chart ─────────────────────────────── */}
      {chartData.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 24 }}>
          <h3>Lines by Status</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value" stroke="none">
                {chartData.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...CHART_TOOLTIP} formatter={(value: any) => [value, 'Lines']} />
              <Legend verticalAlign="bottom" iconType="circle" iconSize={8} formatter={(value: string) => <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 500 }}>{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Data Table ────────────────────────── */}
      <div className="glass-card">
        <div className="toolbar">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            All PO Lines
            <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: 'var(--text-dim)' }}>({filtered.length})</span>
          </h3>
          <div className="search-bar">
            <span className="search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
            </span>
            <input className="input" placeholder="Search PO lines..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ width: 260 }} />
          </div>
        </div>

        {paginated.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity={0.3}>
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
              </svg>
            </div>
            {search ? 'No records match your search' : 'No purchase order lines yet'}
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'right' }}>Quantity</th>
                    <th style={{ textAlign: 'right' }}>Unit Price</th>
                    <th style={{ textAlign: 'right' }}>Total Price</th>
                    <th style={{ textAlign: 'right' }}>Received Qty</th>
                    <th>Status</th>
                    <th>Notes</th>
                    <th style={{ width: 90 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((r) => {
                    const status = Array.isArray(r['Status']) ? r['Status'][0] : r['Status'];
                    return (
                      <tr key={r.id}>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                          {Number(r['Quantity'] ?? 0).toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                          ${Number(r['Unit Price'] ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#10b981' }}>
                          ${Number(r['Total Price'] ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                          {Number(r['Received Qty'] ?? 0).toLocaleString()}
                        </td>
                        <td><StatusBadge value={status} /></td>
                        <td style={{ color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
      <Modal open={modalMode === 'create'} onClose={() => setModalMode(null)} title="Add PO Line">
        <RecordForm fields={formFields} onSubmit={handleCreate} onCancel={() => setModalMode(null)} submitLabel="Create" />
      </Modal>

      {/* ── Edit Modal ────────────────────────── */}
      <Modal open={modalMode === 'edit'} onClose={() => { setModalMode(null); setSelected(null); }} title="Edit PO Line">
        {selected && (
          <RecordForm fields={formFields} initialValues={selected} onSubmit={handleUpdate} onCancel={() => { setModalMode(null); setSelected(null); }} submitLabel="Update" />
        )}
      </Modal>

      {/* ── Delete Confirmation ────────────────── */}
      <Modal open={modalMode === 'delete'} onClose={() => { setModalMode(null); setSelected(null); }} title="Delete PO Line">
        {selected && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Are you sure you want to delete this PO line (Qty: {selected['Quantity'] ?? 'N/A'}, ${Number(selected['Total Price'] ?? 0).toLocaleString()})? This action cannot be undone.
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
