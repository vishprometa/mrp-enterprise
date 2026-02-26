'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';
import { createRecord, updateRecord, deleteRecord } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { Modal } from '@/components/Modal';
import { RecordForm } from '@/components/RecordForm';
import { StatusBadge } from '@/components/StatusBadge';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

interface Props {
  orders: Record<string, any>[];
  suppliers: Record<string, any>[];
}

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
const COLORS = ['#6366f1', '#f97316', '#10b981', '#06b6d4', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6'];

const PIPELINE_STAGES = ['Draft', 'Approved', 'Ordered', 'Partially Received', 'Received', 'Cancelled'] as const;
const PIPELINE_COLORS: Record<string, string> = {
  Draft: '#64748b',
  Approved: '#10b981',
  Ordered: '#6366f1',
  'Partially Received': '#a855f7',
  Received: '#06b6d4',
  Cancelled: '#ef4444',
};

const PRIORITY_COLORS: Record<string, string> = {
  Urgent: '#ef4444',
  High: '#f97316',
  Medium: '#f59e0b',
  Low: '#06b6d4',
};

const formFields = [
  { name: 'PO Number', label: 'PO Number', type: 'text' as const, required: true },
  { name: 'Order Date', label: 'Order Date', type: 'date' as const, required: true },
  { name: 'Expected Date', label: 'Expected Date', type: 'date' as const },
  { name: 'Status', label: 'Status', type: 'select' as const, options: ['Draft', 'Approved', 'Ordered', 'Partially Received', 'Received', 'Cancelled'] },
  { name: 'Total Amount', label: 'Total Amount', type: 'number' as const },
  { name: 'Priority', label: 'Priority', type: 'select' as const, options: ['Low', 'Medium', 'High', 'Urgent'] },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
];

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */

function formatCurrency(val: any): string {
  const n = Number(val);
  if (isNaN(n)) return '$0';
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatMonth(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Unknown';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  } catch {
    return 'Unknown';
  }
}

function resolveStatus(order: Record<string, any>): string {
  const s = order['Status'];
  if (Array.isArray(s)) return s[0] || 'Unknown';
  return String(s ?? 'Unknown');
}

function resolvePriority(order: Record<string, any>): string {
  const p = order['Priority'];
  if (Array.isArray(p)) return p[0] || '';
  return String(p ?? '');
}

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function PurchaseOrdersClient({ orders: initialOrders, suppliers }: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view' | 'delete' | null>(null);
  const [selected, setSelected] = useState<Record<string, any> | null>(null);

  // ── Supplier lookup ──────────────────────────
  const supplierMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of suppliers) {
      if (s.id) {
        m[s.id] = s['Supplier Name'] || s['Name'] || s['Company Name'] || `Supplier ${s.id.slice(-4)}`;
      }
    }
    return m;
  }, [suppliers]);

  const resolveSupplier = useCallback((order: Record<string, any>) => {
    const ref = order['Supplier'];
    const id = Array.isArray(ref) ? ref[0] : ref;
    return id ? supplierMap[id] : null;
  }, [supplierMap]);

  // ── KPI calculations ─────────────────────────
  const kpis = useMemo(() => {
    let totalSpend = 0;
    let pendingCount = 0;
    const activeSupplierIds = new Set<string>();

    for (const o of orders) {
      totalSpend += Number(o['Total Amount'] ?? 0);
      const status = resolveStatus(o);
      if (status === 'Draft' || status === 'Approved') pendingCount++;
      const ref = o['Supplier'];
      const id = Array.isArray(ref) ? ref[0] : ref;
      if (id) activeSupplierIds.add(id);
    }

    return { totalPOs: orders.length, totalSpend, pendingCount, activeSuppliers: activeSupplierIds.size };
  }, [orders]);

  // ── Pipeline data ────────────────────────────
  const pipelineData = useMemo(() => {
    const counts: Record<string, { count: number; amount: number }> = {};
    for (const stage of PIPELINE_STAGES) {
      counts[stage] = { count: 0, amount: 0 };
    }
    for (const o of orders) {
      const status = resolveStatus(o);
      if (counts[status]) {
        counts[status].count++;
        counts[status].amount += Number(o['Total Amount'] ?? 0);
      }
    }
    const maxCount = Math.max(...Object.values(counts).map((c) => c.count), 1);
    return PIPELINE_STAGES.map((stage) => ({
      stage,
      ...counts[stage],
      isMax: counts[stage].count === maxCount && maxCount > 0,
    }));
  }, [orders]);

  // ── Chart: Monthly PO Spend ──────────────────
  const monthlySpend = useMemo(() => {
    const months: Record<string, number> = {};
    for (const o of orders) {
      const date = o['Order Date'];
      if (!date) continue;
      const month = formatMonth(date);
      if (month === 'Unknown') continue;
      months[month] = (months[month] || 0) + Number(o['Total Amount'] ?? 0);
    }
    return Object.entries(months)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime())
      .slice(-12);
  }, [orders]);

  // ── Chart: Spend by Supplier (top 5) ─────────
  const supplierSpend = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const o of orders) {
      const name = resolveSupplier(o) || 'Unknown';
      totals[name] = (totals[name] || 0) + Number(o['Total Amount'] ?? 0);
    }
    const sorted = Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    if (sorted.length <= 5) return sorted;
    const top5 = sorted.slice(0, 5);
    const otherTotal = sorted.slice(5).reduce((sum, s) => sum + s.value, 0);
    if (otherTotal > 0) top5.push({ name: 'Other', value: otherTotal });
    return top5;
  }, [orders, resolveSupplier]);

  // ── Filtered + grouped ───────────────────────
  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const status = resolveStatus(o);
      const priority = resolvePriority(o);
      if (statusFilter !== 'All' && status !== statusFilter) return false;
      if (priorityFilter !== 'All' && priority !== priorityFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const supplier = resolveSupplier(o) || '';
        return (
          (o['PO Number'] || '').toLowerCase().includes(q) ||
          supplier.toLowerCase().includes(q) ||
          (o['Notes'] || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orders, search, statusFilter, priorityFilter, resolveSupplier]);

  const groupedByStatus = useMemo(() => {
    const groups: Record<string, Record<string, any>[]> = {};
    for (const stage of PIPELINE_STAGES) {
      groups[stage] = [];
    }
    for (const o of filtered) {
      const status = resolveStatus(o);
      if (!groups[status]) groups[status] = [];
      groups[status].push(o);
    }
    return groups;
  }, [filtered]);

  // ── CRUD handlers ────────────────────────────
  const handleCreate = async (values: Record<string, any>) => {
    await createRecord(TABLES.PURCHASE_ORDERS, values);
    setModalMode(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleUpdate = async (values: Record<string, any>) => {
    if (!selected) return;
    await updateRecord(TABLES.PURCHASE_ORDERS, selected.id, values);
    setModalMode(null);
    setSelected(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleDelete = async () => {
    if (!selected) return;
    await deleteRecord(TABLES.PURCHASE_ORDERS, selected.id);
    setOrders((prev) => prev.filter((r) => r.id !== selected.id));
    setModalMode(null);
    setSelected(null);
  };

  const openEdit = (record: Record<string, any>) => {
    setSelected(record);
    setModalMode('edit');
  };

  const openView = (record: Record<string, any>) => {
    setSelected(record);
    setModalMode('view');
  };

  const openDelete = (record: Record<string, any>) => {
    setSelected(record);
    setModalMode('delete');
  };

  // ── Unique statuses/priorities for filters ───
  const allStatuses = useMemo(() => {
    const s = new Set<string>();
    for (const o of orders) s.add(resolveStatus(o));
    return ['All', ...PIPELINE_STAGES.filter((st) => s.has(st))];
  }, [orders]);

  const allPriorities = useMemo(() => {
    const p = new Set<string>();
    for (const o of orders) {
      const pr = resolvePriority(o);
      if (pr) p.add(pr);
    }
    return ['All', ...['Urgent', 'High', 'Medium', 'Low'].filter((pr) => p.has(pr))];
  }, [orders]);

  return (
    <div>
      {/* ── Header ───────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Purchase Orders</h1>
          <p className="page-subtitle">Procurement pipeline &mdash; track orders from draft to delivery</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setSelected(null); setModalMode('create'); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New PO
        </button>
      </div>

      {/* ── KPI Row ──────────────────────────────── */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total POs</div>
          <div className="kpi-value" style={{ color: '#6366f1' }}>{kpis.totalPOs}</div>
          <div className="kpi-trend neutral">{filtered.length} shown after filters</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Spend</div>
          <div className="kpi-value" style={{ color: '#10b981' }}>{formatCurrency(kpis.totalSpend)}</div>
          <div className="kpi-trend neutral">
            Avg {formatCurrency(kpis.totalPOs > 0 ? kpis.totalSpend / kpis.totalPOs : 0)} per order
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Pending</div>
          <div className="kpi-value" style={{ color: kpis.pendingCount > 0 ? '#f59e0b' : '#10b981' }}>
            {kpis.pendingCount}
          </div>
          <div className="kpi-trend neutral">Draft + Approved</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Active Suppliers</div>
          <div className="kpi-value" style={{ color: '#06b6d4' }}>{kpis.activeSuppliers}</div>
          <div className="kpi-trend neutral">{suppliers.length} total registered</div>
        </div>
      </div>

      {/* ── Pipeline ─────────────────────────────── */}
      <div className="pipeline">
        {pipelineData.map((p) => (
          <div
            key={p.stage}
            className={`pipeline-stage${p.isMax ? ' active' : ''}`}
            onClick={() => setStatusFilter(statusFilter === p.stage ? 'All' : p.stage)}
            style={{ cursor: 'pointer', borderBottom: `3px solid ${PIPELINE_COLORS[p.stage] || 'var(--border)'}` }}
          >
            <div className="pipeline-count" style={{ color: PIPELINE_COLORS[p.stage] || 'var(--text)' }}>
              {p.count}
            </div>
            <div className="pipeline-label">{p.stage}</div>
            <div className="pipeline-value">{formatCurrency(p.amount)}</div>
          </div>
        ))}
      </div>

      {/* ── Charts ───────────────────────────────── */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="chart-card">
          <h3>Monthly PO Spend</h3>
          {monthlySpend.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No order date data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlySpend} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis
                  dataKey="name"
                  tick={AXIS_TICK}
                  axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                  tickLine={false}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={55}
                />
                <YAxis
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                  tickFormatter={(v) => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)}
                />
                <Tooltip
                  {...CHART_TOOLTIP}
                  cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                  formatter={(value: any) => [formatCurrency(value), 'Spend']}
                />
                <Bar dataKey="amount" name="Spend" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {monthlySpend.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="chart-card">
          <h3>Spend by Supplier</h3>
          {supplierSpend.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No supplier data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={supplierSpend}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {supplierSpend.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  {...CHART_TOOLTIP}
                  formatter={(value: any) => [formatCurrency(value), 'Spend']}
                />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => (
                    <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 500 }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Filters ──────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="search-bar">
          <span className="search-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </span>
          <input
            className="input"
            placeholder="Search PO number, supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {allStatuses.map((s) => (
            <button
              key={s}
              className={`filter-pill${statusFilter === s ? ' active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {allPriorities.map((p) => (
            <button
              key={p}
              className={`filter-pill${priorityFilter === p ? ' active' : ''}`}
              onClick={() => setPriorityFilter(p)}
              style={p !== 'All' && PRIORITY_COLORS[p] ? { borderColor: statusFilter === 'All' && priorityFilter === p ? PRIORITY_COLORS[p] + '60' : undefined } : undefined}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* ── PO Cards by Status ───────────────────── */}
      {filtered.length === 0 ? (
        <div className="glass-card">
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity={0.3}>
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
              </svg>
            </div>
            {search || statusFilter !== 'All' || priorityFilter !== 'All'
              ? 'No purchase orders match your filters'
              : 'No purchase orders yet'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {PIPELINE_STAGES.map((stage) => {
            const stageOrders = groupedByStatus[stage] || [];
            if (stageOrders.length === 0) return null;
            return (
              <div key={stage}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: PIPELINE_COLORS[stage] || 'var(--text-dim)',
                      boxShadow: `0 0 8px ${PIPELINE_COLORS[stage] || 'transparent'}40`,
                    }}
                  />
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                    {stage}
                  </h3>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>
                    ({stageOrders.length})
                  </span>
                </div>
                <div className="product-grid">
                  {stageOrders.map((order) => {
                    const supplier = resolveSupplier(order);
                    const priority = resolvePriority(order);
                    const amount = Number(order['Total Amount'] ?? 0);

                    return (
                      <div key={order.id} className="product-card" onClick={() => openView(order)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <span className="mono-text" style={{ fontSize: 12, fontWeight: 700, color: '#6366f1' }}>
                            {order['PO Number'] || '--'}
                          </span>
                          {priority && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                padding: '2px 8px',
                                borderRadius: 100,
                                background: (PRIORITY_COLORS[priority] || '#64748b') + '20',
                                color: PRIORITY_COLORS[priority] || '#64748b',
                              }}
                            >
                              {priority}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                          {supplier || 'Unknown Supplier'}
                        </div>
                        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                          {order['Order Date'] && (
                            <span>Ordered: {new Date(order['Order Date']).toLocaleDateString()}</span>
                          )}
                          {order['Expected Date'] && (
                            <span>Expected: {new Date(order['Expected Date']).toLocaleDateString()}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border-light)' }}>
                          <span style={{ fontSize: 18, fontWeight: 800, color: '#10b981', letterSpacing: '-0.02em' }}>
                            {formatCurrency(amount)}
                          </span>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={(e) => { e.stopPropagation(); openEdit(order); }}
                              title="Edit"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={(e) => { e.stopPropagation(); openDelete(order); }}
                              title="Delete"
                              style={{ color: 'var(--danger)' }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Modal ─────────────────────────── */}
      <Modal open={modalMode === 'create'} onClose={() => setModalMode(null)} title="New Purchase Order">
        <RecordForm fields={formFields} onSubmit={handleCreate} onCancel={() => setModalMode(null)} submitLabel="Create" />
      </Modal>

      {/* ── Edit Modal ───────────────────────────── */}
      <Modal open={modalMode === 'edit'} onClose={() => { setModalMode(null); setSelected(null); }} title="Edit Purchase Order">
        {selected && (
          <RecordForm
            fields={formFields}
            initialValues={selected}
            onSubmit={handleUpdate}
            onCancel={() => { setModalMode(null); setSelected(null); }}
            submitLabel="Update"
          />
        )}
      </Modal>

      {/* ── View Modal ───────────────────────────── */}
      <Modal open={modalMode === 'view'} onClose={() => { setModalMode(null); setSelected(null); }} title="Purchase Order Detail">
        {selected && (() => {
          const supplier = resolveSupplier(selected);
          const status = resolveStatus(selected);
          const priority = resolvePriority(selected);
          return (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div>
                  <span className="mono-text" style={{ fontSize: 14, fontWeight: 700, color: '#6366f1' }}>
                    {selected['PO Number'] || '--'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <StatusBadge value={status} />
                  {priority && <StatusBadge value={priority} />}
                </div>
              </div>
              <div className="detail-grid">
                <div>
                  <div className="detail-field-label">Supplier</div>
                  <div className="detail-field-value">{supplier || '--'}</div>
                </div>
                <div>
                  <div className="detail-field-label">Total Amount</div>
                  <div className="detail-field-value" style={{ color: '#10b981', fontWeight: 700 }}>
                    {formatCurrency(selected['Total Amount'])}
                  </div>
                </div>
                <div>
                  <div className="detail-field-label">Order Date</div>
                  <div className="detail-field-value">
                    {selected['Order Date'] ? new Date(selected['Order Date']).toLocaleDateString() : '--'}
                  </div>
                </div>
                <div>
                  <div className="detail-field-label">Expected Date</div>
                  <div className="detail-field-value">
                    {selected['Expected Date'] ? new Date(selected['Expected Date']).toLocaleDateString() : '--'}
                  </div>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <div className="detail-field-label">Notes</div>
                  <div className="detail-field-value">{selected['Notes'] || '--'}</div>
                </div>
              </div>
              <div className="form-actions">
                <button className="btn btn-secondary" onClick={() => { setModalMode(null); setSelected(null); }}>Close</button>
                <button className="btn btn-primary" onClick={() => { setModalMode('edit'); }}>Edit</button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ── Delete Confirmation ──────────────────── */}
      <Modal open={modalMode === 'delete'} onClose={() => { setModalMode(null); setSelected(null); }} title="Delete Purchase Order">
        {selected && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Are you sure you want to delete purchase order{' '}
              <strong className="mono-text" style={{ color: 'var(--text)' }}>{selected['PO Number'] || selected.id}</strong>?
              This action cannot be undone.
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
