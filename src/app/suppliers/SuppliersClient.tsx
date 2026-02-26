'use client';

import { useState, useMemo, useCallback } from 'react';
import { createRecord, updateRecord, deleteRecord } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { Modal } from '@/components/Modal';
import { RecordForm } from '@/components/RecordForm';
import { StatusBadge } from '@/components/StatusBadge';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

/* ================================================================
   Constants
   ================================================================ */

const CHART_TOOLTIP = {
  contentStyle: { background: '#1a2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 },
  labelStyle: { color: '#94a3b8' },
  itemStyle: { color: '#f1f5f9' },
};
const AXIS_TICK = { fill: '#64748b', fontSize: 11 };
const GRID_STROKE = 'rgba(255,255,255,0.04)';
const COLORS = ['#6366f1', '#f97316', '#10b981', '#06b6d4', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6'];

const STATUS_OPTIONS = ['Active', 'Inactive', 'Preferred', 'Blacklisted'] as const;
type SupplierStatus = (typeof STATUS_OPTIONS)[number];

const STATUS_COLORS: Record<string, string> = {
  Active: '#10b981',
  Inactive: '#64748b',
  Preferred: '#6366f1',
  Blacklisted: '#ef4444',
};

const PAYMENT_COLORS: Record<string, string> = {
  'Net 30': '#6366f1',
  'Net 60': '#f97316',
  'Net 90': '#10b981',
  Prepaid: '#06b6d4',
  COD: '#f59e0b',
};

const formFields = [
  { name: 'Code', label: 'Code', type: 'text', required: true },
  { name: 'Contact Person', label: 'Contact Person', type: 'text' },
  { name: 'Email', label: 'Email', type: 'text' },
  { name: 'Phone', label: 'Phone', type: 'text' },
  { name: 'Address', label: 'Address', type: 'text' },
  { name: 'City', label: 'City', type: 'text' },
  { name: 'Country', label: 'Country', type: 'text' },
  { name: 'Payment Terms', label: 'Payment Terms', type: 'select', options: ['Net 30', 'Net 60', 'Net 90', 'Prepaid', 'COD'] },
  { name: 'Default Lead Time', label: 'Default Lead Time (days)', type: 'number' },
  { name: 'Rating Score', label: 'Rating Score (0-5)', type: 'number' },
  { name: 'Status', label: 'Status', type: 'select', options: ['Active', 'Inactive', 'Preferred', 'Blacklisted'] },
  { name: 'Tax ID', label: 'Tax ID', type: 'text' },
  { name: 'Currency', label: 'Currency', type: 'select', options: ['USD', 'EUR', 'GBP', 'INR', 'JPY'] },
  { name: 'Notes', label: 'Notes', type: 'textarea' },
];

/* ================================================================
   Helpers
   ================================================================ */

function getField(rec: any, key: string): string {
  const val = rec[key];
  if (val == null) return '';
  if (Array.isArray(val)) return val[0] ?? '';
  return String(val);
}

function getNumField(rec: any, key: string): number {
  const val = rec[key];
  if (val == null) return 0;
  return Number(val) || 0;
}

function StarRating({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(5, score));
  return (
    <div className="rating-bar">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = clamped >= star;
        const half = !filled && clamped >= star - 0.5;
        return (
          <svg
            key={star}
            className={`rating-star ${filled || half ? 'filled' : 'empty'}`}
            viewBox="0 0 20 20"
            fill={filled ? '#f59e0b' : half ? 'url(#halfStar)' : 'none'}
            stroke={filled || half ? '#f59e0b' : 'currentColor'}
            strokeWidth="1.5"
          >
            {half && (
              <defs>
                <linearGradient id="halfStar">
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="50%" stopColor="transparent" />
                </linearGradient>
              </defs>
            )}
            <path d="M10 1l2.39 4.84L17.3 6.7l-3.65 3.56.86 5.02L10 13.02l-4.51 2.26.86-5.02L2.7 6.7l4.91-.86L10 1z" />
          </svg>
        );
      })}
      <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>
        {clamped.toFixed(1)}
      </span>
    </div>
  );
}

/* ================================================================
   Tooltips
   ================================================================ */

function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ ...CHART_TOOLTIP.contentStyle, padding: '8px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
      {label && <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</div>}
      {payload.map((entry: any, i: number) => (
        <div key={i} style={{ fontSize: 13, fontWeight: 600, color: entry.color || '#f1f5f9' }}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
        </div>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div style={{ ...CHART_TOOLTIP.contentStyle, padding: '8px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: entry.payload?.fill || '#f1f5f9' }}>
        {entry.name}: {entry.value}
      </div>
    </div>
  );
}

/* ================================================================
   Main Component
   ================================================================ */

interface Props {
  suppliers: any[];
}

export function SuppliersClient({ suppliers: initialSuppliers }: Props) {
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'detail' | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  /* ── Derived data ─────────────────────────── */

  const totalSuppliers = suppliers.length;

  const activeCount = useMemo(
    () => suppliers.filter((s) => getField(s, 'Status') === 'Active').length,
    [suppliers],
  );

  const avgRating = useMemo(() => {
    const ratings = suppliers.map((s) => getNumField(s, 'Rating Score')).filter((r) => r > 0);
    if (ratings.length === 0) return 0;
    return ratings.reduce((a, b) => a + b, 0) / ratings.length;
  }, [suppliers]);

  const uniqueCountries = useMemo(() => {
    const set = new Set<string>();
    suppliers.forEach((s) => {
      const c = getField(s, 'Country');
      if (c) set.add(c);
    });
    return set.size;
  }, [suppliers]);

  // Top 10 by rating (horizontal bar)
  const topRated = useMemo(() => {
    return [...suppliers]
      .filter((s) => getNumField(s, 'Rating Score') > 0)
      .sort((a, b) => getNumField(b, 'Rating Score') - getNumField(a, 'Rating Score'))
      .slice(0, 10)
      .map((s) => {
        const name = getField(s, 'Name') || getField(s, 'Code') || 'Unnamed';
        const shortName = name.length > 18 ? name.slice(0, 16) + '..' : name;
        return { name: shortName, fullName: name, rating: getNumField(s, 'Rating Score') };
      });
  }, [suppliers]);

  // Payment terms distribution
  const paymentDist = useMemo(() => {
    const counts: Record<string, number> = {};
    suppliers.forEach((s) => {
      const pt = getField(s, 'Payment Terms') || 'Unknown';
      counts[pt] = (counts[pt] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [suppliers]);

  // Filtered list
  const filtered = useMemo(() => {
    return suppliers.filter((s) => {
      if (statusFilter !== 'All' && getField(s, 'Status') !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const nameMatch = (getField(s, 'Name') || '').toLowerCase().includes(q);
        const codeMatch = (getField(s, 'Code') || '').toLowerCase().includes(q);
        const contactMatch = (getField(s, 'Contact Person') || '').toLowerCase().includes(q);
        const emailMatch = (getField(s, 'Email') || '').toLowerCase().includes(q);
        const countryMatch = (getField(s, 'Country') || '').toLowerCase().includes(q);
        if (!nameMatch && !codeMatch && !contactMatch && !emailMatch && !countryMatch) return false;
      }
      return true;
    });
  }, [suppliers, statusFilter, search]);

  /* ── CRUD ──────────────────────────────────── */

  const handleCreate = useCallback(async (values: Record<string, any>) => {
    const rec = await createRecord(TABLES.SUPPLIERS, values);
    setSuppliers((prev) => [rec, ...prev]);
    setModalMode(null);
  }, []);

  const handleUpdate = useCallback(async (values: Record<string, any>) => {
    if (!selectedSupplier) return;
    const updated = await updateRecord(TABLES.SUPPLIERS, selectedSupplier.id, values);
    setSuppliers((prev) => prev.map((s) => (s.id === selectedSupplier.id ? { ...s, ...updated } : s)));
    setModalMode(null);
    setSelectedSupplier(null);
  }, [selectedSupplier]);

  const handleDelete = useCallback(async (id: string) => {
    setDeleting(id);
    try {
      await deleteRecord(TABLES.SUPPLIERS, id);
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
      if (modalMode === 'detail') {
        setModalMode(null);
        setSelectedSupplier(null);
      }
    } finally {
      setDeleting(null);
    }
  }, [modalMode]);

  const openDetail = (s: any) => {
    setSelectedSupplier(s);
    setModalMode('detail');
  };

  const openEdit = (s: any) => {
    setSelectedSupplier(s);
    setModalMode('edit');
  };

  /* ── Status counts for pills ───────────────── */
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: suppliers.length };
    STATUS_OPTIONS.forEach((st) => {
      counts[st] = suppliers.filter((s) => getField(s, 'Status') === st).length;
    });
    return counts;
  }, [suppliers]);

  /* ── Render ────────────────────────────────── */

  return (
    <div>
      {/* ── Header ───────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Supplier Scorecards</h1>
          <p className="page-subtitle">
            Supplier performance intelligence &mdash; {totalSuppliers} suppliers across {uniqueCountries} countries
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setSelectedSupplier(null); setModalMode('create'); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Add Supplier
        </button>
      </div>

      {/* ── KPI Row ──────────────────────── */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Suppliers</div>
          <div className="kpi-value">{totalSuppliers}</div>
          <div className="kpi-trend neutral">All registered suppliers</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Active Suppliers</div>
          <div className="kpi-value" style={{ color: '#10b981' }}>{activeCount}</div>
          <div className="kpi-trend up">
            {totalSuppliers > 0 ? ((activeCount / totalSuppliers) * 100).toFixed(0) : 0}% of total
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Average Rating</div>
          <div className="kpi-value" style={{ color: '#f59e0b' }}>{avgRating.toFixed(1)}</div>
          <div style={{ marginTop: 6 }}>
            <StarRating score={avgRating} />
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Unique Countries</div>
          <div className="kpi-value" style={{ color: '#06b6d4' }}>{uniqueCountries}</div>
          <div className="kpi-trend neutral">Geographic spread</div>
        </div>
      </div>

      {/* ── Charts Row ───────────────────── */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Bar: Top 10 by Rating */}
        <div className="chart-card">
          <h3>Top Suppliers by Rating</h3>
          {topRated.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No rated suppliers</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topRated} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 10 }}>
                <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
                <XAxis type="number" domain={[0, 5]} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={120} />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
                <Bar dataKey="rating" name="Rating" radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {topRated.map((_, idx) => (
                    <Cell key={idx} fill={idx < 3 ? '#f59e0b' : '#6366f1'} fillOpacity={1 - idx * 0.06} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie: Payment Terms */}
        <div className="chart-card">
          <h3>Payment Terms Distribution</h3>
          {paymentDist.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No payment terms data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={paymentDist}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {paymentDist.map((entry, idx) => (
                    <Cell key={entry.name} fill={PAYMENT_COLORS[entry.name] || COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <legend />
              </PieChart>
            </ResponsiveContainer>
          )}
          {/* Legend below pie */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 8 }}>
            {paymentDist.map((entry, idx) => (
              <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: PAYMENT_COLORS[entry.name] || COLORS[idx % COLORS.length] }} />
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>{entry.name} ({entry.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Filter Bar ───────────────────── */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <div className="search-bar" style={{ flex: 1, maxWidth: 320 }}>
          <span className="search-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          </span>
          <input
            className="input"
            placeholder="Search suppliers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {(['All', ...STATUS_OPTIONS] as const).map((st) => (
          <button
            key={st}
            className={`filter-pill ${statusFilter === st ? 'active' : ''}`}
            onClick={() => setStatusFilter(st)}
          >
            {st}
            <span style={{ marginLeft: 4, opacity: 0.6 }}>({statusCounts[st] || 0})</span>
          </button>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <div className="view-toggle">
            <button className={viewMode === 'cards' ? 'active' : ''} onClick={() => setViewMode('cards')}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
              {' '}Cards
            </button>
            <button className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
              {' '}Table
            </button>
          </div>
        </div>
      </div>

      {/* ── Card View ────────────────────── */}
      {viewMode === 'cards' && (
        filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">&#128666;</div>
            <p>No suppliers found</p>
          </div>
        ) : (
          <div className="scorecard-grid">
            {filtered.map((s) => {
              const name = getField(s, 'Name') || getField(s, 'Code') || 'Unnamed Supplier';
              const code = getField(s, 'Code');
              const status = getField(s, 'Status');
              const rating = getNumField(s, 'Rating Score');
              const contact = getField(s, 'Contact Person');
              const email = getField(s, 'Email');
              const phone = getField(s, 'Phone');
              const city = getField(s, 'City');
              const country = getField(s, 'Country');
              const paymentTerms = getField(s, 'Payment Terms');
              const leadTime = getField(s, 'Default Lead Time');
              const currency = getField(s, 'Currency');

              return (
                <div key={s.id} className="scorecard" onClick={() => openDetail(s)}>
                  {/* Header */}
                  <div className="scorecard-header">
                    <div>
                      <div className="scorecard-title">{name}</div>
                      {code && <div className="scorecard-subtitle"><span className="mono-text">{code}</span></div>}
                    </div>
                    <StatusBadge value={status} />
                  </div>

                  {/* Rating */}
                  <div style={{ marginBottom: 14 }}>
                    <StarRating score={rating} />
                    <div className="progress-bar lg" style={{ marginTop: 6 }}>
                      <div
                        className={`progress-bar-fill ${rating >= 4 ? 'green' : rating >= 2.5 ? 'yellow' : 'red'}`}
                        style={{ width: `${(rating / 5) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Details */}
                  <div className="scorecard-body">
                    {contact && (
                      <div className="scorecard-row">
                        <span className="label">Contact</span>
                        <span className="value">{contact}</span>
                      </div>
                    )}
                    {email && (
                      <div className="scorecard-row">
                        <span className="label">Email</span>
                        <span className="value" style={{ fontSize: 11 }}>{email}</span>
                      </div>
                    )}
                    {phone && (
                      <div className="scorecard-row">
                        <span className="label">Phone</span>
                        <span className="value">{phone}</span>
                      </div>
                    )}
                    {(city || country) && (
                      <div className="scorecard-row">
                        <span className="label">Location</span>
                        <span className="value">{[city, country].filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                    {paymentTerms && (
                      <div className="scorecard-row">
                        <span className="label">Payment</span>
                        <span className="tag">{paymentTerms}</span>
                      </div>
                    )}
                    {leadTime && (
                      <div className="scorecard-row">
                        <span className="label">Lead Time</span>
                        <span className="value">{leadTime} days</span>
                      </div>
                    )}
                    {currency && (
                      <div className="scorecard-row">
                        <span className="label">Currency</span>
                        <span className="mono-text">{currency}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── Table View ───────────────────── */}
      {viewMode === 'table' && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name / Code</th>
                <th>Contact</th>
                <th>Location</th>
                <th>Payment Terms</th>
                <th>Lead Time</th>
                <th>Rating</th>
                <th>Status</th>
                <th style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8}><div className="empty-state">No suppliers found</div></td></tr>
              ) : (
                filtered.map((s) => {
                  const name = getField(s, 'Name') || getField(s, 'Code') || 'Unnamed';
                  const code = getField(s, 'Code');
                  const contact = getField(s, 'Contact Person');
                  const email = getField(s, 'Email');
                  const city = getField(s, 'City');
                  const country = getField(s, 'Country');
                  const pt = getField(s, 'Payment Terms');
                  const lt = getField(s, 'Default Lead Time');
                  const rating = getNumField(s, 'Rating Score');
                  const status = getField(s, 'Status');

                  return (
                    <tr key={s.id} onClick={() => openDetail(s)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{name}</div>
                        {code && <div className="mono-text" style={{ marginTop: 2 }}>{code}</div>}
                      </td>
                      <td>
                        <div>{contact || '\u2014'}</div>
                        {email && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{email}</div>}
                      </td>
                      <td>{[city, country].filter(Boolean).join(', ') || '\u2014'}</td>
                      <td>{pt ? <span className="tag">{pt}</span> : '\u2014'}</td>
                      <td>{lt ? `${lt} days` : '\u2014'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div className="progress-bar" style={{ width: 60 }}>
                            <div
                              className={`progress-bar-fill ${rating >= 4 ? 'green' : rating >= 2.5 ? 'yellow' : 'red'}`}
                              style={{ width: `${(rating / 5) * 100}%` }}
                            />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{rating.toFixed(1)}</span>
                        </div>
                      </td>
                      <td><StatusBadge value={status} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)} title="Edit">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleDelete(s.id)}
                            disabled={deleting === s.id}
                            title="Delete"
                            style={{ color: 'var(--danger)' }}
                          >
                            {deleting === s.id ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> : (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create Modal ─────────────────── */}
      <Modal open={modalMode === 'create'} onClose={() => setModalMode(null)} title="Add Supplier">
        <RecordForm
          fields={formFields}
          onSubmit={handleCreate}
          onCancel={() => setModalMode(null)}
          submitLabel="Create Supplier"
        />
      </Modal>

      {/* ── Edit Modal ───────────────────── */}
      <Modal open={modalMode === 'edit'} onClose={() => { setModalMode(null); setSelectedSupplier(null); }} title="Edit Supplier">
        {selectedSupplier && (
          <RecordForm
            fields={formFields}
            initialValues={selectedSupplier}
            onSubmit={handleUpdate}
            onCancel={() => { setModalMode(null); setSelectedSupplier(null); }}
            submitLabel="Save Changes"
          />
        )}
      </Modal>

      {/* ── Detail Modal ─────────────────── */}
      <Modal
        open={modalMode === 'detail'}
        onClose={() => { setModalMode(null); setSelectedSupplier(null); }}
        title="Supplier Details"
      >
        {selectedSupplier && (
          <div>
            {/* Name + status header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                  {getField(selectedSupplier, 'Name') || getField(selectedSupplier, 'Code') || 'Unnamed'}
                </div>
                {getField(selectedSupplier, 'Code') && (
                  <div className="mono-text" style={{ marginTop: 4 }}>{getField(selectedSupplier, 'Code')}</div>
                )}
              </div>
              <StatusBadge value={getField(selectedSupplier, 'Status')} />
            </div>

            {/* Rating */}
            <div style={{ marginBottom: 20 }}>
              <StarRating score={getNumField(selectedSupplier, 'Rating Score')} />
              <div className="progress-bar lg" style={{ marginTop: 8 }}>
                <div
                  className={`progress-bar-fill ${getNumField(selectedSupplier, 'Rating Score') >= 4 ? 'green' : getNumField(selectedSupplier, 'Rating Score') >= 2.5 ? 'yellow' : 'red'}`}
                  style={{ width: `${(getNumField(selectedSupplier, 'Rating Score') / 5) * 100}%` }}
                />
              </div>
            </div>

            {/* Detail grid */}
            <div className="detail-grid">
              {[
                ['Contact Person', 'Contact Person'],
                ['Email', 'Email'],
                ['Phone', 'Phone'],
                ['Address', 'Address'],
                ['City', 'City'],
                ['Country', 'Country'],
                ['Payment Terms', 'Payment Terms'],
                ['Default Lead Time', 'Default Lead Time'],
                ['Tax ID', 'Tax ID'],
                ['Currency', 'Currency'],
              ].map(([label, key]) => {
                const val = getField(selectedSupplier, key);
                if (!val) return null;
                return (
                  <div key={key}>
                    <div className="detail-field-label">{label}</div>
                    <div className="detail-field-value">
                      {key === 'Default Lead Time' ? `${val} days` : val}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Notes */}
            {getField(selectedSupplier, 'Notes') && (
              <div style={{ marginTop: 16 }}>
                <div className="detail-field-label">Notes</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 4 }}>
                  {getField(selectedSupplier, 'Notes')}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="form-actions" style={{ marginTop: 20 }}>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleDelete(selectedSupplier.id)}
                disabled={deleting === selectedSupplier.id}
              >
                {deleting === selectedSupplier.id ? 'Deleting...' : 'Delete'}
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => openEdit(selectedSupplier)}>
                Edit Supplier
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
