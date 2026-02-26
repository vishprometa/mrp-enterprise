'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
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
  poLines: Record<string, any>[];
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
const COLORS = ['#6366f1', '#f97316', '#10b981', '#06b6d4', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6'];

const PIPELINE_STAGES = ['Draft', 'Approved', 'Sent', 'Partially Received', 'Received', 'Cancelled'] as const;
const PIPELINE_COLORS: Record<string, string> = {
  Draft: '#64748b',
  Approved: '#10b981',
  Sent: '#6366f1',
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
  { name: 'Status', label: 'Status', type: 'select' as const, options: ['Draft', 'Approved', 'Sent', 'Partially Received', 'Received', 'Cancelled'] },
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

export function PurchaseOrdersClient({ orders: initialOrders, suppliers, poLines }: Props) {
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

  // ── Spend Analytics KPIs ───────────────────────
  const kpis = useMemo(() => {
    let totalSpend = 0;
    let lateCount = 0;
    let totalWithDate = 0;
    const supplierCounts: Record<string, number> = {};
    const now = new Date();

    for (const o of orders) {
      totalSpend += Number(o['Total Amount'] ?? 0);

      // On-time delivery calculation
      const expectedDate = o['Expected Date'];
      if (expectedDate) {
        totalWithDate++;
        const expected = new Date(expectedDate);
        if (expected < now && resolveStatus(o) !== 'Received' && resolveStatus(o) !== 'Cancelled') {
          lateCount++;
        }
      }

      // Supplier counting for top supplier
      const ref = o['Supplier'];
      const sid = Array.isArray(ref) ? ref[0] : ref;
      if (sid) {
        supplierCounts[sid] = (supplierCounts[sid] || 0) + 1;
      }
    }

    const avgOrderValue = orders.length > 0 ? totalSpend / orders.length : 0;
    const onTimeRate = totalWithDate > 0 ? Math.round(((totalWithDate - lateCount) / totalWithDate) * 100) : 100;

    // Top supplier
    let topSupplierId = '';
    let topSupplierCount = 0;
    for (const [sid, count] of Object.entries(supplierCounts)) {
      if (count > topSupplierCount) {
        topSupplierCount = count;
        topSupplierId = sid;
      }
    }
    const topSupplierName = topSupplierId ? (supplierMap[topSupplierId] || 'Unknown') : 'N/A';

    return { totalSpend, avgOrderValue, onTimeRate, topSupplierName, topSupplierCount, lateCount, totalWithDate };
  }, [orders, supplierMap]);

  // ── Supplier Concentration Risk ────────────────
  const supplierConcentration = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of orders) {
      const ref = o['Supplier'];
      const sid = Array.isArray(ref) ? ref[0] : ref;
      if (sid) {
        counts[sid] = (counts[sid] || 0) + 1;
      }
    }
    if (orders.length === 0) return null;

    let maxSid = '';
    let maxCount = 0;
    for (const [sid, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        maxSid = sid;
      }
    }
    const pct = Math.round((maxCount / orders.length) * 100);
    if (pct > 40) {
      return { supplierName: supplierMap[maxSid] || 'Unknown', percentage: pct, isRisk: true };
    }
    return { supplierName: supplierMap[maxSid] || 'Unknown', percentage: pct, isRisk: false };
  }, [orders, supplierMap]);

  // ── Budget Burn Rate ───────────────────────────
  const budgetBurn = useMemo(() => {
    const totalSpend = orders.reduce((s, o) => s + Number(o['Total Amount'] ?? 0), 0);
    const budget = totalSpend * 1.2; // synthetic budget at 120% of spend
    const pct = budget > 0 ? Math.round((totalSpend / budget) * 100) : 0;
    return { spent: totalSpend, budget, pct };
  }, [orders]);

  // ── Chart: Spend by Supplier (horizontal bar) ──
  const supplierSpend = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const o of orders) {
      const name = resolveSupplier(o) || 'Unknown';
      totals[name] = (totals[name] || 0) + Number(o['Total Amount'] ?? 0);
    }
    const sorted = Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    if (sorted.length <= 8) return sorted;
    const top8 = sorted.slice(0, 8);
    const otherTotal = sorted.slice(8).reduce((sum, s) => sum + s.value, 0);
    if (otherTotal > 0) top8.push({ name: 'Other', value: otherTotal });
    return top8;
  }, [orders, resolveSupplier]);

  // ── Pipeline data ──────────────────────────────
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
    return PIPELINE_STAGES.map((stage) => ({
      stage,
      ...counts[stage],
    }));
  }, [orders]);

  // ── Filtered + grouped ────────────────────────
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

  // ── CRUD handlers ──────────────────────────────
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

  // ── Unique statuses/priorities for filters ────
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

      {/* ── Spend Analytics KPIs ──────────────────── */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total PO Value</div>
          <div className="kpi-value" style={{ color: '#10b981' }}>{formatCurrency(kpis.totalSpend)}</div>
          <div className="kpi-trend neutral">{orders.length} purchase orders</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Average Order Value</div>
          <div className="kpi-value" style={{ color: '#6366f1' }}>{formatCurrency(kpis.avgOrderValue)}</div>
          <div className="kpi-trend neutral">per purchase order</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">On-Time Delivery Rate</div>
          <div className="kpi-value" style={{ color: kpis.onTimeRate >= 80 ? '#10b981' : kpis.onTimeRate >= 60 ? '#f59e0b' : '#ef4444' }}>
            {kpis.onTimeRate}%
          </div>
          <div className="kpi-trend neutral">
            {kpis.lateCount > 0 ? `${kpis.lateCount} late of ${kpis.totalWithDate} tracked` : 'All on time'}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Top Supplier</div>
          <div className="kpi-value" style={{ color: '#06b6d4', fontSize: 18 }}>{kpis.topSupplierName}</div>
          <div className="kpi-trend neutral">{kpis.topSupplierCount} orders</div>
        </div>
      </div>

      {/* ── Supplier Concentration Risk + Budget Burn ── */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Supplier Concentration */}
        <div className="glass-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Supplier Concentration</div>
            {supplierConcentration?.isRisk && (
              <span style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                padding: '3px 10px', borderRadius: 100,
                background: 'rgba(239,68,68,0.15)', color: '#ef4444',
              }}>
                RISK
              </span>
            )}
          </div>
          {supplierConcentration && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                <span>{supplierConcentration.supplierName}</span>
                <span style={{ fontWeight: 700, color: supplierConcentration.isRisk ? '#ef4444' : '#10b981' }}>
                  {supplierConcentration.percentage}%
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className={`progress-bar-fill ${supplierConcentration.isRisk ? 'red' : 'green'}`}
                  style={{ width: `${Math.min(supplierConcentration.percentage, 100)}%` }}
                />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
                {supplierConcentration.isRisk
                  ? 'Warning: Single supplier holds >40% of POs. Consider diversifying.'
                  : 'Supplier diversification is healthy.'}
              </div>
            </div>
          )}
        </div>

        {/* Budget Burn Rate */}
        <div className="glass-card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Budget Burn Rate</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
            <span>{formatCurrency(budgetBurn.spent)} spent</span>
            <span>{formatCurrency(budgetBurn.budget)} budget</span>
          </div>
          <div className="progress-bar" style={{ height: 10 }}>
            <div
              className={`progress-bar-fill ${budgetBurn.pct >= 90 ? 'red' : budgetBurn.pct >= 70 ? 'yellow' : 'green'}`}
              style={{ width: `${Math.min(budgetBurn.pct, 100)}%` }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
            <span>{budgetBurn.pct}% consumed</span>
            <span>{formatCurrency(budgetBurn.budget - budgetBurn.spent)} remaining</span>
          </div>
        </div>
      </div>

      {/* ── Charts ─────────────────────────────────── */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Spend by Supplier (horizontal bar) */}
        <div className="chart-card">
          <h3>Spend by Supplier</h3>
          {supplierSpend.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No supplier data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={supplierSpend} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 10 }}>
                <XAxis
                  type="number"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : String(v))}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={100}
                />
                <Tooltip
                  {...CHART_TOOLTIP}
                  cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                  formatter={(value: any) => [formatCurrency(value), 'Spend']}
                />
                <Bar dataKey="value" name="Spend" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  {supplierSpend.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* PO Status Pipeline (vertical bar with pipeline stages) */}
        <div className="chart-card">
          <h3>PO Status Pipeline</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
            {pipelineData.map((p, idx) => {
              const maxCount = Math.max(...pipelineData.map(d => d.count), 1);
              const widthPct = maxCount > 0 ? Math.max((p.count / maxCount) * 100, p.count > 0 ? 8 : 0) : 0;
              return (
                <div
                  key={p.stage}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setStatusFilter(statusFilter === p.stage ? 'All' : p.stage)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: PIPELINE_COLORS[p.stage] || '#64748b',
                      }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{p.stage}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{p.count}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatCurrency(p.amount)}</span>
                    </div>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${widthPct}%`,
                      borderRadius: 3,
                      background: PIPELINE_COLORS[p.stage] || '#64748b',
                      transition: 'width 300ms ease',
                    }} />
                  </div>
                  {idx < pipelineData.length - 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 0' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2.5">
                        <path d="M12 5v14M19 12l-7 7-7-7" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────── */}
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

      {/* ── PO Cards by Status ─────────────────────── */}
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
                      width: 10, height: 10, borderRadius: '50%',
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
                            <span style={{
                              fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                              padding: '2px 8px', borderRadius: 100,
                              background: (PRIORITY_COLORS[priority] || '#64748b') + '20',
                              color: PRIORITY_COLORS[priority] || '#64748b',
                            }}>
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

      {/* ── Create Modal ───────────────────────────── */}
      <Modal open={modalMode === 'create'} onClose={() => setModalMode(null)} title="New Purchase Order">
        <RecordForm fields={formFields} onSubmit={handleCreate} onCancel={() => setModalMode(null)} submitLabel="Create" />
      </Modal>

      {/* ── Edit Modal ─────────────────────────────── */}
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

      {/* ── View Modal ─────────────────────────────── */}
      <Modal open={modalMode === 'view'} onClose={() => { setModalMode(null); setSelected(null); }} title="Purchase Order Detail">
        {selected && (() => {
          const supplier = resolveSupplier(selected);
          const status = resolveStatus(selected);
          const priority = resolvePriority(selected);
          // Find PO Lines for this order
          const orderLines = poLines.filter(line => {
            const ref = line['Purchase Order'];
            const linePoId = Array.isArray(ref) ? ref[0] : ref;
            return linePoId === selected.id;
          });
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
              {orderLines.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div className="detail-field-label" style={{ marginBottom: 8 }}>PO Lines ({orderLines.length})</div>
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Qty</th>
                          <th>Unit Price</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderLines.map((line) => (
                          <tr key={line.id}>
                            <td>{line['Item Name'] || line['Item'] || '--'}</td>
                            <td>{line['Quantity'] ?? '--'}</td>
                            <td>{formatCurrency(line['Unit Price'])}</td>
                            <td style={{ fontWeight: 600, color: '#10b981' }}>{formatCurrency(line['Line Total'] || line['Total'])}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div className="form-actions">
                <button className="btn btn-secondary" onClick={() => { setModalMode(null); setSelected(null); }}>Close</button>
                <button className="btn btn-primary" onClick={() => { setModalMode('edit'); }}>Edit</button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ── Delete Confirmation ────────────────────── */}
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
