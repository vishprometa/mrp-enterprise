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
  Legend,
} from 'recharts';

/* ================================================================
   Types
   ================================================================ */

interface Props {
  items: any[];
}

type ViewMode = 'cards' | 'table';
type ModalMode = 'create' | 'detail' | 'edit' | 'delete' | null;

/* ================================================================
   Constants
   ================================================================ */

const ITEM_TYPES = ['Raw Material', 'Semi-Finished', 'Finished Good', 'Consumable'] as const;
const CATEGORIES = ['Metal', 'Plastic', 'Electronic', 'Chemical', 'Mechanical'] as const;
const STATUSES = ['Active', 'Inactive', 'Pending Approval', 'Obsolete'] as const;

const COLORS = ['#6366f1', '#f97316', '#10b981', '#06b6d4', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6'];

const CATEGORY_COLORS: Record<string, string> = {
  Metal: '#6366f1',
  Plastic: '#f97316',
  Electronic: '#10b981',
  Chemical: '#06b6d4',
  Mechanical: '#f59e0b',
};

const TYPE_COLORS: Record<string, string> = {
  'Raw Material': '#6366f1',
  'Semi-Finished': '#f97316',
  'Finished Good': '#10b981',
  Consumable: '#a855f7',
};

const AXIS_TICK = { fill: '#64748b', fontSize: 11 };

const formFields = [
  { name: 'SKU', label: 'SKU', type: 'text', required: true },
  { name: 'Description', label: 'Description', type: 'textarea' },
  { name: 'Item Type', label: 'Item Type', type: 'select', options: [...ITEM_TYPES] },
  { name: 'Category', label: 'Category', type: 'select', options: [...CATEGORIES] },
  { name: 'Unit of Measure', label: 'Unit of Measure', type: 'text' },
  { name: 'Lead Time Days', label: 'Lead Time Days', type: 'number' },
  { name: 'Safety Stock', label: 'Safety Stock', type: 'number' },
  { name: 'Reorder Point', label: 'Reorder Point', type: 'number' },
  { name: 'Standard Cost', label: 'Standard Cost', type: 'number' },
  { name: 'Weight', label: 'Weight', type: 'number' },
  { name: 'Status', label: 'Status', type: 'select', options: [...STATUSES] },
  { name: 'Min Order Qty', label: 'Min Order Qty', type: 'number' },
  { name: 'Max Order Qty', label: 'Max Order Qty', type: 'number' },
  { name: 'Shelf Life Days', label: 'Shelf Life Days', type: 'number' },
  { name: 'Storage Conditions', label: 'Storage Conditions', type: 'text' },
  { name: 'Notes', label: 'Notes', type: 'textarea' },
];

const tableColumns = [
  'SKU', 'Description', 'Item Type', 'Category', 'Unit of Measure',
  'Standard Cost', 'Lead Time Days', 'Safety Stock', 'Status',
];

/* ================================================================
   Helpers
   ================================================================ */

function getField(item: any, key: string): string {
  const val = item[key];
  if (val == null || val === '' || val === 'undefined' || val === 'null') return '';
  if (Array.isArray(val)) return val[0] ?? '';
  return String(val);
}

function getNum(item: any, key: string): number {
  const val = item[key];
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function getBadgeClass(type: string): string {
  switch (type) {
    case 'Raw Material': return 'badge-info';
    case 'Semi-Finished': return 'badge-draft';
    case 'Finished Good': return 'badge-active';
    case 'Consumable': return 'badge-purple';
    case 'Metal': return 'badge-info';
    case 'Plastic': return 'badge-draft';
    case 'Electronic': return 'badge-active';
    case 'Chemical': return 'badge-purple';
    case 'Mechanical': return 'badge-danger';
    default: return 'badge-inactive';
  }
}

/* ================================================================
   Dark Tooltips
   ================================================================ */

function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1a2332', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8, padding: '8px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    }}>
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
    <div style={{
      background: '#1a2332', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8, padding: '8px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: entry.payload?.fill || '#f1f5f9' }}>
        {entry.name}: {entry.value}
      </div>
    </div>
  );
}

/* ================================================================
   Main Component
   ================================================================ */

export function ItemsClient({ items: initialItems }: Props) {
  const [items, setItems] = useState<any[]>(initialItems);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('cards');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  /* ── Filtered items ──────────────────── */
  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (search) {
        const q = search.toLowerCase();
        const haystack = [
          getField(item, 'SKU'),
          getField(item, 'Description'),
          getField(item, 'Item Type'),
          getField(item, 'Category'),
          getField(item, 'Notes'),
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (typeFilter && getField(item, 'Item Type') !== typeFilter) return false;
      if (statusFilter && getField(item, 'Status') !== statusFilter) return false;
      return true;
    });
  }, [items, search, typeFilter, statusFilter]);

  /* ── KPI data ────────────────────────── */
  const kpis = useMemo(() => {
    const total = items.length;
    const active = items.filter((i) => getField(i, 'Status') === 'Active').length;
    const costs = items.map((i) => getNum(i, 'Standard Cost')).filter((c) => c > 0);
    const avgCost = costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;
    const lowStock = items.filter((i) => getNum(i, 'Safety Stock') > 0).length;
    return { total, active, avgCost, lowStock };
  }, [items]);

  /* ── Chart: items by category ────────── */
  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      const cat = getField(item, 'Category') || 'Uncategorized';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [items]);

  /* ── Chart: items by type ────────────── */
  const typeData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      const t = getField(item, 'Item Type') || 'Untyped';
      counts[t] = (counts[t] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [items]);

  /* ── CRUD handlers ───────────────────── */
  const handleCreate = useCallback(async (values: Record<string, any>) => {
    const result = await createRecord(TABLES.ITEMS, values);
    setItems((prev) => [result, ...prev]);
    setModalMode(null);
  }, []);

  const handleUpdate = useCallback(async (values: Record<string, any>) => {
    if (!selectedItem) return;
    const result = await updateRecord(TABLES.ITEMS, selectedItem.id, values);
    setItems((prev) => prev.map((i) => (i.id === selectedItem.id ? { ...i, ...result } : i)));
    setModalMode(null);
    setSelectedItem(null);
  }, [selectedItem]);

  const handleDelete = useCallback(async () => {
    if (!selectedItem) return;
    setSaving(true);
    try {
      await deleteRecord(TABLES.ITEMS, selectedItem.id);
      setItems((prev) => prev.filter((i) => i.id !== selectedItem.id));
      setModalMode(null);
      setSelectedItem(null);
    } finally {
      setSaving(false);
    }
  }, [selectedItem]);

  const openDetail = (item: any) => {
    setSelectedItem(item);
    setModalMode('detail');
  };

  const openEdit = (item: any) => {
    setSelectedItem(item);
    setModalMode('edit');
  };

  /* ================================================================
     Render
     ================================================================ */

  return (
    <div>
      {/* ── Page Header ───────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Items</h1>
          <p className="page-subtitle">Product catalog &mdash; {items.length} items across {categoryData.length} categories</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setSelectedItem(null); setModalMode('create'); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Item
        </button>
      </div>

      {/* ── KPI Cards ─────────────────────────── */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Items</div>
          <div className="kpi-value">{kpis.total.toLocaleString()}</div>
          <div className="kpi-trend neutral">{filtered.length} matching filters</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Active Items</div>
          <div className="kpi-value" style={{ color: 'var(--success)' }}>{kpis.active.toLocaleString()}</div>
          <div className="kpi-trend neutral">
            {kpis.total > 0 ? ((kpis.active / kpis.total) * 100).toFixed(0) : 0}% of catalog
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Avg Standard Cost</div>
          <div className="kpi-value">{formatCurrency(kpis.avgCost)}</div>
          <div className="kpi-trend neutral">across all items</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Safety Stock Tracked</div>
          <div className="kpi-value" style={{ color: 'var(--warning)' }}>{kpis.lowStock.toLocaleString()}</div>
          <div className="kpi-trend neutral">items with safety stock set</div>
        </div>
      </div>

      {/* ── Filter Bar ────────────────────────── */}
      <div className="toolbar">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
          <div className="search-bar" style={{ minWidth: 220, flex: '0 1 280px' }}>
            <span className="search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              className="input"
              placeholder="Search SKU, description, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Type pills */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {ITEM_TYPES.map((t) => (
              <button
                key={t}
                className={`filter-pill ${typeFilter === t ? 'active' : ''}`}
                onClick={() => setTypeFilter(typeFilter === t ? null : t)}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Status pills */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {STATUSES.map((s) => (
              <button
                key={s}
                className={`filter-pill ${statusFilter === s ? 'active' : ''}`}
                onClick={() => setStatusFilter(statusFilter === s ? null : s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="toolbar-actions">
          {(search || typeFilter || statusFilter) && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setSearch(''); setTypeFilter(null); setStatusFilter(null); }}
            >
              Clear
            </button>
          )}
          <div className="view-toggle">
            <button className={view === 'cards' ? 'active' : ''} onClick={() => setView('cards')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
              </svg>
            </button>
            <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Charts Row ────────────────────────── */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        {/* Pie: By Category */}
        <div className="chart-card">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px' }}>
            Items by Category
          </h3>
          <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 16px' }}>
            Distribution across material categories
          </p>
          {categoryData.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No category data</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {categoryData.map((entry, idx) => (
                    <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] || COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
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

        {/* Bar: By Type */}
        <div className="chart-card">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px' }}>
            Items by Type
          </h3>
          <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 16px' }}>
            Count of items per classification
          </p>
          {typeData.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No type data</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={typeData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <XAxis
                  dataKey="name"
                  tick={AXIS_TICK}
                  axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  allowDecimals={false}
                />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                <Bar dataKey="value" name="Count" radius={[6, 6, 0, 0]} maxBarSize={56}>
                  {typeData.map((entry, idx) => (
                    <Cell key={entry.name} fill={TYPE_COLORS[entry.name] || COLORS[idx % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Card View ─────────────────────────── */}
      {view === 'cards' && (
        filtered.length === 0 ? (
          <div className="chart-card">
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
                  <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                No items found
              </div>
              <div style={{ fontSize: 13 }}>
                {items.length === 0
                  ? 'Get started by creating your first item.'
                  : 'Try adjusting your search or filters.'}
              </div>
              {items.length === 0 && (
                <button
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: 16 }}
                  onClick={() => { setSelectedItem(null); setModalMode('create'); }}
                >
                  Create First Item
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="product-grid">
            {filtered.map((item) => {
              const sku = getField(item, 'SKU');
              const desc = getField(item, 'Description');
              const itemType = getField(item, 'Item Type');
              const category = getField(item, 'Category');
              const status = getField(item, 'Status');
              const cost = getNum(item, 'Standard Cost');
              const leadTime = getNum(item, 'Lead Time Days');

              return (
                <div
                  key={item.id}
                  className="product-card"
                  onClick={() => openDetail(item)}
                >
                  {/* Status indicator dot */}
                  <div
                    style={{
                      position: 'absolute', top: 14, right: 14,
                      width: 8, height: 8, borderRadius: '50%',
                      background: status === 'Active' ? 'var(--success)' :
                                  status === 'Obsolete' ? 'var(--danger)' :
                                  status === 'Pending Approval' ? 'var(--warning)' :
                                  'var(--text-dim)',
                      boxShadow: status === 'Active' ? '0 0 6px var(--success)' :
                                 status === 'Obsolete' ? '0 0 6px var(--danger)' : 'none',
                    }}
                    title={status || 'No status'}
                  />

                  <div className="product-sku">{sku || 'NO SKU'}</div>
                  <div className="product-name">{desc || sku || 'Untitled Item'}</div>

                  <div className="product-meta">
                    {itemType && <span className={`badge ${getBadgeClass(itemType)}`}>{itemType}</span>}
                    {category && <span className={`badge ${getBadgeClass(category)}`}>{category}</span>}
                    {status && status !== 'Active' && <StatusBadge value={status} />}
                  </div>

                  <div className="product-stats">
                    <div>
                      <div className="product-stat-value">
                        {cost > 0 ? formatCurrency(cost) : '\u2014'}
                      </div>
                      <div className="product-stat-label">Standard Cost</div>
                    </div>
                    <div>
                      <div className="product-stat-value">
                        {leadTime > 0 ? `${leadTime}d` : '\u2014'}
                      </div>
                      <div className="product-stat-label">Lead Time</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── Table View ────────────────────────── */}
      {view === 'table' && (
        filtered.length === 0 ? (
          <div className="chart-card">
            <div className="empty-state">
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                No items found
              </div>
              <div style={{ fontSize: 13 }}>
                {items.length === 0
                  ? 'Get started by creating your first item.'
                  : 'Try adjusting your search or filters.'}
              </div>
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  {tableColumns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                  <th style={{ width: 90 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => openDetail(item)}
                  >
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>
                      {getField(item, 'SKU') || '\u2014'}
                    </td>
                    <td style={{ fontWeight: 500, color: 'var(--text)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {getField(item, 'Description') || '\u2014'}
                    </td>
                    <td><StatusBadge value={getField(item, 'Item Type')} /></td>
                    <td><StatusBadge value={getField(item, 'Category')} /></td>
                    <td style={{ color: 'var(--text-muted)' }}>{getField(item, 'Unit of Measure') || '\u2014'}</td>
                    <td style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                      {getNum(item, 'Standard Cost') > 0 ? formatCurrency(getNum(item, 'Standard Cost')) : '\u2014'}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {getNum(item, 'Lead Time Days') > 0 ? `${getNum(item, 'Lead Time Days')}d` : '\u2014'}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {getNum(item, 'Safety Stock') > 0 ? getNum(item, 'Safety Stock').toLocaleString() : '\u2014'}
                    </td>
                    <td><StatusBadge value={getField(item, 'Status')} /></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => openEdit(item)}
                          title="Edit"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => { setSelectedItem(item); setModalMode('delete'); }}
                          title="Delete"
                          style={{ color: 'var(--danger)' }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Result Count ──────────────────────── */}
      {filtered.length > 0 && (
        <div style={{ textAlign: 'center', padding: '14px 0 4px', fontSize: 12, color: 'var(--text-dim)' }}>
          Showing {filtered.length} of {items.length} items
        </div>
      )}

      {/* ══════════════════════════════════════════
         MODALS
         ══════════════════════════════════════════ */}

      {/* Create Modal */}
      <Modal
        open={modalMode === 'create'}
        onClose={() => setModalMode(null)}
        title="New Item"
      >
        <RecordForm
          fields={formFields}
          onSubmit={handleCreate}
          onCancel={() => setModalMode(null)}
          submitLabel="Create Item"
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={modalMode === 'edit'}
        onClose={() => { setModalMode(null); setSelectedItem(null); }}
        title={`Edit ${getField(selectedItem || {}, 'SKU') || 'Item'}`}
      >
        {selectedItem && (
          <RecordForm
            fields={formFields}
            initialValues={selectedItem}
            onSubmit={handleUpdate}
            onCancel={() => { setModalMode(null); setSelectedItem(null); }}
            submitLabel="Save Changes"
          />
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal
        open={modalMode === 'detail'}
        onClose={() => { setModalMode(null); setSelectedItem(null); }}
        title="Item Details"
      >
        {selectedItem && (
          <div>
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: 'var(--primary)', fontWeight: 600, marginBottom: 4 }}>
                  {getField(selectedItem, 'SKU') || 'NO SKU'}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                  {getField(selectedItem, 'Description') || 'Untitled'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <StatusBadge value={getField(selectedItem, 'Status')} />
              </div>
            </div>

            {/* Meta badges */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
              {getField(selectedItem, 'Item Type') && (
                <span className={`badge ${getBadgeClass(getField(selectedItem, 'Item Type'))}`}>
                  {getField(selectedItem, 'Item Type')}
                </span>
              )}
              {getField(selectedItem, 'Category') && (
                <span className={`badge ${getBadgeClass(getField(selectedItem, 'Category'))}`}>
                  {getField(selectedItem, 'Category')}
                </span>
              )}
              {getField(selectedItem, 'Unit of Measure') && (
                <span className="tag">{getField(selectedItem, 'Unit of Measure')}</span>
              )}
            </div>

            {/* Detail grid */}
            <div className="detail-grid">
              <div>
                <div className="detail-field-label">Standard Cost</div>
                <div className="detail-field-value">
                  {getNum(selectedItem, 'Standard Cost') > 0 ? formatCurrency(getNum(selectedItem, 'Standard Cost')) : '\u2014'}
                </div>
              </div>
              <div>
                <div className="detail-field-label">Lead Time</div>
                <div className="detail-field-value">
                  {getNum(selectedItem, 'Lead Time Days') > 0 ? `${getNum(selectedItem, 'Lead Time Days')} days` : '\u2014'}
                </div>
              </div>
              <div>
                <div className="detail-field-label">Safety Stock</div>
                <div className="detail-field-value">
                  {getNum(selectedItem, 'Safety Stock') > 0 ? getNum(selectedItem, 'Safety Stock').toLocaleString() : '\u2014'}
                </div>
              </div>
              <div>
                <div className="detail-field-label">Reorder Point</div>
                <div className="detail-field-value">
                  {getNum(selectedItem, 'Reorder Point') > 0 ? getNum(selectedItem, 'Reorder Point').toLocaleString() : '\u2014'}
                </div>
              </div>
              <div>
                <div className="detail-field-label">Weight</div>
                <div className="detail-field-value">
                  {getNum(selectedItem, 'Weight') > 0 ? `${getNum(selectedItem, 'Weight')} kg` : '\u2014'}
                </div>
              </div>
              <div>
                <div className="detail-field-label">Min Order Qty</div>
                <div className="detail-field-value">
                  {getNum(selectedItem, 'Min Order Qty') > 0 ? getNum(selectedItem, 'Min Order Qty').toLocaleString() : '\u2014'}
                </div>
              </div>
              <div>
                <div className="detail-field-label">Max Order Qty</div>
                <div className="detail-field-value">
                  {getNum(selectedItem, 'Max Order Qty') > 0 ? getNum(selectedItem, 'Max Order Qty').toLocaleString() : '\u2014'}
                </div>
              </div>
              <div>
                <div className="detail-field-label">Shelf Life</div>
                <div className="detail-field-value">
                  {getNum(selectedItem, 'Shelf Life Days') > 0 ? `${getNum(selectedItem, 'Shelf Life Days')} days` : '\u2014'}
                </div>
              </div>
              <div>
                <div className="detail-field-label">Storage Conditions</div>
                <div className="detail-field-value">
                  {getField(selectedItem, 'Storage Conditions') || '\u2014'}
                </div>
              </div>
            </div>

            {/* Notes */}
            {getField(selectedItem, 'Notes') && (
              <div style={{ marginTop: 18 }}>
                <div className="detail-field-label">Notes</div>
                <div style={{
                  fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6,
                  padding: '10px 14px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-light)',
                }}>
                  {getField(selectedItem, 'Notes')}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="form-actions">
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setModalMode('delete')}
              >
                Delete
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => { setModalMode(null); setSelectedItem(null); }}
              >
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setModalMode('edit')}
              >
                Edit Item
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={modalMode === 'delete'}
        onClose={() => { setModalMode(null); setSelectedItem(null); }}
        title="Delete Item"
      >
        {selectedItem && (
          <div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 8px' }}>
              Are you sure you want to delete this item?
            </p>
            <div style={{
              padding: '12px 14px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius)',
              border: '1px solid var(--border-light)', marginBottom: 4,
            }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>
                {getField(selectedItem, 'SKU')}
              </span>
              <span style={{ margin: '0 8px', color: 'var(--text-dim)' }}>&mdash;</span>
              <span style={{ fontSize: 13, color: 'var(--text)' }}>
                {getField(selectedItem, 'Description') || 'Untitled'}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 12, marginBottom: 0 }}>
              This action cannot be undone.
            </p>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => { setModalMode(null); setSelectedItem(null); }}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={saving}>
                {saving ? (
                  <>
                    <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                    Deleting...
                  </>
                ) : 'Delete Item'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
