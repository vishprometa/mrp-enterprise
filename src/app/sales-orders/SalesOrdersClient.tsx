'use client';

import { useState, useMemo, useCallback } from 'react';
import { createRecord, updateRecord, deleteRecord } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { Modal } from '@/components/Modal';
import { RecordForm } from '@/components/RecordForm';
import { StatusBadge } from '@/components/StatusBadge';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts';

// ── Constants ────────────────────────────────────

const CHART_TOOLTIP = {
  contentStyle: { background: '#1a2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 },
  labelStyle: { color: '#94a3b8' },
  itemStyle: { color: '#f1f5f9' },
};
const AXIS_TICK = { fill: '#64748b', fontSize: 11 };
const GRID_STROKE = 'rgba(255,255,255,0.04)';
const COLORS = ['#6366f1', '#f97316', '#10b981', '#06b6d4', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6'];

const PIPELINE_STAGES = ['Draft', 'Confirmed', 'In Production', 'Shipped', 'Delivered', 'Cancelled'] as const;
const PIPELINE_COLORS: Record<string, string> = {
  Draft: '#64748b',
  Confirmed: '#3b82f6',
  'In Production': '#6366f1',
  Shipped: '#f59e0b',
  Delivered: '#10b981',
  Cancelled: '#ef4444',
};

const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Urgent'] as const;
const STATUS_OPTIONS = ['Draft', 'Confirmed', 'In Production', 'Shipped', 'Delivered', 'Cancelled'] as const;

const formFields = [
  { name: 'SO Number', label: 'SO Number', type: 'text' as const, required: true },
  { name: 'Order Date', label: 'Order Date', type: 'date' as const, required: true },
  { name: 'Required Date', label: 'Required Date', type: 'date' as const },
  { name: 'Status', label: 'Status', type: 'select' as const, options: [...STATUS_OPTIONS] },
  { name: 'Total Amount', label: 'Total Amount', type: 'number' as const },
  { name: 'Priority', label: 'Priority', type: 'select' as const, options: [...PRIORITY_OPTIONS] },
  { name: 'Shipping Method', label: 'Shipping Method', type: 'select' as const, options: ['Ground', 'Express', 'Air', 'Sea'] },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
];

// ── Types ────────────────────────────────────────

interface Props {
  orders: Record<string, any>[];
  customers: Record<string, any>[];
}

// ── Helpers ──────────────────────────────────────

function resolveStatus(val: any): string {
  if (Array.isArray(val)) return val[0] ?? 'Unknown';
  return String(val ?? 'Unknown');
}

function resolveAmount(val: any): number {
  if (val == null || val === '') return 0;
  return Number(val) || 0;
}

function fmtCurrency(val: number): string {
  return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(val: any): string {
  if (!val) return '\u2014';
  try {
    return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '\u2014';
  }
}

function fmtMonth(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

// ── Custom Tooltip ───────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1a2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
      {label && <p style={{ color: '#94a3b8', margin: '0 0 4px', fontSize: 12 }}>{label}</p>}
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: '#f1f5f9', margin: '2px 0', fontSize: 12 }}>
          <span style={{ color: entry.color || entry.fill, marginRight: 6 }}>{'\u25CF'}</span>
          {entry.name}: <strong>{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</strong>
        </p>
      ))}
    </div>
  );
}

// ── Component ────────────────────────────────────

export function SalesOrdersClient({ orders: initialOrders, customers }: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<any>(null);
  const [detailRecord, setDetailRecord] = useState<any>(null);

  // Customer lookup map
  const customerMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of customers) {
      if (c.id) {
        map[c.id] = c['Customer Name'] || c['Name'] || c['Company Name'] || `Customer ${c.id.slice(-4)}`;
      }
    }
    return map;
  }, [customers]);

  // Resolve customer name from reference
  const resolveCustomer = useCallback((order: any): string => {
    const ref = order['Customer'];
    const id = Array.isArray(ref) ? ref[0] : ref;
    if (id && customerMap[id]) return customerMap[id];
    return 'Unknown';
  }, [customerMap]);

  // ── KPI Calculations ──────────────────────────

  const kpis = useMemo(() => {
    const totalSOs = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + resolveAmount(o['Total Amount']), 0);
    const pendingOrders = orders.filter(o => {
      const s = resolveStatus(o['Status']);
      return s === 'Draft' || s === 'Confirmed';
    }).length;
    const avgOrderValue = totalSOs > 0 ? totalRevenue / totalSOs : 0;
    return { totalSOs, totalRevenue, pendingOrders, avgOrderValue };
  }, [orders]);

  // ── Pipeline data ─────────────────────────────

  const pipelineData = useMemo(() => {
    return PIPELINE_STAGES.map(stage => {
      const stageOrders = orders.filter(o => resolveStatus(o['Status']) === stage);
      const count = stageOrders.length;
      const revenue = stageOrders.reduce((sum, o) => sum + resolveAmount(o['Total Amount']), 0);
      return { stage, count, revenue };
    });
  }, [orders]);

  // ── Monthly revenue trend ─────────────────────

  const monthlyRevenue = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (const o of orders) {
      const raw = o['Order Date'];
      if (!raw) continue;
      const month = fmtMonth(String(raw));
      if (!month) continue;
      buckets[month] = (buckets[month] || 0) + resolveAmount(o['Total Amount']);
    }
    return Object.entries(buckets)
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
  }, [orders]);

  // ── Revenue by customer (top 5 + Other) ───────

  const revenueByCustomer = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (const o of orders) {
      const name = resolveCustomer(o);
      buckets[name] = (buckets[name] || 0) + resolveAmount(o['Total Amount']);
    }
    const sorted = Object.entries(buckets)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    if (sorted.length <= 5) return sorted;
    const top5 = sorted.slice(0, 5);
    const otherRevenue = sorted.slice(5).reduce((sum, c) => sum + c.revenue, 0);
    if (otherRevenue > 0) top5.push({ name: 'Other', revenue: otherRevenue });
    return top5;
  }, [orders, resolveCustomer]);

  // ── Filtered orders ───────────────────────────

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (statusFilter !== 'All') {
      result = result.filter(o => resolveStatus(o['Status']) === statusFilter);
    }
    if (priorityFilter !== 'All') {
      result = result.filter(o => resolveStatus(o['Priority']) === priorityFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(o => {
        const so = String(o['SO Number'] ?? '').toLowerCase();
        const cust = resolveCustomer(o).toLowerCase();
        return so.includes(q) || cust.includes(q);
      });
    }
    // Sort by Order Date desc
    return [...result].sort((a, b) => {
      const da = a['Order Date'] ? new Date(a['Order Date']).getTime() : 0;
      const db = b['Order Date'] ? new Date(b['Order Date']).getTime() : 0;
      return db - da;
    });
  }, [orders, statusFilter, priorityFilter, search, resolveCustomer]);

  // ── CRUD handlers ─────────────────────────────

  const handleCreate = async (values: Record<string, any>) => {
    await createRecord(TABLES.SALES_ORDERS, values);
    setCreateOpen(false);
    // Optimistic: add to local state
    setOrders(prev => [{ ...values, id: 'temp-' + Date.now() }, ...prev]);
  };

  const handleUpdate = async (values: Record<string, any>) => {
    if (!editRecord) return;
    await updateRecord(TABLES.SALES_ORDERS, editRecord.id, values);
    setEditRecord(null);
    setOrders(prev => prev.map(o => o.id === editRecord.id ? { ...o, ...values } : o));
  };

  const handleDelete = async (id: string) => {
    await deleteRecord(TABLES.SALES_ORDERS, id);
    setDetailRecord(null);
    setOrders(prev => prev.filter(o => o.id !== id));
  };

  // ── Render ────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales Orders</h1>
          <p className="page-subtitle">Revenue dashboard and order pipeline</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            New Order
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Sales Orders</div>
          <div className="kpi-value" style={{ marginTop: 6 }}>{kpis.totalSOs.toLocaleString()}</div>
          <div className="kpi-trend neutral">{filteredOrders.length} shown</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Revenue</div>
          <div className="kpi-value" style={{ marginTop: 6, color: '#10b981' }}>{fmtCurrency(kpis.totalRevenue)}</div>
          <div className="kpi-trend neutral">across all orders</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Pending Orders</div>
          <div className="kpi-value" style={{ marginTop: 6, color: '#f59e0b' }}>{kpis.pendingOrders}</div>
          <div className="kpi-trend neutral">Draft + Confirmed</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Average Order Value</div>
          <div className="kpi-value" style={{ marginTop: 6, color: '#6366f1' }}>{fmtCurrency(kpis.avgOrderValue)}</div>
          <div className="kpi-trend neutral">per order</div>
        </div>
      </div>

      {/* Pipeline */}
      <div className="pipeline">
        {pipelineData.map(({ stage, count, revenue }) => (
          <div
            key={stage}
            className={`pipeline-stage ${statusFilter === stage ? 'active' : ''}`}
            onClick={() => setStatusFilter(statusFilter === stage ? 'All' : stage)}
            style={{ cursor: 'pointer', borderTopColor: PIPELINE_COLORS[stage], borderTopWidth: 3, borderTopStyle: 'solid' }}
          >
            <div className="pipeline-count">{count}</div>
            <div className="pipeline-label">{stage}</div>
            <div className="pipeline-value">{fmtCurrency(revenue)}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Monthly Revenue Trend */}
        <div className="chart-card">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px' }}>Monthly Revenue Trend</h3>
          <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 16px' }}>Revenue aggregated by order date month</p>
          {monthlyRevenue.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No order data to chart</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={monthlyRevenue} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v: number) => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fill="url(#revenueGrad)"
                  dot={{ fill: '#6366f1', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#818cf8' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Revenue by Customer */}
        <div className="chart-card">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px' }}>Revenue by Customer</h3>
          <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 16px' }}>Top 5 customers by total amount</p>
          {revenueByCustomer.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No customer data</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={revenueByCustomer}
                  dataKey="revenue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  stroke="none"
                >
                  {revenueByCustomer.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
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

      {/* Toolbar: filters + search */}
      <div className="toolbar">
        <div className="toolbar-actions">
          <div className="filter-bar" style={{ marginBottom: 0 }}>
            {['All', ...STATUS_OPTIONS].map(s => (
              <button
                key={s}
                className={`filter-pill ${statusFilter === s ? 'active' : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="toolbar-actions">
          <select
            className="input"
            style={{ width: 140 }}
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
          >
            <option value="All">All Priorities</option>
            {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <div className="search-bar">
            <span className="search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            </span>
            <input
              className="input"
              placeholder="Search SO# or customer..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 220 }}
            />
          </div>
        </div>
      </div>

      {/* Order Timeline Cards */}
      {filteredOrders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">&#128230;</div>
          No sales orders found
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredOrders.map(order => {
            const status = resolveStatus(order['Status']);
            const priority = resolveStatus(order['Priority']);
            const amount = resolveAmount(order['Total Amount']);
            const shipping = resolveStatus(order['Shipping Method']);
            const customerName = resolveCustomer(order);

            return (
              <div
                key={order.id}
                className="glass-card"
                style={{
                  padding: '16px 20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  borderLeft: `3px solid ${PIPELINE_COLORS[status] || '#64748b'}`,
                  transition: 'all 200ms ease',
                }}
                onClick={() => setDetailRecord(order)}
              >
                {/* SO Number */}
                <div style={{ minWidth: 100 }}>
                  <span className="mono-text" style={{ fontSize: 13, fontWeight: 600 }}>
                    {order['SO Number'] || '\u2014'}
                  </span>
                </div>

                {/* Customer + Date */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                    {customerName}
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                    <span>Ordered: {fmtDate(order['Order Date'])}</span>
                    <span>Required: {fmtDate(order['Required Date'])}</span>
                  </div>
                </div>

                {/* Amount */}
                <div style={{ minWidth: 100, textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: amount > 0 ? '#10b981' : 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {amount > 0 ? fmtCurrency(amount) : '\u2014'}
                  </div>
                </div>

                {/* Badges */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 200, justifyContent: 'flex-end' }}>
                  <StatusBadge value={priority} />
                  <StatusBadge value={status} />
                  {shipping && shipping !== 'Unknown' && (
                    <span className="tag">{shipping}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Sales Order">
        <RecordForm fields={formFields} onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} submitLabel="Create" />
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editRecord} onClose={() => setEditRecord(null)} title="Edit Sales Order">
        {editRecord && (
          <RecordForm fields={formFields} initialValues={editRecord} onSubmit={handleUpdate} onCancel={() => setEditRecord(null)} submitLabel="Update" />
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detailRecord && !editRecord} onClose={() => setDetailRecord(null)} title="Sales Order Details">
        {detailRecord && (
          <div>
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <span className="mono-text" style={{ fontSize: 15, fontWeight: 700 }}>{detailRecord['SO Number']}</span>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{resolveCustomer(detailRecord)}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <StatusBadge value={resolveStatus(detailRecord['Priority'])} />
                <StatusBadge value={resolveStatus(detailRecord['Status'])} />
              </div>
            </div>

            {/* Detail grid */}
            <div className="detail-grid" style={{ marginBottom: 20 }}>
              <div>
                <div className="detail-field-label">Order Date</div>
                <div className="detail-field-value">{fmtDate(detailRecord['Order Date'])}</div>
              </div>
              <div>
                <div className="detail-field-label">Required Date</div>
                <div className="detail-field-value">{fmtDate(detailRecord['Required Date'])}</div>
              </div>
              <div>
                <div className="detail-field-label">Total Amount</div>
                <div className="detail-field-value" style={{ color: '#10b981', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                  {fmtCurrency(resolveAmount(detailRecord['Total Amount']))}
                </div>
              </div>
              <div>
                <div className="detail-field-label">Shipping Method</div>
                <div className="detail-field-value">{resolveStatus(detailRecord['Shipping Method']) || '\u2014'}</div>
              </div>
              {detailRecord['Notes'] && (
                <div style={{ gridColumn: 'span 2' }}>
                  <div className="detail-field-label">Notes</div>
                  <div className="detail-field-value" style={{ whiteSpace: 'pre-wrap' }}>{detailRecord['Notes']}</div>
                </div>
              )}
            </div>

            <div className="form-actions" style={{ marginTop: 0, paddingTop: 16 }}>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(detailRecord.id)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                Delete
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setEditRecord(detailRecord)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                Edit
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
