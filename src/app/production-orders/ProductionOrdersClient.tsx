'use client';

import { useState, useMemo } from 'react';
import { createRecord, updateRecord, deleteRecord } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { Modal } from '@/components/Modal';
import { RecordForm } from '@/components/RecordForm';
import { StatusBadge } from '@/components/StatusBadge';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

// ── Constants ────────────────────────────────────

const GRID_STROKE = 'rgba(255,255,255,0.04)';
const AXIS_TICK = { fill: '#64748b', fontSize: 11 };
const COLORS = ['#6366f1', '#f97316', '#10b981', '#06b6d4', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6'];

const KANBAN_STATUSES = ['Planned', 'Released', 'In Progress', 'Completed', 'Cancelled'] as const;
const KANBAN_COLORS: Record<string, string> = {
  Planned: '#f59e0b',
  Released: '#3b82f6',
  'In Progress': '#6366f1',
  Completed: '#10b981',
  Cancelled: '#64748b',
};

const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Urgent'] as const;
const STATUS_OPTIONS = [...KANBAN_STATUSES] as const;

const formFields = [
  { name: 'WO Number', label: 'WO Number', type: 'text' as const, required: true },
  { name: 'Start Date', label: 'Start Date', type: 'date' as const },
  { name: 'End Date', label: 'End Date', type: 'date' as const },
  { name: 'Status', label: 'Status', type: 'select' as const, options: [...STATUS_OPTIONS] },
  { name: 'Priority', label: 'Priority', type: 'select' as const, options: [...PRIORITY_OPTIONS] },
  { name: 'Planned Qty', label: 'Planned Qty', type: 'number' as const },
  { name: 'Completed Qty', label: 'Completed Qty', type: 'number' as const },
  { name: 'Scrap Qty', label: 'Scrap Qty', type: 'number' as const },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
];

// ── Types ────────────────────────────────────────

interface Props {
  orders: Record<string, any>[];
  items: Record<string, any>[];
}

// ── Helpers ──────────────────────────────────────

function resolveStatus(val: any): string {
  if (Array.isArray(val)) return val[0] ?? 'Unknown';
  return String(val ?? 'Unknown');
}

function resolveNum(val: any): number {
  if (val == null || val === '') return 0;
  return Number(val) || 0;
}

function fmtDate(val: any): string {
  if (!val) return '\u2014';
  try {
    return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '\u2014';
  }
}

function fmtDateShort(val: any): string {
  if (!val) return '\u2014';
  try {
    return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '\u2014';
  }
}

function progressColor(pct: number): string {
  if (pct >= 80) return 'green';
  if (pct >= 40) return 'yellow';
  return 'red';
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

export function ProductionOrdersClient({ orders: initialOrders, items }: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<any>(null);
  const [detailRecord, setDetailRecord] = useState<any>(null);

  // Item lookup map
  const itemMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of items) {
      if (item.id) {
        map[item.id] = item['Item Name'] || item['Name'] || item['Item Code'] || `Item ${item.id.slice(-4)}`;
      }
    }
    return map;
  }, [items]);

  // Resolve item name from reference
  const resolveItem = (order: any): string => {
    const ref = order['Item'];
    const id = Array.isArray(ref) ? ref[0] : ref;
    if (id && itemMap[id]) return itemMap[id];
    return 'Unknown Item';
  };

  // ── KPI Calculations ──────────────────────────

  const kpis = useMemo(() => {
    const total = orders.length;
    const inProgress = orders.filter(o => resolveStatus(o['Status']) === 'In Progress').length;
    const completed = orders.filter(o => resolveStatus(o['Status']) === 'Completed').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const totalPlanned = orders.reduce((s, o) => s + resolveNum(o['Planned Qty']), 0);
    const totalScrap = orders.reduce((s, o) => s + resolveNum(o['Scrap Qty']), 0);
    const scrapRate = totalPlanned > 0 ? ((totalScrap / totalPlanned) * 100).toFixed(1) : '0.0';

    return { total, inProgress, completionRate, scrapRate };
  }, [orders]);

  // ── Filtered orders (for search) ──────────────

  const filteredOrders = useMemo(() => {
    if (!search) return orders;
    const q = search.toLowerCase();
    return orders.filter(o => {
      const wo = String(o['WO Number'] ?? '').toLowerCase();
      const item = resolveItem(o).toLowerCase();
      return wo.includes(q) || item.includes(q);
    });
  }, [orders, search, itemMap]);

  // ── Kanban columns ────────────────────────────

  const kanbanColumns = useMemo(() => {
    return KANBAN_STATUSES.map(status => ({
      status,
      color: KANBAN_COLORS[status],
      cards: filteredOrders.filter(o => resolveStatus(o['Status']) === status),
    }));
  }, [filteredOrders]);

  // ── Completion chart (horizontal bar) ─────────

  const completionChart = useMemo(() => {
    return filteredOrders
      .filter(o => resolveNum(o['Planned Qty']) > 0)
      .map(o => {
        const wo = String(o['WO Number'] || 'WO');
        const planned = resolveNum(o['Planned Qty']);
        const completed = resolveNum(o['Completed Qty']);
        const label = wo.length > 12 ? wo.slice(0, 10) + '..' : wo;
        return { name: label, fullName: wo, Completed: completed, Remaining: Math.max(0, planned - completed) };
      })
      .sort((a, b) => b.Completed - a.Completed)
      .slice(0, 10);
  }, [filteredOrders]);

  // ── Priority distribution ─────────────────────

  const priorityDist = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of orders) {
      const p = resolveStatus(o['Priority']);
      counts[p] = (counts[p] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [orders]);

  // ── CRUD handlers ─────────────────────────────

  const handleCreate = async (values: Record<string, any>) => {
    await createRecord(TABLES.PRODUCTION_ORDERS, values);
    setCreateOpen(false);
    setOrders(prev => [{ ...values, id: 'temp-' + Date.now() }, ...prev]);
  };

  const handleUpdate = async (values: Record<string, any>) => {
    if (!editRecord) return;
    await updateRecord(TABLES.PRODUCTION_ORDERS, editRecord.id, values);
    setEditRecord(null);
    setOrders(prev => prev.map(o => o.id === editRecord.id ? { ...o, ...values } : o));
  };

  const handleDelete = async (id: string) => {
    await deleteRecord(TABLES.PRODUCTION_ORDERS, id);
    setDetailRecord(null);
    setOrders(prev => prev.filter(o => o.id !== id));
  };

  // ── Render ────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Production Orders</h1>
          <p className="page-subtitle">Kanban production board and work order tracking</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            New Work Order
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Work Orders</div>
          <div className="kpi-value" style={{ marginTop: 6 }}>{kpis.total.toLocaleString()}</div>
          <div className="kpi-trend neutral">{filteredOrders.length} shown</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">In Progress</div>
          <div className="kpi-value" style={{ marginTop: 6, color: '#6366f1' }}>{kpis.inProgress}</div>
          <div className="kpi-trend neutral">active work orders</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Completion Rate</div>
          <div className="kpi-value" style={{ marginTop: 6, color: '#10b981' }}>{kpis.completionRate}%</div>
          <div className="kpi-trend neutral">orders completed</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Scrap Rate</div>
          <div className="kpi-value" style={{ marginTop: 6, color: resolveNum(kpis.scrapRate) > 5 ? '#ef4444' : '#f59e0b' }}>{kpis.scrapRate}%</div>
          <div className="kpi-trend neutral">scrap / planned qty</div>
        </div>
      </div>

      {/* Toolbar: view toggle + search */}
      <div className="toolbar">
        <div className="toolbar-actions">
          <div className="view-toggle">
            <button className={viewMode === 'kanban' ? 'active' : ''} onClick={() => setViewMode('kanban')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 4 }}>
                <rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="3" width="7" height="10" rx="1" />
              </svg>
              Kanban
            </button>
            <button className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 4 }}>
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              Table
            </button>
          </div>
        </div>
        <div className="toolbar-actions">
          <div className="search-bar">
            <span className="search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            </span>
            <input
              className="input"
              placeholder="Search WO# or item..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 220 }}
            />
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      {viewMode === 'kanban' && (
        <div className="kanban-board" style={{ marginBottom: 24 }}>
          {kanbanColumns.map(({ status, color, cards }) => (
            <div key={status} className="kanban-column">
              <div className="kanban-column-header" style={{ borderBottomColor: color }}>
                <span>{status}</span>
                <span className="kanban-column-count">{cards.length}</span>
              </div>
              <div className="kanban-cards">
                {cards.length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>
                    No orders
                  </div>
                ) : (
                  cards.map(order => {
                    const planned = resolveNum(order['Planned Qty']);
                    const completed = resolveNum(order['Completed Qty']);
                    const pct = planned > 0 ? Math.round((completed / planned) * 100) : 0;
                    const priority = resolveStatus(order['Priority']);

                    return (
                      <div key={order.id} className="kanban-card" onClick={() => setDetailRecord(order)}>
                        <div className="card-id">{order['WO Number'] || '\u2014'}</div>
                        <div className="card-title">{resolveItem(order)}</div>

                        {/* Progress bar */}
                        {planned > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-dim)', marginBottom: 3 }}>
                              <span>{completed} / {planned}</span>
                              <span>{pct}%</span>
                            </div>
                            <div className="progress-bar">
                              <div className={`progress-bar-fill ${progressColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                          </div>
                        )}

                        <div className="card-footer">
                          <StatusBadge value={priority} />
                          <span>{fmtDateShort(order['Start Date'])}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="table-container" style={{ marginBottom: 24 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>WO Number</th>
                <th>Item</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Planned</th>
                <th>Completed</th>
                <th>Scrap</th>
                <th>Progress</th>
                <th>Priority</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <div className="empty-state" style={{ padding: 24 }}>No production orders found</div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const planned = resolveNum(order['Planned Qty']);
                  const completed = resolveNum(order['Completed Qty']);
                  const scrap = resolveNum(order['Scrap Qty']);
                  const pct = planned > 0 ? Math.round((completed / planned) * 100) : 0;

                  return (
                    <tr key={order.id} onClick={() => setDetailRecord(order)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 600, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                        {order['WO Number'] || '\u2014'}
                      </td>
                      <td style={{ fontWeight: 500, color: 'var(--text)' }}>{resolveItem(order)}</td>
                      <td>{fmtDate(order['Start Date'])}</td>
                      <td>{fmtDate(order['End Date'])}</td>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{planned}</td>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{completed}</td>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: scrap > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>{scrap}</td>
                      <td style={{ minWidth: 120 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="progress-bar" style={{ flex: 1 }}>
                            <div className={`progress-bar-fill ${progressColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', minWidth: 32 }}>{pct}%</span>
                        </div>
                      </td>
                      <td><StatusBadge value={resolveStatus(order['Priority'])} /></td>
                      <td><StatusBadge value={resolveStatus(order['Status'])} /></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Charts */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Completion Progress per WO */}
        <div className="chart-card">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px' }}>Completion Progress</h3>
          <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 16px' }}>Completed vs remaining quantity per work order</p>
          {completionChart.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No work orders with planned qty</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={completionChart} layout="horizontal" margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                <XAxis
                  dataKey="name"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={50}
                />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => (
                    <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 500 }}>{value}</span>
                  )}
                />
                <Bar dataKey="Completed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={24} />
                <Bar dataKey="Remaining" stackId="a" fill="#1e293b" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Priority Distribution */}
        <div className="chart-card">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px' }}>Orders by Priority</h3>
          <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 16px' }}>Distribution of work order priority levels</p>
          {priorityDist.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No production orders</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={priorityDist}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  stroke="none"
                >
                  {priorityDist.map((_, idx) => (
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

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Work Order">
        <RecordForm fields={formFields} onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} submitLabel="Create" />
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editRecord} onClose={() => setEditRecord(null)} title="Edit Work Order">
        {editRecord && (
          <RecordForm fields={formFields} initialValues={editRecord} onSubmit={handleUpdate} onCancel={() => setEditRecord(null)} submitLabel="Update" />
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detailRecord && !editRecord} onClose={() => setDetailRecord(null)} title="Work Order Details">
        {detailRecord && (() => {
          const planned = resolveNum(detailRecord['Planned Qty']);
          const completed = resolveNum(detailRecord['Completed Qty']);
          const scrap = resolveNum(detailRecord['Scrap Qty']);
          const pct = planned > 0 ? Math.round((completed / planned) * 100) : 0;

          return (
            <div>
              {/* Header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <span className="mono-text" style={{ fontSize: 15, fontWeight: 700 }}>{detailRecord['WO Number']}</span>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginTop: 4 }}>{resolveItem(detailRecord)}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <StatusBadge value={resolveStatus(detailRecord['Priority'])} />
                  <StatusBadge value={resolveStatus(detailRecord['Status'])} />
                </div>
              </div>

              {/* Progress */}
              {planned > 0 && (
                <div style={{ marginBottom: 20, padding: '14px 16px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Production Progress</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>{pct}%</span>
                  </div>
                  <div className="progress-bar lg">
                    <div className={`progress-bar-fill ${progressColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--text-dim)' }}>
                    <span>Completed: {completed}</span>
                    <span>Planned: {planned}</span>
                    {scrap > 0 && <span style={{ color: 'var(--danger)' }}>Scrap: {scrap}</span>}
                  </div>
                </div>
              )}

              {/* Detail grid */}
              <div className="detail-grid" style={{ marginBottom: 20 }}>
                <div>
                  <div className="detail-field-label">Start Date</div>
                  <div className="detail-field-value">{fmtDate(detailRecord['Start Date'])}</div>
                </div>
                <div>
                  <div className="detail-field-label">End Date</div>
                  <div className="detail-field-value">{fmtDate(detailRecord['End Date'])}</div>
                </div>
                <div>
                  <div className="detail-field-label">Planned Qty</div>
                  <div className="detail-field-value" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{planned}</div>
                </div>
                <div>
                  <div className="detail-field-label">Completed Qty</div>
                  <div className="detail-field-value" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#10b981' }}>{completed}</div>
                </div>
                <div>
                  <div className="detail-field-label">Scrap Qty</div>
                  <div className="detail-field-value" style={{ fontFamily: "'JetBrains Mono', monospace", color: scrap > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>{scrap}</div>
                </div>
                <div>
                  <div className="detail-field-label">Yield Rate</div>
                  <div className="detail-field-value" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {planned > 0 ? (((completed / planned) * 100).toFixed(1) + '%') : '\u2014'}
                  </div>
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
          );
        })()}
      </Modal>
    </div>
  );
}
