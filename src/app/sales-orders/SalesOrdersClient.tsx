'use client';

import { useState, useMemo, useCallback } from 'react';
import { createRecord, updateRecord, deleteRecord } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { Modal } from '@/components/Modal';
import { RecordForm } from '@/components/RecordForm';
import { StatusBadge } from '@/components/StatusBadge';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

interface Props {
  orders: Record<string, any>[];
  customers: Record<string, any>[];
  soLines: Record<string, any>[];
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

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function SalesOrdersClient({ orders: initialOrders, customers, soLines }: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<any>(null);
  const [detailRecord, setDetailRecord] = useState<any>(null);

  // ── Customer lookup ─────────────────────────
  const customerMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of customers) {
      if (c.id) {
        map[c.id] = c['Customer Name'] || c['Name'] || c['Company Name'] || `Customer ${c.id.slice(-4)}`;
      }
    }
    return map;
  }, [customers]);

  const resolveCustomer = useCallback((order: any): string => {
    const ref = order['Customer'];
    const id = Array.isArray(ref) ? ref[0] : ref;
    if (id && customerMap[id]) return customerMap[id];
    return 'Unknown';
  }, [customerMap]);

  // ── Revenue Pipeline KPIs ──────────────────
  const kpis = useMemo(() => {
    const totalRevenue = orders.reduce((sum, o) => sum + resolveAmount(o['Total Amount']), 0);
    const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

    // Fulfillment Rate (shipped SO lines / total SO lines)
    const totalLines = soLines.length;
    const shippedLines = soLines.filter(line => {
      const status = resolveStatus(line['Status'] || line['Line Status']);
      return status === 'Shipped' || status === 'Delivered' || status === 'Fulfilled';
    }).length;
    const fulfillmentRate = totalLines > 0 ? Math.round((shippedLines / totalLines) * 100) : 0;

    // Top Customer
    const customerCounts: Record<string, { count: number; revenue: number }> = {};
    for (const o of orders) {
      const ref = o['Customer'];
      const cid = Array.isArray(ref) ? ref[0] : ref;
      if (cid) {
        if (!customerCounts[cid]) customerCounts[cid] = { count: 0, revenue: 0 };
        customerCounts[cid].count++;
        customerCounts[cid].revenue += resolveAmount(o['Total Amount']);
      }
    }
    let topCustomerId = '';
    let topCustomerCount = 0;
    for (const [cid, data] of Object.entries(customerCounts)) {
      if (data.count > topCustomerCount) {
        topCustomerCount = data.count;
        topCustomerId = cid;
      }
    }
    const topCustomerName = topCustomerId ? (customerMap[topCustomerId] || 'Unknown') : 'N/A';

    return { totalRevenue, avgOrderValue, fulfillmentRate, shippedLines, totalLines, topCustomerName, topCustomerCount };
  }, [orders, soLines, customerMap]);

  // ── Customer Concentration ─────────────────
  const customerConcentration = useMemo(() => {
    const revenueByCustomer: Record<string, number> = {};
    let totalRevenue = 0;
    for (const o of orders) {
      const ref = o['Customer'];
      const cid = Array.isArray(ref) ? ref[0] : ref;
      const amt = resolveAmount(o['Total Amount']);
      totalRevenue += amt;
      if (cid) {
        revenueByCustomer[cid] = (revenueByCustomer[cid] || 0) + amt;
      }
    }
    if (totalRevenue === 0) return null;

    let maxCid = '';
    let maxRevenue = 0;
    for (const [cid, rev] of Object.entries(revenueByCustomer)) {
      if (rev > maxRevenue) {
        maxRevenue = rev;
        maxCid = cid;
      }
    }
    const pct = Math.round((maxRevenue / totalRevenue) * 100);
    return {
      customerName: customerMap[maxCid] || 'Unknown',
      percentage: pct,
      revenue: maxRevenue,
      isRisk: pct > 50,
    };
  }, [orders, customerMap]);

  // ── Revenue Forecast ───────────────────────
  const revenueForecast = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    let currentMonthRevenue = 0;
    let currentMonthOrders = 0;

    for (const o of orders) {
      const dateStr = o['Order Date'];
      if (!dateStr) continue;
      const d = new Date(dateStr);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        currentMonthRevenue += resolveAmount(o['Total Amount']);
        currentMonthOrders++;
      }
    }

    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const projectedMonthly = dayOfMonth > 0 ? Math.round((currentMonthRevenue / dayOfMonth) * daysInMonth) : 0;
    const projectedAnnual = projectedMonthly * 12;

    return { currentMonthRevenue, currentMonthOrders, projectedMonthly, projectedAnnual, dayOfMonth, daysInMonth };
  }, [orders]);

  // ── Chart: Revenue by Customer (top 6) ─────
  const revenueByCustomer = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (const o of orders) {
      const name = resolveCustomer(o);
      buckets[name] = (buckets[name] || 0) + resolveAmount(o['Total Amount']);
    }
    const sorted = Object.entries(buckets)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    if (sorted.length <= 6) return sorted;
    const top6 = sorted.slice(0, 6);
    const otherRevenue = sorted.slice(6).reduce((sum, c) => sum + c.revenue, 0);
    if (otherRevenue > 0) top6.push({ name: 'Other', revenue: otherRevenue });
    return top6;
  }, [orders, resolveCustomer]);

  // ── Pipeline data ──────────────────────────
  const pipelineData = useMemo(() => {
    return PIPELINE_STAGES.map(stage => {
      const stageOrders = orders.filter(o => resolveStatus(o['Status']) === stage);
      const count = stageOrders.length;
      const revenue = stageOrders.reduce((sum, o) => sum + resolveAmount(o['Total Amount']), 0);
      return { stage, count, revenue };
    });
  }, [orders]);

  // ── Filtered orders ────────────────────────
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
    return [...result].sort((a, b) => {
      const da = a['Order Date'] ? new Date(a['Order Date']).getTime() : 0;
      const db = b['Order Date'] ? new Date(b['Order Date']).getTime() : 0;
      return db - da;
    });
  }, [orders, statusFilter, priorityFilter, search, resolveCustomer]);

  // ── CRUD handlers ──────────────────────────
  const handleCreate = async (values: Record<string, any>) => {
    await createRecord(TABLES.SALES_ORDERS, values);
    setCreateOpen(false);
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

  return (
    <div>
      {/* ── Header ───────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales Orders</h1>
          <p className="page-subtitle">Revenue dashboard and order pipeline</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Order
          </button>
        </div>
      </div>

      {/* ── Revenue Pipeline KPIs ─────────────────── */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Revenue</div>
          <div className="kpi-value" style={{ color: '#10b981' }}>{fmtCurrency(kpis.totalRevenue)}</div>
          <div className="kpi-trend neutral">{orders.length} sales orders</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Average Order Value</div>
          <div className="kpi-value" style={{ color: '#6366f1' }}>{fmtCurrency(kpis.avgOrderValue)}</div>
          <div className="kpi-trend neutral">per order</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Fulfillment Rate</div>
          <div className="kpi-value" style={{ color: kpis.fulfillmentRate >= 80 ? '#10b981' : kpis.fulfillmentRate >= 50 ? '#f59e0b' : '#ef4444' }}>
            {kpis.fulfillmentRate}%
          </div>
          <div className="kpi-trend neutral">{kpis.shippedLines} of {kpis.totalLines} lines shipped</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Top Customer</div>
          <div className="kpi-value" style={{ color: '#06b6d4', fontSize: 18 }}>{kpis.topCustomerName}</div>
          <div className="kpi-trend neutral">{kpis.topCustomerCount} orders</div>
        </div>
      </div>

      {/* ── Customer Concentration + Revenue Forecast ── */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Customer Concentration */}
        <div className="glass-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Customer Concentration</div>
            {customerConcentration?.isRisk && (
              <span style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                padding: '3px 10px', borderRadius: 100,
                background: 'rgba(239,68,68,0.15)', color: '#ef4444',
              }}>
                HIGH RISK
              </span>
            )}
          </div>
          {customerConcentration ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                <span>{customerConcentration.customerName}</span>
                <span style={{ fontWeight: 700, color: customerConcentration.isRisk ? '#ef4444' : '#10b981' }}>
                  {customerConcentration.percentage}% of revenue
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className={`progress-bar-fill ${customerConcentration.isRisk ? 'red' : 'green'}`}
                  style={{ width: `${Math.min(customerConcentration.percentage, 100)}%` }}
                />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
                {customerConcentration.isRisk
                  ? 'Warning: Top customer holds >50% of revenue. Revenue at risk.'
                  : 'Customer revenue distribution is healthy.'}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>No revenue data available</div>
          )}
        </div>

        {/* Revenue Forecast */}
        <div className="glass-card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Revenue Forecast</div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 2 }}>This Month (Actual)</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>
                {fmtCurrency(revenueForecast.currentMonthRevenue)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {revenueForecast.currentMonthOrders} orders in {revenueForecast.dayOfMonth} days
              </div>
            </div>
            <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 2 }}>Projected Monthly</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#6366f1' }}>
                {fmtCurrency(revenueForecast.projectedMonthly)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {fmtCurrency(revenueForecast.projectedAnnual)} annual run rate
              </div>
            </div>
          </div>
          <div className="progress-bar" style={{ height: 6 }}>
            <div
              className="progress-bar-fill green"
              style={{ width: `${Math.min((revenueForecast.dayOfMonth / revenueForecast.daysInMonth) * 100, 100)}%` }}
            />
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
            Day {revenueForecast.dayOfMonth} of {revenueForecast.daysInMonth} in current month
          </div>
        </div>
      </div>

      {/* ── Charts ─────────────────────────────────── */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Revenue by Customer (bar chart) */}
        <div className="chart-card">
          <h3>Revenue by Customer</h3>
          {revenueByCustomer.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No customer data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueByCustomer} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <XAxis
                  dataKey="name"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                  tickFormatter={(v: number) => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : String(v))}
                />
                <Tooltip
                  {...CHART_TOOLTIP}
                  cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                  formatter={(value: any) => [fmtCurrency(Number(value)), 'Revenue']}
                />
                <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {revenueByCustomer.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* SO Status Pipeline */}
        <div className="chart-card">
          <h3>SO Status Pipeline</h3>
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
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtCurrency(p.revenue)}</span>
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

      {/* ── Toolbar: filters + search ──────────────── */}
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
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

      {/* ── Order Timeline Cards ──────────────────── */}
      {filteredOrders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity={0.3}>
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
            </svg>
          </div>
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
                <div style={{ minWidth: 100 }}>
                  <span className="mono-text" style={{ fontSize: 13, fontWeight: 600 }}>
                    {order['SO Number'] || '\u2014'}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                    {customerName}
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                    <span>Ordered: {fmtDate(order['Order Date'])}</span>
                    <span>Required: {fmtDate(order['Required Date'])}</span>
                  </div>
                </div>
                <div style={{ minWidth: 100, textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: amount > 0 ? '#10b981' : 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {amount > 0 ? fmtCurrency(amount) : '\u2014'}
                  </div>
                </div>
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

      {/* ── Create Modal ───────────────────────────── */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Sales Order">
        <RecordForm fields={formFields} onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} submitLabel="Create" />
      </Modal>

      {/* ── Edit Modal ─────────────────────────────── */}
      <Modal open={!!editRecord} onClose={() => setEditRecord(null)} title="Edit Sales Order">
        {editRecord && (
          <RecordForm fields={formFields} initialValues={editRecord} onSubmit={handleUpdate} onCancel={() => setEditRecord(null)} submitLabel="Update" />
        )}
      </Modal>

      {/* ── Detail Modal ───────────────────────────── */}
      <Modal open={!!detailRecord && !editRecord} onClose={() => setDetailRecord(null)} title="Sales Order Details">
        {detailRecord && (
          <div>
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

            {/* SO Lines in detail view */}
            {(() => {
              const orderLines = soLines.filter(line => {
                const ref = line['Sales Order'];
                const lineSOId = Array.isArray(ref) ? ref[0] : ref;
                return lineSOId === detailRecord.id;
              });
              if (orderLines.length === 0) return null;
              return (
                <div style={{ marginBottom: 16 }}>
                  <div className="detail-field-label" style={{ marginBottom: 8 }}>SO Lines ({orderLines.length})</div>
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
                            <td>{fmtCurrency(resolveAmount(line['Unit Price']))}</td>
                            <td style={{ fontWeight: 600, color: '#10b981' }}>{fmtCurrency(resolveAmount(line['Line Total'] || line['Total']))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            <div className="form-actions" style={{ marginTop: 0, paddingTop: 16 }}>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(detailRecord.id)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Delete
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setEditRecord(detailRecord)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
