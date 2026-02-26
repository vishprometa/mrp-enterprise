'use client';

import { useState, useMemo, useCallback } from 'react';
import { createRecord, updateRecord, deleteRecord } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { Modal } from '@/components/Modal';
import { RecordForm } from '@/components/RecordForm';
import { StatusBadge } from '@/components/StatusBadge';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from 'recharts';

/* ================================================================
   Constants & Types
   ================================================================ */

const COLORS = ['#6366f1', '#f97316', '#10b981', '#06b6d4', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6'];

const STATUS_COLORS: Record<string, string> = {
  VIP: '#f59e0b',
  Active: '#10b981',
  Inactive: '#64748b',
  Suspended: '#ef4444',
};

const CHART_TOOLTIP = {
  contentStyle: { background: '#1a2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 },
  labelStyle: { color: '#94a3b8' },
  itemStyle: { color: '#f1f5f9' },
};

const PAGE_SIZE = 25;

const STATUS_TABS = ['All', 'Active', 'VIP', 'Inactive', 'Suspended'] as const;

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: any) => React.ReactNode;
}

const columns: Column[] = [
  { key: 'Code', label: 'Code', sortable: true },
  { key: 'Contact Person', label: 'Contact Person', sortable: true },
  { key: 'Email', label: 'Email', sortable: true },
  { key: 'Phone', label: 'Phone' },
  { key: 'Country', label: 'Country', sortable: true },
  { key: 'Payment Terms', label: 'Payment Terms' },
  { key: 'Credit Limit', label: 'Credit Limit', sortable: true, render: (v: any) => v != null ? `$${Number(v).toLocaleString()}` : '\u2014' },
  { key: 'Status', label: 'Status', sortable: true, render: (v: any) => <StatusBadge value={v} /> },
];

const formFields = [
  { name: 'Code', label: 'Code', type: 'text' as const, required: true },
  { name: 'Contact Person', label: 'Contact Person', type: 'text' as const, required: true },
  { name: 'Email', label: 'Email', type: 'text' as const },
  { name: 'Phone', label: 'Phone', type: 'text' as const },
  { name: 'Address', label: 'Address', type: 'textarea' as const },
  { name: 'City', label: 'City', type: 'text' as const },
  { name: 'Country', label: 'Country', type: 'text' as const },
  { name: 'Payment Terms', label: 'Payment Terms', type: 'select' as const, options: ['Net 30', 'Net 45', 'Net 60', 'Immediate'] },
  { name: 'Credit Limit', label: 'Credit Limit', type: 'number' as const },
  { name: 'Status', label: 'Status', type: 'select' as const, options: ['Active', 'Inactive', 'VIP', 'Suspended'] },
  { name: 'Tax ID', label: 'Tax ID', type: 'text' as const },
  { name: 'Currency', label: 'Currency', type: 'select' as const, options: ['USD', 'EUR', 'GBP', 'JPY'] },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
];

/* ================================================================
   Helpers
   ================================================================ */

function getStatus(r: Record<string, any>): string {
  const s = Array.isArray(r.Status) ? r.Status[0] : r.Status;
  return s || 'Unknown';
}

function getSelectVal(r: Record<string, any>, key: string): string {
  const v = r[key];
  return Array.isArray(v) ? v[0] : String(v ?? '');
}

function resolveRef(val: any): string | null {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val[0] ?? null;
  if (typeof val === 'object' && val.id) return val.id;
  return null;
}

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return 9999;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 9999;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

/* ================================================================
   Props
   ================================================================ */

interface Props {
  customers: Record<string, any>[];
  salesOrders: Record<string, any>[];
  soLines: Record<string, any>[];
}

/* ================================================================
   Component
   ================================================================ */

export function CustomersClient({ customers: initialCustomers, salesOrders, soLines }: Props) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusTab, setStatusTab] = useState<string>('All');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view' | null>(null);
  const [selected, setSelected] = useState<Record<string, any> | null>(null);
  const [scorecardCustomer, setScorecardCustomer] = useState<Record<string, any> | null>(null);

  // ── Build customer -> orders index ──────────────
  const customerOrdersMap = useMemo(() => {
    const map = new Map<string, Record<string, any>[]>();
    for (const so of salesOrders) {
      const custRef = resolveRef(so['Customer']);
      if (custRef) {
        if (!map.has(custRef)) map.set(custRef, []);
        map.get(custRef)!.push(so);
      }
    }
    return map;
  }, [salesOrders]);

  // ── Build SO -> lines index ─────────────────────
  const soLinesMap = useMemo(() => {
    const map = new Map<string, Record<string, any>[]>();
    for (const line of soLines) {
      const soRef = resolveRef(line['Sales Order']);
      if (soRef) {
        if (!map.has(soRef)) map.set(soRef, []);
        map.get(soRef)!.push(line);
      }
    }
    return map;
  }, [soLines]);

  // ── Per-customer revenue ────────────────────────
  const customerRevenue = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of customers) {
      const orders = customerOrdersMap.get(c.id) ?? [];
      let total = 0;
      for (const o of orders) total += Number(o['Total Amount'] ?? 0);
      map.set(c.id, total);
    }
    return map;
  }, [customers, customerOrdersMap]);

  // ── KPI Computations ────────────────────────────
  const kpis = useMemo(() => {
    let active = 0, vip = 0, inactive = 0, suspended = 0;
    let totalCredit = 0;
    let totalRevenue = 0;
    let totalOrders = 0;
    const countryCount: Record<string, number> = {};

    for (const c of customers) {
      const status = getStatus(c);
      if (status === 'Active') active++;
      else if (status === 'VIP') vip++;
      else if (status === 'Inactive') inactive++;
      else if (status === 'Suspended') suspended++;

      totalCredit += Number(c['Credit Limit'] ?? 0);
      const rev = customerRevenue.get(c.id) ?? 0;
      totalRevenue += rev;

      const orders = customerOrdersMap.get(c.id) ?? [];
      totalOrders += orders.length;

      const country = String(c.Country ?? '').trim();
      if (country) countryCount[country] = (countryCount[country] ?? 0) + 1;
    }

    const topCountry = Object.entries(countryCount).sort((a, b) => b[1] - a[1])[0];
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const creditUtilization = totalCredit > 0 ? (totalRevenue / totalCredit) * 100 : 0;

    return {
      total: customers.length, active, vip, inactive, suspended,
      totalRevenue, avgOrderValue, totalCredit,
      creditUtilization: Math.min(creditUtilization, 100),
      topCountry: topCountry ? topCountry[0] : 'N/A',
      topCountryCount: topCountry ? topCountry[1] : 0,
    };
  }, [customers, customerRevenue, customerOrdersMap]);

  // ── Revenue by Customer (top 10) ────────────────
  const revenueByCustomer = useMemo(() => {
    return customers
      .map(c => ({
        name: String(c['Contact Person'] ?? c.Code ?? 'Unknown').slice(0, 20),
        revenue: customerRevenue.get(c.id) ?? 0,
        status: getStatus(c),
      }))
      .filter(c => c.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [customers, customerRevenue]);

  // ── Geographic Distribution ─────────────────────
  const geoData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of customers) {
      const country = String(c.Country ?? '').trim();
      if (country) counts[country] = (counts[country] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [customers]);

  // ── Credit Risk Analysis ────────────────────────
  const creditRisk = useMemo(() => {
    const atRisk: { name: string; used: number; limit: number; pct: number }[] = [];
    const paymentTermsDist: Record<string, number> = {};
    const creditByStatus: Record<string, { total: number; count: number }> = {};

    for (const c of customers) {
      const limit = Number(c['Credit Limit'] ?? 0);
      const used = customerRevenue.get(c.id) ?? 0;
      const pct = limit > 0 ? (used / limit) * 100 : 0;
      const status = getStatus(c);

      if (pct > 80 && limit > 0) {
        atRisk.push({
          name: String(c['Contact Person'] ?? c.Code ?? ''),
          used, limit, pct: Math.min(pct, 100),
        });
      }

      const pt = getSelectVal(c, 'Payment Terms') || 'Unknown';
      if (pt && pt !== 'undefined' && pt !== 'null') {
        paymentTermsDist[pt] = (paymentTermsDist[pt] ?? 0) + 1;
      }

      if (!creditByStatus[status]) creditByStatus[status] = { total: 0, count: 0 };
      creditByStatus[status].total += limit;
      creditByStatus[status].count++;
    }

    atRisk.sort((a, b) => b.pct - a.pct);

    const paymentTermsChart = Object.entries(paymentTermsDist)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const avgCreditByStatus = Object.entries(creditByStatus)
      .map(([status, { total, count }]) => ({ status, avg: count > 0 ? total / count : 0 }))
      .sort((a, b) => b.avg - a.avg);

    return { atRisk, paymentTermsChart, avgCreditByStatus };
  }, [customers, customerRevenue]);

  // ── RFM Segmentation ────────────────────────────
  const rfmSegments = useMemo(() => {
    const rfmData: { id: string; name: string; recency: number; frequency: number; monetary: number; segment: string }[] = [];

    for (const c of customers) {
      const orders = customerOrdersMap.get(c.id) ?? [];
      const monetary = customerRevenue.get(c.id) ?? 0;
      const frequency = orders.length;

      let mostRecent: string | null = null;
      for (const o of orders) {
        const d = o['Order Date'];
        if (d && (!mostRecent || d > mostRecent)) mostRecent = d;
      }
      const recency = daysSince(mostRecent);

      let segment = 'Lost';
      if (frequency >= 3 && recency <= 60 && monetary > 0) segment = 'Champions';
      else if (frequency >= 2 && recency <= 120) segment = 'Loyal';
      else if (frequency >= 1 && recency <= 180) segment = 'At Risk';
      else if (frequency === 0) segment = 'New';

      rfmData.push({
        id: c.id,
        name: String(c['Contact Person'] ?? c.Code ?? ''),
        recency, frequency, monetary, segment,
      });
    }

    const segmentCounts: Record<string, number> = {};
    for (const r of rfmData) segmentCounts[r.segment] = (segmentCounts[r.segment] ?? 0) + 1;

    return { data: rfmData, counts: segmentCounts };
  }, [customers, customerOrdersMap, customerRevenue]);

  // ── Customer Scorecard Data ─────────────────────
  const scorecardData = useMemo(() => {
    if (!scorecardCustomer) return null;
    const c = scorecardCustomer;
    const orders = (customerOrdersMap.get(c.id) ?? []).sort((a, b) => {
      const da = a['Order Date'] ?? '';
      const db = b['Order Date'] ?? '';
      return da < db ? -1 : da > db ? 1 : 0;
    });
    const totalRevenue = customerRevenue.get(c.id) ?? 0;
    const creditLimit = Number(c['Credit Limit'] ?? 0);
    const creditUsedPct = creditLimit > 0 ? Math.min((totalRevenue / creditLimit) * 100, 100) : 0;

    let mostRecentDate: string | null = null;
    for (const o of orders) {
      if (o['Order Date'] && (!mostRecentDate || o['Order Date'] > mostRecentDate)) mostRecentDate = o['Order Date'];
    }
    const recencyDays = daysSince(mostRecentDate);

    // Health score: 0-100
    let health = 50;
    const status = getStatus(c);
    if (status === 'VIP') health += 20;
    else if (status === 'Active') health += 10;
    else if (status === 'Suspended') health -= 20;
    else if (status === 'Inactive') health -= 10;

    if (orders.length >= 5) health += 15;
    else if (orders.length >= 2) health += 8;
    else if (orders.length === 0) health -= 15;

    if (recencyDays <= 30) health += 10;
    else if (recencyDays <= 90) health += 5;
    else if (recencyDays > 365) health -= 15;

    if (creditUsedPct > 90) health -= 10;
    else if (creditUsedPct < 50) health += 5;

    health = Math.max(0, Math.min(100, health));

    // Revenue trend
    const revenueTrend = orders.map(o => ({
      date: o['Order Date'] ? new Date(o['Order Date']).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : 'N/A',
      amount: Number(o['Total Amount'] ?? 0),
    }));

    return {
      customer: c,
      orders,
      totalRevenue,
      creditLimit,
      creditUsedPct,
      health,
      recencyDays,
      revenueTrend,
    };
  }, [scorecardCustomer, customerOrdersMap, customerRevenue]);

  // ── Filtered + sorted + paginated ───────────────
  const filtered = useMemo(() => {
    let result = customers;

    if (statusTab !== 'All') {
      result = result.filter(r => getStatus(r) === statusTab);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        Object.values(r).some(v => v != null && String(v).toLowerCase().includes(q))
      );
    }

    if (sortCol) {
      result = [...result].sort((a, b) => {
        let va = a[sortCol] ?? '';
        let vb = b[sortCol] ?? '';
        if (Array.isArray(va)) va = va[0] ?? '';
        if (Array.isArray(vb)) vb = vb[0] ?? '';
        if (typeof va === 'number' && typeof vb === 'number') {
          return sortDir === 'asc' ? va - vb : vb - va;
        }
        const sa = String(va).toLowerCase();
        const sb = String(vb).toLowerCase();
        return sortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
      });
    }

    return result;
  }, [customers, statusTab, search, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Sort handler ────────────────────────────────
  const handleSort = useCallback((key: string) => {
    if (sortCol === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(key);
      setSortDir('asc');
    }
    setPage(1);
  }, [sortCol]);

  // ── CRUD handlers ───────────────────────────────
  const handleCreate = async (values: Record<string, any>) => {
    await createRecord(TABLES.CUSTOMERS, values);
    setModalMode(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleUpdate = async (values: Record<string, any>) => {
    if (!selected) return;
    await updateRecord(TABLES.CUSTOMERS, selected.id, values);
    setModalMode(null);
    setSelected(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleDelete = async () => {
    if (!selected) return;
    await deleteRecord(TABLES.CUSTOMERS, selected.id);
    setCustomers(prev => prev.filter(r => r.id !== selected.id));
    setModalMode(null);
    setSelected(null);
  };

  const openScorecard = (c: Record<string, any>) => {
    setScorecardCustomer(c);
  };

  const segmentColor: Record<string, string> = {
    Champions: '#10b981',
    Loyal: '#6366f1',
    'At Risk': '#f59e0b',
    Lost: '#ef4444',
    New: '#06b6d4',
  };

  /* ================================================================
     Render
     ================================================================ */
  return (
    <div>
      {/* ── Header ─────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">CRM intelligence hub &mdash; relationships, revenue, and risk analysis</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setSelected(null); setModalMode('create'); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          New Customer
        </button>
      </div>

      {/* ── 6 Executive KPIs ───────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 24 }}>
        {/* Total Customers */}
        <div className="kpi-card">
          <div className="kpi-value">{kpis.total}</div>
          <div className="kpi-label">Total Customers</div>
          <div style={{ display: 'flex', gap: 3, marginTop: 8, height: 6 }}>
            {kpis.active > 0 && <div style={{ flex: kpis.active, background: '#10b981', borderRadius: 3 }} title={`Active: ${kpis.active}`} />}
            {kpis.vip > 0 && <div style={{ flex: kpis.vip, background: '#f59e0b', borderRadius: 3 }} title={`VIP: ${kpis.vip}`} />}
            {kpis.inactive > 0 && <div style={{ flex: kpis.inactive, background: '#64748b', borderRadius: 3 }} title={`Inactive: ${kpis.inactive}`} />}
            {kpis.suspended > 0 && <div style={{ flex: kpis.suspended, background: '#ef4444', borderRadius: 3 }} title={`Suspended: ${kpis.suspended}`} />}
          </div>
        </div>

        {/* Total Revenue */}
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: '#10b981' }}>{fmtCurrency(kpis.totalRevenue)}</div>
          <div className="kpi-label">Total Revenue</div>
        </div>

        {/* Avg Order Value */}
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: '#6366f1' }}>{fmtCurrency(kpis.avgOrderValue)}</div>
          <div className="kpi-label">Avg Order Value</div>
        </div>

        {/* Credit Utilization */}
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: kpis.creditUtilization > 80 ? '#ef4444' : kpis.creditUtilization > 50 ? '#f59e0b' : '#10b981' }}>
            {kpis.creditUtilization.toFixed(1)}%
          </div>
          <div className="kpi-label">Credit Utilization</div>
          <div className="progress-bar" style={{ marginTop: 8 }}>
            <div
              className={`progress-bar-fill ${kpis.creditUtilization > 80 ? 'red' : kpis.creditUtilization > 50 ? 'yellow' : 'green'}`}
              style={{ width: `${kpis.creditUtilization}%` }}
            />
          </div>
        </div>

        {/* Top Country */}
        <div className="kpi-card">
          <div className="kpi-value" style={{ fontSize: 22, color: '#06b6d4' }}>{kpis.topCountry}</div>
          <div className="kpi-label">Top Country ({kpis.topCountryCount})</div>
        </div>

        {/* VIP Count */}
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: '#f59e0b' }}>{kpis.vip}</div>
          <div className="kpi-label">VIP Customers</div>
        </div>
      </div>

      {/* ── Charts Row 1: Revenue by Customer + Geography ── */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Revenue by Customer */}
        <div className="chart-card">
          <h3>Revenue by Customer (Top 10)</h3>
          {revenueByCustomer.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={revenueByCustomer} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" tickFormatter={(v: number) => fmtCurrency(v)} tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  {...CHART_TOOLTIP}
                  formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Revenue']}
                />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                  {revenueByCustomer.map((entry, idx) => (
                    <Cell key={idx} fill={STATUS_COLORS[entry.status] ?? COLORS[idx % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">No revenue data</div>
          )}
        </div>

        {/* Geographic Distribution */}
        <div className="chart-card">
          <h3>Geographic Distribution</h3>
          {geoData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={geoData} margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip {...CHART_TOOLTIP} formatter={(value: any) => [value, 'Customers']} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {geoData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">No geographic data</div>
          )}
        </div>
      </div>

      {/* ── Charts Row 2: Credit Risk + RFM Segmentation ── */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Credit Risk Analysis */}
        <div className="chart-card">
          <h3>Credit Risk Analysis</h3>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            {/* Payment Terms Pie */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Payment Terms</div>
              {creditRisk.paymentTermsChart.length > 0 && (
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={creditRisk.paymentTermsChart} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={3} dataKey="value" stroke="none">
                      {creditRisk.paymentTermsChart.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...CHART_TOOLTIP} formatter={(value: any) => [value, 'Customers']} />
                    <Legend verticalAlign="bottom" iconType="circle" iconSize={6} formatter={(v: string) => <span style={{ color: '#94a3b8', fontSize: 10 }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            {/* Avg Credit by Status */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Avg Credit by Status</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {creditRisk.avgCreditByStatus.map(s => (
                  <div key={s.status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.status}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: STATUS_COLORS[s.status] ?? 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>{fmtCurrency(s.avg)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* At Risk Customers */}
          {creditRisk.atRisk.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Near Credit Limit (&gt;80%)
              </div>
              <div className="alert-list">
                {creditRisk.atRisk.slice(0, 5).map((r, i) => (
                  <div key={i} className="alert-item critical">
                    <div className="alert-dot red" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {fmtCurrency(r.used)} / {fmtCurrency(r.limit)}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--danger)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {r.pct.toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {creditRisk.atRisk.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--success)', padding: '12px 0' }}>No customers near credit limit</div>
          )}
        </div>

        {/* RFM Segmentation */}
        <div className="chart-card">
          <h3>Customer Segmentation (RFM)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
            {Object.entries(rfmSegments.counts).sort((a, b) => b[1] - a[1]).map(([segment, count]) => (
              <div key={segment} style={{
                background: `${segmentColor[segment] ?? '#6366f1'}18`,
                border: `1px solid ${segmentColor[segment] ?? '#6366f1'}40`,
                borderRadius: 'var(--radius)',
                padding: '12px 14px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: segmentColor[segment] ?? '#6366f1' }}>{count}</div>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: segmentColor[segment] ?? '#6366f1', marginTop: 2 }}>{segment}</div>
              </div>
            ))}
          </div>
          {/* RFM Detail Grid */}
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            <table className="data-table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ fontSize: 10 }}>Customer</th>
                  <th style={{ fontSize: 10 }}>Segment</th>
                  <th style={{ fontSize: 10 }}>Orders</th>
                  <th style={{ fontSize: 10 }}>Revenue</th>
                  <th style={{ fontSize: 10 }}>Last Order</th>
                </tr>
              </thead>
              <tbody>
                {rfmSegments.data.slice(0, 15).map(r => (
                  <tr key={r.id}>
                    <td style={{ fontSize: 12 }}>{r.name}</td>
                    <td>
                      <span style={{
                        display: 'inline-flex', padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 600,
                        background: `${segmentColor[r.segment] ?? '#6366f1'}18`,
                        color: segmentColor[r.segment] ?? '#6366f1',
                      }}>
                        {r.segment}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>{r.frequency}</td>
                    <td style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>{fmtCurrency(r.monetary)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {r.recency < 9999 ? `${r.recency}d ago` : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Status Filter Tabs ─────────────────────── */}
      <div className="tabs-bar">
        {STATUS_TABS.map(tab => {
          let count = customers.length;
          if (tab !== 'All') count = customers.filter(c => getStatus(c) === tab).length;
          return (
            <button
              key={tab}
              className={`tab-btn ${statusTab === tab ? 'active' : ''}`}
              onClick={() => { setStatusTab(tab); setPage(1); }}
            >
              {tab}
              <span className="tab-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Search + Table ──────────────────────────── */}
      <div className="table-container">
        <div className="toolbar" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            {statusTab === 'All' ? 'All Customers' : `${statusTab} Customers`}{' '}
            <span style={{ fontWeight: 500, color: 'var(--text-dim)', fontSize: 12 }}>({filtered.length})</span>
          </h3>
          <div className="search-bar">
            <span className="search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            </span>
            <input
              className="input"
              placeholder="Search customers..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ width: 260 }}
            />
          </div>
        </div>

        {pageData.length === 0 ? (
          <div className="empty-state">No customers found</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {columns.map(c => (
                  <th
                    key={c.key}
                    onClick={c.sortable ? () => handleSort(c.key) : undefined}
                    style={{ cursor: c.sortable ? 'pointer' : 'default', userSelect: 'none' }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {c.label}
                      {c.sortable && sortCol === c.key && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ opacity: 0.7 }}>
                          {sortDir === 'asc'
                            ? <path d="M5 2L9 7H1z" />
                            : <path d="M5 8L1 3h8z" />
                          }
                        </svg>
                      )}
                    </span>
                  </th>
                ))}
                <th style={{ width: 60 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageData.map(row => (
                <tr key={row.id} style={{ cursor: 'pointer' }}>
                  {columns.map(c => (
                    <td
                      key={c.key}
                      onClick={() => openScorecard(row)}
                    >
                      {c.render ? c.render(row[c.key], row) : String(row[c.key] ?? '\u2014')}
                    </td>
                  ))}
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => { e.stopPropagation(); setSelected(row); setModalMode('view'); }}
                        title="View"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => { e.stopPropagation(); setSelected(row); setModalMode('edit'); }}
                        title="Edit"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let p: number;
            if (totalPages <= 7) {
              p = i + 1;
            } else if (page <= 4) {
              p = i + 1;
            } else if (page >= totalPages - 3) {
              p = totalPages - 6 + i;
            } else {
              p = page - 3 + i;
            }
            return (
              <button
                key={p}
                className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPage(p)}
                style={{ minWidth: 32 }}
              >
                {p}
              </button>
            );
          })}
          <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}

      {/* ── Customer Scorecard Panel ───────────────── */}
      <Modal
        open={!!scorecardCustomer}
        onClose={() => setScorecardCustomer(null)}
        title={scorecardData ? `${scorecardData.customer['Contact Person'] ?? scorecardData.customer.Code ?? 'Customer'} Scorecard` : 'Customer Scorecard'}
      >
        {scorecardData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Health Score */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              {/* Circular gauge */}
              <div style={{ position: 'relative', width: 90, height: 90, flexShrink: 0 }}>
                <svg viewBox="0 0 36 36" style={{ width: 90, height: 90, transform: 'rotate(-90deg)' }}>
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={scorecardData.health >= 70 ? '#10b981' : scorecardData.health >= 40 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="3"
                    strokeDasharray={`${scorecardData.health}, 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{scorecardData.health}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Health</span>
                </div>
              </div>
              {/* Key metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flex: 1 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Revenue</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>{fmtCurrency(scorecardData.totalRevenue)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Orders</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#6366f1' }}>{scorecardData.orders.length}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Last Order</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                    {scorecardData.recencyDays < 9999 ? `${scorecardData.recencyDays} days ago` : 'Never'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</div>
                  <StatusBadge value={getStatus(scorecardData.customer)} />
                </div>
              </div>
            </div>

            {/* Credit Limit Gauge */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Credit Utilization
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {fmtCurrency(scorecardData.totalRevenue)} / {fmtCurrency(scorecardData.creditLimit)}
                </span>
              </div>
              <div className="progress-bar lg">
                <div
                  className={`progress-bar-fill ${scorecardData.creditUsedPct > 80 ? 'red' : scorecardData.creditUsedPct > 50 ? 'yellow' : 'green'}`}
                  style={{ width: `${scorecardData.creditUsedPct}%` }}
                />
              </div>
              <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                {scorecardData.creditUsedPct.toFixed(1)}% used
              </div>
            </div>

            {/* Revenue Trend */}
            {scorecardData.revenueTrend.length > 1 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  Revenue Trend
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={scorecardData.revenueTrend} margin={{ left: 0, right: 0, top: 5, bottom: 5 }}>
                    <defs>
                      <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip {...CHART_TOOLTIP} formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Amount']} />
                    <Area type="monotone" dataKey="amount" stroke="#6366f1" fill="url(#revGradient)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Recent Orders */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Order History ({scorecardData.orders.length})
              </div>
              {scorecardData.orders.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '8px 0' }}>No orders yet</div>
              ) : (
                <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                  {scorecardData.orders.slice(-10).reverse().map((o, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 0', borderBottom: i < Math.min(scorecardData!.orders.length, 10) - 1 ? '1px solid var(--border-light)' : 'none',
                    }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                          {o['Order Number'] ?? `Order #${i + 1}`}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {o['Order Date'] ? new Date(o['Order Date']).toLocaleDateString() : 'No date'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <StatusBadge value={o.Status} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>
                          ${Number(o['Total Amount'] ?? 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="form-actions" style={{ marginTop: 0, paddingTop: 16 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setScorecardCustomer(null)}>Close</button>
              <button className="btn btn-primary btn-sm" onClick={() => { setSelected(scorecardData.customer); setModalMode('edit'); setScorecardCustomer(null); }}>Edit Customer</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Create Modal ───────────────────────────── */}
      <Modal open={modalMode === 'create'} onClose={() => setModalMode(null)} title="New Customer">
        <RecordForm fields={formFields} onSubmit={handleCreate} onCancel={() => setModalMode(null)} submitLabel="Create" />
      </Modal>

      {/* ── Edit Modal ─────────────────────────────── */}
      <Modal open={modalMode === 'edit'} onClose={() => { setModalMode(null); setSelected(null); }} title="Edit Customer">
        {selected && (
          <RecordForm fields={formFields} initialValues={selected} onSubmit={handleUpdate} onCancel={() => { setModalMode(null); setSelected(null); }} submitLabel="Update" />
        )}
      </Modal>

      {/* ── View Modal ─────────────────────────────── */}
      <Modal open={modalMode === 'view' && !!selected} onClose={() => { setModalMode(null); setSelected(null); }} title="Customer Details">
        {selected && (
          <div>
            <div className="detail-grid" style={{ marginBottom: 24 }}>
              {Object.entries(selected).filter(([k]) => !['id', 'createdAt', 'updatedAt', 'createdBy'].includes(k)).map(([key, val]) => (
                <div key={key}>
                  <div className="detail-field-label">{key}</div>
                  <div className="detail-field-value">
                    {val == null || val === '' ? '\u2014' : typeof val === 'boolean' ? <StatusBadge value={val ? 'Active' : 'Inactive'} /> : String(val)}
                  </div>
                </div>
              ))}
            </div>
            {/* Inline revenue summary */}
            <div style={{ display: 'flex', gap: 16, padding: '12px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Total Revenue</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>{fmtCurrency(customerRevenue.get(selected.id) ?? 0)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Orders</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#6366f1' }}>{(customerOrdersMap.get(selected.id) ?? []).length}</div>
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: 0, paddingTop: 16 }}>
              <button className="btn btn-danger btn-sm" onClick={handleDelete}>Delete</button>
              <button className="btn btn-primary btn-sm" onClick={() => setModalMode('edit')}>Edit</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
