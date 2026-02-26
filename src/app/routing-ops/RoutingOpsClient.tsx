'use client';

import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { createRecord, updateRecord, deleteRecord } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { Modal } from '@/components/Modal';
import { RecordForm } from '@/components/RecordForm';

/* ═══════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════ */

const CHART_TOOLTIP = {
  contentStyle: { background: '#1a2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 },
  labelStyle: { color: '#94a3b8' },
  itemStyle: { color: '#f1f5f9' },
};
const AXIS_TICK = { fill: '#64748b', fontSize: 11 };
const GRID_STROKE = 'rgba(255,255,255,0.04)';
const PAGE_SIZE = 25;

const formFields = [
  { name: 'Operation Number', label: 'Op #', type: 'number' as const, required: true },
  { name: 'Operation Name', label: 'Name', type: 'text' as const, required: true },
  { name: 'Description', label: 'Description', type: 'textarea' as const },
  { name: 'Setup Time Mins', label: 'Setup Time (min)', type: 'number' as const },
  { name: 'Run Time Per Unit', label: 'Run Time/Unit (min)', type: 'number' as const },
  { name: 'Queue Time Mins', label: 'Queue Time (min)', type: 'number' as const },
  { name: 'Move Time Mins', label: 'Move Time (min)', type: 'number' as const },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
];

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function RoutingOpsClient({ operations: initialData }: { operations: Record<string, any>[] }) {
  const [records, setRecords] = useState(initialData);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'delete' | null>(null);
  const [selected, setSelected] = useState<Record<string, any> | null>(null);

  // ── KPI calculations ─────────────────────
  const stats = useMemo(() => {
    let totalSetup = 0;
    let totalRun = 0;
    let setupCount = 0;
    let runCount = 0;
    const wcIds = new Set<string>();

    for (const r of records) {
      const setup = Number(r['Setup Time Mins'] ?? 0);
      const run = Number(r['Run Time Per Unit'] ?? 0);
      if (setup > 0) { totalSetup += setup; setupCount++; }
      if (run > 0) { totalRun += run; runCount++; }
      const wcRef = r['Work Center'];
      const wcId = Array.isArray(wcRef) ? wcRef[0] : wcRef;
      if (wcId) wcIds.add(wcId);
    }

    return {
      totalOps: records.length,
      avgSetup: setupCount > 0 ? (totalSetup / setupCount).toFixed(1) : '0',
      avgRun: runCount > 0 ? (totalRun / runCount).toFixed(1) : '0',
      uniqueWC: wcIds.size,
    };
  }, [records]);

  // ── Chart: Setup + Run Time by Operation (stacked) ──
  const chartData = useMemo(() => {
    return records
      .filter((r) => r['Operation Name'])
      .map((r) => {
        const name = r['Operation Name'] || `Op ${r['Operation Number'] ?? '?'}`;
        return {
          name: name.length > 14 ? name.slice(0, 12) + '..' : name,
          setup: Number(r['Setup Time Mins'] ?? 0),
          run: Number(r['Run Time Per Unit'] ?? 0),
        };
      })
      .sort((a, b) => (a.name > b.name ? 1 : -1))
      .slice(0, 15);
  }, [records]);

  // ── Filtered & paginated ───────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter((r) =>
      (r['Operation Name'] || '').toLowerCase().includes(q) ||
      String(r['Operation Number'] ?? '').includes(q) ||
      (r['Description'] || '').toLowerCase().includes(q) ||
      (r['Notes'] || '').toLowerCase().includes(q)
    );
  }, [records, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── CRUD handlers ──────────────────────────
  const handleCreate = async (values: Record<string, any>) => {
    await createRecord(TABLES.ROUTING_OPERATIONS, values);
    setModalMode(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleUpdate = async (values: Record<string, any>) => {
    if (!selected) return;
    await updateRecord(TABLES.ROUTING_OPERATIONS, selected.id, values);
    setModalMode(null);
    setSelected(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleDelete = async () => {
    if (!selected) return;
    await deleteRecord(TABLES.ROUTING_OPERATIONS, selected.id);
    setRecords((prev) => prev.filter((r) => r.id !== selected.id));
    setModalMode(null);
    setSelected(null);
  };

  return (
    <div>
      {/* ── Header ───────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Routing Operations</h1>
          <p className="page-subtitle">Manufacturing process steps &mdash; setup times, run rates, and work centers</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setSelected(null); setModalMode('create'); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Operation
        </button>
      </div>

      {/* ── Stats Row ────────────────────────── */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Operations</div>
          <div className="kpi-value" style={{ color: '#6366f1' }}>{stats.totalOps}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Avg Setup Time</div>
          <div className="kpi-value" style={{ color: '#f97316' }}>{stats.avgSetup} min</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Avg Run Time/Unit</div>
          <div className="kpi-value" style={{ color: '#10b981' }}>{stats.avgRun} min</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Unique Work Centers</div>
          <div className="kpi-value" style={{ color: '#06b6d4' }}>{stats.uniqueWC}</div>
        </div>
      </div>

      {/* ── Chart ─────────────────────────────── */}
      {chartData.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 24 }}>
          <h3>Setup + Run Time by Operation</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
              <XAxis dataKey="name" tick={AXIS_TICK} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} interval={0} angle={-35} textAnchor="end" height={55} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={50} />
              <Tooltip {...CHART_TOOLTIP} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
              <Legend verticalAlign="top" iconType="circle" iconSize={8} formatter={(value: string) => <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 500 }}>{value}</span>} />
              <Bar dataKey="setup" name="Setup Time" stackId="a" fill="#6366f1" fillOpacity={0.85} radius={[0, 0, 0, 0]} maxBarSize={36} />
              <Bar dataKey="run" name="Run Time/Unit" stackId="a" fill="#f97316" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Data Table ────────────────────────── */}
      <div className="glass-card">
        <div className="toolbar">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            All Routing Operations
            <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: 'var(--text-dim)' }}>({filtered.length})</span>
          </h3>
          <div className="search-bar">
            <span className="search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
            </span>
            <input className="input" placeholder="Search operations..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ width: 260 }} />
          </div>
        </div>

        {paginated.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity={0.3}>
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
              </svg>
            </div>
            {search ? 'No records match your search' : 'No routing operations yet'}
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Op #</th>
                    <th>Name</th>
                    <th style={{ textAlign: 'right' }}>Setup (min)</th>
                    <th style={{ textAlign: 'right' }}>Run/Unit (min)</th>
                    <th style={{ textAlign: 'right' }}>Queue (min)</th>
                    <th style={{ textAlign: 'right' }}>Move (min)</th>
                    <th>Notes</th>
                    <th style={{ width: 90 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((r) => (
                    <tr key={r.id}>
                      <td><span className="mono-text">{r['Operation Number'] ?? '--'}</span></td>
                      <td style={{ fontWeight: 600, color: 'var(--text)' }}>{r['Operation Name'] || '--'}</td>
                      <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                        {Number(r['Setup Time Mins'] ?? 0).toFixed(0)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#f97316' }}>
                        {Number(r['Run Time Per Unit'] ?? 0).toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                        {Number(r['Queue Time Mins'] ?? 0).toFixed(0)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                        {Number(r['Move Time Mins'] ?? 0).toFixed(0)}
                      </td>
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
                  ))}
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
      <Modal open={modalMode === 'create'} onClose={() => setModalMode(null)} title="Add Routing Operation">
        <RecordForm fields={formFields} onSubmit={handleCreate} onCancel={() => setModalMode(null)} submitLabel="Create" />
      </Modal>

      {/* ── Edit Modal ────────────────────────── */}
      <Modal open={modalMode === 'edit'} onClose={() => { setModalMode(null); setSelected(null); }} title="Edit Routing Operation">
        {selected && (
          <RecordForm fields={formFields} initialValues={selected} onSubmit={handleUpdate} onCancel={() => { setModalMode(null); setSelected(null); }} submitLabel="Update" />
        )}
      </Modal>

      {/* ── Delete Confirmation ────────────────── */}
      <Modal open={modalMode === 'delete'} onClose={() => { setModalMode(null); setSelected(null); }} title="Delete Routing Operation">
        {selected && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Are you sure you want to delete <strong style={{ color: 'var(--text)' }}>{selected['Operation Name'] || 'this operation'}</strong>? This action cannot be undone.
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
