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
  items: Record<string, any>[];
  operations: Record<string, any>[];
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

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function ProductionOrdersClient({ orders: initialOrders, items, operations }: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [viewMode, setViewMode] = useState<'kanban' | 'table' | 'timeline'>('kanban');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<any>(null);
  const [detailRecord, setDetailRecord] = useState<any>(null);

  // ── Item lookup ────────────────────────────
  const itemMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of items) {
      if (item.id) {
        map[item.id] = item['Item Name'] || item['Name'] || item['Item Code'] || `Item ${item.id.slice(-4)}`;
      }
    }
    return map;
  }, [items]);

  const resolveItem = useCallback((order: any): string => {
    const ref = order['Item'];
    const id = Array.isArray(ref) ? ref[0] : ref;
    if (id && itemMap[id]) return itemMap[id];
    return 'Unknown Item';
  }, [itemMap]);

  // ── Manufacturing KPIs ─────────────────────
  const kpis = useMemo(() => {
    const total = orders.length;
    const completed = orders.filter(o => resolveStatus(o['Status']) === 'Completed').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // On-Time Completion: orders where Actual End <= Planned End
    let onTimeCount = 0;
    let completedWithDates = 0;
    for (const o of orders) {
      if (resolveStatus(o['Status']) !== 'Completed') continue;
      const plannedEnd = o['End Date'] || o['Planned End'];
      const actualEnd = o['Actual End'] || o['Completion Date'];
      if (plannedEnd) {
        completedWithDates++;
        if (actualEnd) {
          if (new Date(actualEnd) <= new Date(plannedEnd)) {
            onTimeCount++;
          }
        } else {
          // Completed without actual end = assume on time
          onTimeCount++;
        }
      }
    }
    const onTimeRate = completedWithDates > 0 ? Math.round((onTimeCount / completedWithDates) * 100) : (completed > 0 ? 100 : 0);

    // Average Scrap Rate from operations
    let totalOpsPlanned = 0;
    let totalOpsScrap = 0;
    for (const op of operations) {
      const planned = resolveNum(op['Planned Qty'] || op['Quantity']);
      const scrap = resolveNum(op['Scrap Qty'] || op['Scrap']);
      totalOpsPlanned += planned;
      totalOpsScrap += scrap;
    }
    // Fallback to order-level scrap if no ops data
    if (totalOpsPlanned === 0) {
      for (const o of orders) {
        totalOpsPlanned += resolveNum(o['Planned Qty']);
        totalOpsScrap += resolveNum(o['Scrap Qty']);
      }
    }
    const avgScrapRate = totalOpsPlanned > 0 ? ((totalOpsScrap / totalOpsPlanned) * 100).toFixed(1) : '0.0';

    return { total, completed, completionRate, onTimeRate, onTimeCount, completedWithDates, avgScrapRate };
  }, [orders, operations]);

  // ── Production Efficiency Score ────────────
  const efficiencyScore = useMemo(() => {
    let totalPlanned = 0;
    let totalScrap = 0;
    let completedCount = 0;

    for (const o of orders) {
      if (resolveStatus(o['Status']) !== 'Completed') continue;
      const planned = resolveNum(o['Planned Qty']);
      const scrap = resolveNum(o['Scrap Qty']);
      if (planned > 0) {
        totalPlanned += planned;
        totalScrap += scrap;
        completedCount++;
      }
    }

    const score = totalPlanned > 0 ? Math.round(((totalPlanned - totalScrap) / totalPlanned) * 100) : 0;
    return { score, completedCount, totalPlanned, totalScrap };
  }, [orders]);

  // ── Gantt Timeline Data ────────────────────
  const ganttData = useMemo(() => {
    const ordersWithDates = orders
      .filter(o => o['Start Date'] && o['End Date'])
      .map(o => ({
        id: o.id,
        woNumber: String(o['WO Number'] || 'WO'),
        item: resolveItem(o),
        startDate: new Date(o['Start Date']),
        endDate: new Date(o['End Date']),
        status: resolveStatus(o['Status']),
        raw: o,
      }))
      .filter(o => !isNaN(o.startDate.getTime()) && !isNaN(o.endDate.getTime()))
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    if (ordersWithDates.length === 0) return { orders: [], minDate: new Date(), maxDate: new Date(), totalDays: 0 };

    const minDate = new Date(Math.min(...ordersWithDates.map(o => o.startDate.getTime())));
    const maxDate = new Date(Math.max(...ordersWithDates.map(o => o.endDate.getTime())));
    const totalDays = Math.max(Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)), 1);

    return { orders: ordersWithDates, minDate, maxDate, totalDays };
  }, [orders, resolveItem]);

  // ── Chart: Production by Status (pie) ──────
  const statusDist = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of orders) {
      const s = resolveStatus(o['Status']);
      counts[s] = (counts[s] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [orders]);

  // ── Chart: Planned vs Actual (completed orders) ──
  const plannedVsActual = useMemo(() => {
    return orders
      .filter(o => resolveStatus(o['Status']) === 'Completed' && resolveNum(o['Planned Qty']) > 0)
      .map(o => {
        const wo = String(o['WO Number'] || 'WO');
        const label = wo.length > 12 ? wo.slice(0, 10) + '..' : wo;
        return {
          name: label,
          Planned: resolveNum(o['Planned Qty']),
          Actual: resolveNum(o['Completed Qty']),
          Scrap: resolveNum(o['Scrap Qty']),
        };
      })
      .slice(0, 10);
  }, [orders]);

  // ── Filtered orders ────────────────────────
  const filteredOrders = useMemo(() => {
    if (!search) return orders;
    const q = search.toLowerCase();
    return orders.filter(o => {
      const wo = String(o['WO Number'] ?? '').toLowerCase();
      const item = resolveItem(o).toLowerCase();
      return wo.includes(q) || item.includes(q);
    });
  }, [orders, search, resolveItem]);

  // ── Kanban columns ─────────────────────────
  const kanbanColumns = useMemo(() => {
    return KANBAN_STATUSES.map(status => ({
      status,
      color: KANBAN_COLORS[status],
      cards: filteredOrders.filter(o => resolveStatus(o['Status']) === status),
    }));
  }, [filteredOrders]);

  // ── CRUD handlers ──────────────────────────
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

  // ── Generate date labels for Gantt x-axis ──
  const ganttDateLabels = useMemo(() => {
    if (ganttData.totalDays === 0) return [];
    const labels: { date: Date; label: string; pct: number }[] = [];
    const stepDays = Math.max(Math.ceil(ganttData.totalDays / 8), 1);
    for (let i = 0; i <= ganttData.totalDays; i += stepDays) {
      const date = new Date(ganttData.minDate.getTime() + i * 24 * 60 * 60 * 1000);
      labels.push({
        date,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        pct: (i / ganttData.totalDays) * 100,
      });
    }
    return labels;
  }, [ganttData]);

  return (
    <div>
      {/* ── Header ───────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Production Orders</h1>
          <p className="page-subtitle">Manufacturing dashboard &mdash; work order tracking and analytics</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Work Order
          </button>
        </div>
      </div>

      {/* ── Manufacturing KPIs ────────────────────── */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Orders</div>
          <div className="kpi-value" style={{ color: '#6366f1' }}>{kpis.total}</div>
          <div className="kpi-trend neutral">{filteredOrders.length} shown</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Completion Rate</div>
          <div className="kpi-value" style={{ color: '#10b981' }}>{kpis.completionRate}%</div>
          <div className="kpi-trend neutral">{kpis.completed} of {kpis.total} completed</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">On-Time Completion</div>
          <div className="kpi-value" style={{ color: kpis.onTimeRate >= 80 ? '#10b981' : kpis.onTimeRate >= 60 ? '#f59e0b' : '#ef4444' }}>
            {kpis.onTimeRate}%
          </div>
          <div className="kpi-trend neutral">
            {kpis.completedWithDates > 0 ? `${kpis.onTimeCount} of ${kpis.completedWithDates} on time` : 'No date data'}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Average Scrap Rate</div>
          <div className="kpi-value" style={{ color: resolveNum(kpis.avgScrapRate) > 5 ? '#ef4444' : '#f59e0b' }}>
            {kpis.avgScrapRate}%
          </div>
          <div className="kpi-trend neutral">across {operations.length > 0 ? 'operations' : 'orders'}</div>
        </div>
      </div>

      {/* ── Production Efficiency Score ────────────── */}
      <div className="glass-card" style={{ padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Production Efficiency Score</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
              (Planned Qty - Scrap Qty) / Planned Qty for completed orders
            </div>
          </div>
          <div style={{
            fontSize: 28, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace",
            color: efficiencyScore.score >= 90 ? '#10b981' : efficiencyScore.score >= 70 ? '#f59e0b' : '#ef4444',
          }}>
            {efficiencyScore.score}%
          </div>
        </div>
        <div className="progress-bar" style={{ height: 10 }}>
          <div
            className={`progress-bar-fill ${efficiencyScore.score >= 90 ? 'green' : efficiencyScore.score >= 70 ? 'yellow' : 'red'}`}
            style={{ width: `${Math.min(efficiencyScore.score, 100)}%` }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
          <span>{efficiencyScore.completedCount} completed orders</span>
          <span>Planned: {efficiencyScore.totalPlanned.toLocaleString()} | Scrap: {efficiencyScore.totalScrap.toLocaleString()}</span>
        </div>
      </div>

      {/* ── Toolbar: view toggle + search ──────────── */}
      <div className="toolbar">
        <div className="toolbar-actions">
          <div className="view-toggle">
            <button className={viewMode === 'kanban' ? 'active' : ''} onClick={() => setViewMode('kanban')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 4 }}>
                <rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="3" width="7" height="10" rx="1" />
              </svg>
              Kanban
            </button>
            <button className={viewMode === 'timeline' ? 'active' : ''} onClick={() => setViewMode('timeline')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 4 }}>
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="18" y2="18" />
              </svg>
              Timeline
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
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

      {/* ── Gantt-style Timeline ──────────────────── */}
      {viewMode === 'timeline' && (
        <div className="glass-card" style={{ padding: '20px', marginBottom: 24, overflow: 'hidden' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '0 0 16px' }}>Production Timeline</h3>
          {ganttData.orders.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No orders with start/end dates</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 600, position: 'relative' }}>
                {/* Date axis */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, paddingLeft: 160, position: 'relative', height: 20 }}>
                  {ganttDateLabels.map((dl, i) => (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        left: `calc(160px + ${dl.pct}% * (100% - 160px) / 100)`,
                        transform: 'translateX(-50%)',
                        fontSize: 10,
                        color: 'var(--text-dim)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {dl.label}
                    </div>
                  ))}
                </div>
                {/* Grid lines */}
                <div style={{ position: 'relative', paddingLeft: 160 }}>
                  <div style={{ position: 'absolute', top: 0, left: 160, right: 0, bottom: 0, pointerEvents: 'none' }}>
                    {ganttDateLabels.map((dl, i) => (
                      <div
                        key={i}
                        style={{
                          position: 'absolute',
                          left: `${dl.pct}%`,
                          top: 0,
                          bottom: 0,
                          width: 1,
                          background: 'rgba(255,255,255,0.04)',
                        }}
                      />
                    ))}
                  </div>

                  {/* Order bars */}
                  {ganttData.orders.map((order) => {
                    const startOffset = ((order.startDate.getTime() - ganttData.minDate.getTime()) / (ganttData.totalDays * 24 * 60 * 60 * 1000)) * 100;
                    const duration = ((order.endDate.getTime() - order.startDate.getTime()) / (ganttData.totalDays * 24 * 60 * 60 * 1000)) * 100;
                    const barWidth = Math.max(duration, 1);
                    const barColor = KANBAN_COLORS[order.status] || '#64748b';

                    return (
                      <div
                        key={order.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          height: 36,
                          marginBottom: 4,
                          cursor: 'pointer',
                          position: 'relative',
                        }}
                        onClick={() => setDetailRecord(order.raw)}
                      >
                        {/* Label */}
                        <div style={{
                          width: 160,
                          position: 'absolute',
                          left: -160,
                          display: 'flex',
                          flexDirection: 'column',
                          paddingRight: 12,
                          overflow: 'hidden',
                        }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {order.woNumber}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {order.item}
                          </span>
                        </div>

                        {/* Bar container */}
                        <div style={{ flex: 1, position: 'relative', height: '100%', marginLeft: 160 }}>
                          <div
                            style={{
                              position: 'absolute',
                              left: `${startOffset}%`,
                              width: `${barWidth}%`,
                              top: 6,
                              height: 24,
                              borderRadius: 4,
                              background: barColor,
                              opacity: 0.8,
                              transition: 'opacity 200ms ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: 30,
                            }}
                            onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = '1'; }}
                            onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = '0.8'; }}
                          >
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 4px' }}>
                              {order.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', gap: 14, marginTop: 12, paddingLeft: 160, flexWrap: 'wrap' }}>
                  {KANBAN_STATUSES.map(status => (
                    <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: KANBAN_COLORS[status] }} />
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Kanban Board ──────────────────────────── */}
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

      {/* ── Table View ────────────────────────────── */}
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

      {/* ── Charts ─────────────────────────────────── */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Production by Status (pie chart) */}
        <div className="chart-card">
          <h3>Production by Status</h3>
          {statusDist.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No production orders</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={statusDist}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  stroke="none"
                >
                  {statusDist.map((entry, idx) => (
                    <Cell key={idx} fill={KANBAN_COLORS[entry.name] || COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  {...CHART_TOOLTIP}
                  formatter={(value: any, name: any) => [value, name]}
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

        {/* Planned vs Actual (bar chart for completed orders) */}
        <div className="chart-card">
          <h3>Planned vs Actual Quantities</h3>
          {plannedVsActual.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No completed orders with qty data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={plannedVsActual} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
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
                <Tooltip
                  {...CHART_TOOLTIP}
                  formatter={(value: any, name: any) => [Number(value).toLocaleString(), name]}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => (
                    <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 500 }}>{value}</span>
                  )}
                />
                <Bar dataKey="Planned" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={24} />
                <Bar dataKey="Actual" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={24} />
                <Bar dataKey="Scrap" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Create Modal ───────────────────────────── */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Work Order">
        <RecordForm fields={formFields} onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} submitLabel="Create" />
      </Modal>

      {/* ── Edit Modal ─────────────────────────────── */}
      <Modal open={!!editRecord} onClose={() => setEditRecord(null)} title="Edit Work Order">
        {editRecord && (
          <RecordForm fields={formFields} initialValues={editRecord} onSubmit={handleUpdate} onCancel={() => setEditRecord(null)} submitLabel="Update" />
        )}
      </Modal>

      {/* ── Detail Modal ───────────────────────────── */}
      <Modal open={!!detailRecord && !editRecord} onClose={() => setDetailRecord(null)} title="Work Order Details">
        {detailRecord && (() => {
          const planned = resolveNum(detailRecord['Planned Qty']);
          const completed = resolveNum(detailRecord['Completed Qty']);
          const scrap = resolveNum(detailRecord['Scrap Qty']);
          const pct = planned > 0 ? Math.round((completed / planned) * 100) : 0;

          // Find operations for this order
          const orderOps = operations.filter(op => {
            const ref = op['Production Order'] || op['Work Order'];
            const opWoId = Array.isArray(ref) ? ref[0] : ref;
            return opWoId === detailRecord.id;
          });

          return (
            <div>
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

              {orderOps.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div className="detail-field-label" style={{ marginBottom: 8 }}>Operations ({orderOps.length})</div>
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Operation</th>
                          <th>Work Center</th>
                          <th>Planned Qty</th>
                          <th>Scrap</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderOps.map((op) => (
                          <tr key={op.id}>
                            <td>{op['Operation Name'] || op['Name'] || '--'}</td>
                            <td>{op['Work Center'] || '--'}</td>
                            <td>{resolveNum(op['Planned Qty'] || op['Quantity'])}</td>
                            <td style={{ color: resolveNum(op['Scrap Qty'] || op['Scrap']) > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                              {resolveNum(op['Scrap Qty'] || op['Scrap'])}
                            </td>
                            <td><StatusBadge value={resolveStatus(op['Status'])} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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
          );
        })()}
      </Modal>
    </div>
  );
}
