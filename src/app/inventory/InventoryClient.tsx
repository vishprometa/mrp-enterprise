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
  inventory: Record<string, any>[];
  items: Record<string, any>[];
  warehouses: Record<string, any>[];
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

const formFields = [
  { name: 'Qty On Hand', label: 'Qty On Hand', type: 'number' as const, required: true },
  { name: 'Qty Reserved', label: 'Qty Reserved', type: 'number' as const },
  { name: 'Qty Available', label: 'Qty Available', type: 'number' as const },
  { name: 'Lot Number', label: 'Lot Number', type: 'text' as const },
  { name: 'Expiry Date', label: 'Expiry Date', type: 'date' as const },
  { name: 'Last Count Date', label: 'Last Count Date', type: 'date' as const },
  { name: 'Bin Location', label: 'Bin Location', type: 'text' as const },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
];

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function InventoryClient({ inventory: initialInventory, items, warehouses }: Props) {
  const [inventory, setInventory] = useState(initialInventory);
  const [search, setSearch] = useState('');
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view' | 'delete' | null>(null);
  const [selected, setSelected] = useState<Record<string, any> | null>(null);

  // ── Lookup maps ──────────────────────────────
  const itemMap = useMemo(() => {
    const m: Record<string, { name: string; sku: string; safetyStock: number }> = {};
    for (const it of items) {
      if (it.id) {
        m[it.id] = {
          name: it['Item Name'] || it['Name'] || `Item ${it.id.slice(-4)}`,
          sku: it['SKU'] || it['Item Code'] || '',
          safetyStock: Number(it['Safety Stock'] ?? it['Reorder Point'] ?? 0),
        };
      }
    }
    return m;
  }, [items]);

  const warehouseMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const w of warehouses) {
      if (w.id) {
        m[w.id] = w['Warehouse Name'] || w['Name'] || `WH-${w.id.slice(-4)}`;
      }
    }
    return m;
  }, [warehouses]);

  // ── Resolve helpers ──────────────────────────
  const resolveItem = useCallback((inv: Record<string, any>) => {
    const ref = inv['Item'];
    const id = Array.isArray(ref) ? ref[0] : ref;
    return id ? itemMap[id] : null;
  }, [itemMap]);

  const resolveWarehouse = useCallback((inv: Record<string, any>) => {
    const ref = inv['Warehouse'];
    const id = Array.isArray(ref) ? ref[0] : ref;
    return id ? warehouseMap[id] : null;
  }, [warehouseMap]);

  // ── KPI calculations ─────────────────────────
  const kpis = useMemo(() => {
    let totalOnHand = 0;
    let totalReserved = 0;
    let lowStockCount = 0;
    const warehouseIds = new Set<string>();

    for (const inv of inventory) {
      totalOnHand += Number(inv['Qty On Hand'] ?? 0);
      totalReserved += Number(inv['Qty Reserved'] ?? 0);
      const available = Number(inv['Qty Available'] ?? 0);
      const item = resolveItem(inv);
      if (item && item.safetyStock > 0 && available < item.safetyStock) {
        lowStockCount++;
      }
      const whRef = inv['Warehouse'];
      const whId = Array.isArray(whRef) ? whRef[0] : whRef;
      if (whId) warehouseIds.add(whId);
    }

    return { totalOnHand, totalReserved, lowStockCount, uniqueWarehouses: warehouseIds.size };
  }, [inventory, resolveItem]);

  // ── Stock health data ────────────────────────
  const stockHealth = useMemo(() => {
    return inventory
      .map((inv) => {
        const item = resolveItem(inv);
        const qtyOnHand = Number(inv['Qty On Hand'] ?? 0);
        const qtyReserved = Number(inv['Qty Reserved'] ?? 0);
        const qtyAvailable = Number(inv['Qty Available'] ?? qtyOnHand - qtyReserved);
        const safetyStock = item?.safetyStock ?? 0;
        const ratio = safetyStock > 0 ? qtyAvailable / safetyStock : (qtyAvailable > 0 ? 999 : 0);
        const health: 'green' | 'yellow' | 'red' = ratio >= 2 ? 'green' : ratio >= 1 ? 'yellow' : 'red';
        const pct = safetyStock > 0 ? Math.min(100, (qtyAvailable / (safetyStock * 3)) * 100) : (qtyAvailable > 0 ? 100 : 0);

        return {
          id: inv.id,
          sku: item?.sku || 'N/A',
          name: item?.name || 'Unknown Item',
          qtyOnHand,
          qtyReserved,
          qtyAvailable,
          safetyStock,
          ratio,
          health,
          pct,
        };
      })
      .sort((a, b) => a.ratio - b.ratio);
  }, [inventory, resolveItem]);

  // ── Chart: Top 10 by Qty On Hand ─────────────
  const barChartData = useMemo(() => {
    return inventory
      .map((inv) => {
        const item = resolveItem(inv);
        const qty = Number(inv['Qty On Hand'] ?? 0);
        const name = item?.name || 'Unknown';
        return { name: name.length > 14 ? name.slice(0, 12) + '..' : name, fullName: name, qty };
      })
      .filter((d) => d.qty > 0)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [inventory, resolveItem]);

  // ── Chart: Distribution by Warehouse ─────────
  const pieChartData = useMemo(() => {
    const whTotals: Record<string, number> = {};
    for (const inv of inventory) {
      const whName = resolveWarehouse(inv) || 'Unassigned';
      whTotals[whName] = (whTotals[whName] || 0) + Number(inv['Qty On Hand'] ?? 0);
    }
    return Object.entries(whTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [inventory, resolveWarehouse]);

  // ── Alert items ──────────────────────────────
  const alerts = useMemo(() => {
    return stockHealth
      .filter((s) => s.safetyStock > 0 && s.qtyAvailable < s.safetyStock * 2)
      .map((s) => ({
        ...s,
        severity: s.qtyAvailable < s.safetyStock ? 'critical' as const : 'warning' as const,
      }));
  }, [stockHealth]);

  // ── Filtered records ─────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return inventory;
    const q = search.toLowerCase();
    return inventory.filter((inv) => {
      const item = resolveItem(inv);
      const wh = resolveWarehouse(inv);
      return (
        (item?.name || '').toLowerCase().includes(q) ||
        (item?.sku || '').toLowerCase().includes(q) ||
        (wh || '').toLowerCase().includes(q) ||
        (inv['Lot Number'] || '').toLowerCase().includes(q) ||
        (inv['Bin Location'] || '').toLowerCase().includes(q)
      );
    });
  }, [inventory, search, resolveItem, resolveWarehouse]);

  // ── CRUD handlers ────────────────────────────
  const handleCreate = async (values: Record<string, any>) => {
    await createRecord(TABLES.INVENTORY, values);
    setModalMode(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleUpdate = async (values: Record<string, any>) => {
    if (!selected) return;
    await updateRecord(TABLES.INVENTORY, selected.id, values);
    setModalMode(null);
    setSelected(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleDelete = async () => {
    if (!selected) return;
    await deleteRecord(TABLES.INVENTORY, selected.id);
    setInventory((prev) => prev.filter((r) => r.id !== selected.id));
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

  return (
    <div>
      {/* ── Header ───────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">Stock level dashboard &mdash; real-time inventory health monitoring</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setSelected(null); setModalMode('create'); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Record
        </button>
      </div>

      {/* ── KPI Row ──────────────────────────────── */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Qty On Hand</div>
          <div className="kpi-value" style={{ color: '#6366f1' }}>{kpis.totalOnHand.toLocaleString()}</div>
          <div className="kpi-trend neutral">{inventory.length} stock records</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Reserved</div>
          <div className="kpi-value" style={{ color: '#f59e0b' }}>{kpis.totalReserved.toLocaleString()}</div>
          <div className="kpi-trend neutral">
            {kpis.totalOnHand > 0 ? ((kpis.totalReserved / kpis.totalOnHand) * 100).toFixed(1) : 0}% of stock
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Low Stock Alerts</div>
          <div className="kpi-value" style={{ color: kpis.lowStockCount > 0 ? '#ef4444' : '#10b981' }}>
            {kpis.lowStockCount}
          </div>
          <div className={`kpi-trend ${kpis.lowStockCount > 0 ? 'down' : 'up'}`}>
            {kpis.lowStockCount > 0 ? 'Below safety stock' : 'All stocks healthy'}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Active Warehouses</div>
          <div className="kpi-value" style={{ color: '#06b6d4' }}>{kpis.uniqueWarehouses}</div>
          <div className="kpi-trend neutral">{warehouses.length} total configured</div>
        </div>
      </div>

      {/* ── Stock Health Bars ────────────────────── */}
      {stockHealth.length > 0 && (
        <div className="glass-card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Stock Health Monitor</h3>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '2px 0 0' }}>
                Inventory levels relative to safety stock thresholds
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#10b981', display: 'inline-block' }} /> Healthy
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#f59e0b', display: 'inline-block' }} /> Caution
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444', display: 'inline-block' }} /> Critical
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stockHealth.slice(0, 12).map((item) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 80, flexShrink: 0 }}>
                  <span className="mono-text" style={{ fontSize: 10 }}>{item.sku || 'N/A'}</span>
                </div>
                <div style={{ width: 140, flexShrink: 0, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="progress-bar lg">
                    <div
                      className={`progress-bar-fill ${item.health}`}
                      style={{ width: `${Math.max(2, item.pct)}%` }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, flexShrink: 0, fontSize: 11, color: 'var(--text-muted)', minWidth: 220 }}>
                  <span>OH: <strong style={{ color: 'var(--text)' }}>{item.qtyOnHand}</strong></span>
                  <span>Rsv: <strong style={{ color: '#f59e0b' }}>{item.qtyReserved}</strong></span>
                  <span>Avl: <strong style={{ color: item.health === 'red' ? '#ef4444' : item.health === 'yellow' ? '#f59e0b' : '#10b981' }}>{item.qtyAvailable}</strong></span>
                  <span>SS: <strong style={{ color: 'var(--text-dim)' }}>{item.safetyStock}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Charts ───────────────────────────────── */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="chart-card">
          <h3>Top 10 Items by Qty On Hand</h3>
          {barChartData.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No inventory data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barChartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
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
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={50} />
                <Tooltip
                  {...CHART_TOOLTIP}
                  cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                  formatter={(value: any) => [Number(value).toLocaleString(), 'Qty On Hand']}
                />
                <Bar dataKey="qty" name="Qty On Hand" radius={[4, 4, 0, 0]} maxBarSize={36}>
                  {barChartData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="chart-card">
          <h3>Distribution by Warehouse</h3>
          {pieChartData.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No warehouse data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {pieChartData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  {...CHART_TOOLTIP}
                  formatter={(value: any) => [Number(value).toLocaleString(), 'Qty On Hand']}
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

      {/* ── Alerts ───────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="glass-card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '0 0 12px' }}>
            Reorder Alerts
            <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: '#ef4444' }}>
              {alerts.filter((a) => a.severity === 'critical').length} critical
            </span>
          </h3>
          <div className="alert-list">
            {alerts.slice(0, 8).map((a) => (
              <div key={a.id} className={`alert-item ${a.severity}`}>
                <div className={`alert-dot ${a.severity === 'critical' ? 'red' : 'yellow'}`} />
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--text)', marginRight: 8 }}>{a.name}</span>
                    <span className="mono-text" style={{ fontSize: 10 }}>{a.sku}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                    <span>Available: <strong style={{ color: a.severity === 'critical' ? '#ef4444' : '#f59e0b' }}>{a.qtyAvailable}</strong></span>
                    <span>Safety Stock: <strong style={{ color: 'var(--text-dim)' }}>{a.safetyStock}</strong></span>
                    <span className={`badge ${a.severity === 'critical' ? 'badge-danger' : 'badge-draft'}`}>
                      {a.severity === 'critical' ? 'Critical' : 'Warning'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Data Table ───────────────────────────── */}
      <div className="glass-card">
        <div className="toolbar">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            All Inventory Records
            <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: 'var(--text-dim)' }}>
              ({filtered.length})
            </span>
          </h3>
          <div className="search-bar">
            <span className="search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
            </span>
            <input
              className="input"
              placeholder="Search items, SKUs, warehouses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 280 }}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity={0.3}>
                <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
                <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
              </svg>
            </div>
            {search ? 'No records match your search' : 'No inventory records yet'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>SKU</th>
                  <th>Warehouse</th>
                  <th style={{ textAlign: 'right' }}>Qty On Hand</th>
                  <th style={{ textAlign: 'right' }}>Reserved</th>
                  <th style={{ textAlign: 'right' }}>Available</th>
                  <th>Lot Number</th>
                  <th>Bin</th>
                  <th>Expiry</th>
                  <th style={{ width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const item = resolveItem(inv);
                  const wh = resolveWarehouse(inv);
                  const available = Number(inv['Qty Available'] ?? 0);
                  const safety = item?.safetyStock ?? 0;
                  const isLow = safety > 0 && available < safety;

                  return (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text)' }}>{item?.name || 'Unknown'}</td>
                      <td><span className="mono-text">{item?.sku || '--'}</span></td>
                      <td style={{ color: 'var(--text-secondary)' }}>{wh || '--'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                        {Number(inv['Qty On Hand'] ?? 0).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#f59e0b' }}>
                        {Number(inv['Qty Reserved'] ?? 0).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: isLow ? '#ef4444' : '#10b981' }}>
                        {available.toLocaleString()}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{inv['Lot Number'] || '--'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{inv['Bin Location'] || '--'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {inv['Expiry Date'] ? new Date(inv['Expiry Date']).toLocaleDateString() : '--'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openView(inv)} title="View">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(inv)} title="Edit">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => openDelete(inv)} title="Delete" style={{ color: 'var(--danger)' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create Modal ─────────────────────────── */}
      <Modal open={modalMode === 'create'} onClose={() => setModalMode(null)} title="Add Inventory Record">
        <RecordForm fields={formFields} onSubmit={handleCreate} onCancel={() => setModalMode(null)} submitLabel="Create" />
      </Modal>

      {/* ── Edit Modal ───────────────────────────── */}
      <Modal open={modalMode === 'edit'} onClose={() => { setModalMode(null); setSelected(null); }} title="Edit Inventory Record">
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
      <Modal open={modalMode === 'view'} onClose={() => { setModalMode(null); setSelected(null); }} title="Inventory Detail">
        {selected && (
          <div className="detail-grid">
            <div>
              <div className="detail-field-label">Item</div>
              <div className="detail-field-value">{resolveItem(selected)?.name || 'Unknown'}</div>
            </div>
            <div>
              <div className="detail-field-label">Warehouse</div>
              <div className="detail-field-value">{resolveWarehouse(selected) || '--'}</div>
            </div>
            <div>
              <div className="detail-field-label">Qty On Hand</div>
              <div className="detail-field-value">{Number(selected['Qty On Hand'] ?? 0).toLocaleString()}</div>
            </div>
            <div>
              <div className="detail-field-label">Qty Reserved</div>
              <div className="detail-field-value">{Number(selected['Qty Reserved'] ?? 0).toLocaleString()}</div>
            </div>
            <div>
              <div className="detail-field-label">Qty Available</div>
              <div className="detail-field-value">{Number(selected['Qty Available'] ?? 0).toLocaleString()}</div>
            </div>
            <div>
              <div className="detail-field-label">Lot Number</div>
              <div className="detail-field-value">{selected['Lot Number'] || '--'}</div>
            </div>
            <div>
              <div className="detail-field-label">Expiry Date</div>
              <div className="detail-field-value">
                {selected['Expiry Date'] ? new Date(selected['Expiry Date']).toLocaleDateString() : '--'}
              </div>
            </div>
            <div>
              <div className="detail-field-label">Last Count Date</div>
              <div className="detail-field-value">
                {selected['Last Count Date'] ? new Date(selected['Last Count Date']).toLocaleDateString() : '--'}
              </div>
            </div>
            <div>
              <div className="detail-field-label">Bin Location</div>
              <div className="detail-field-value">{selected['Bin Location'] || '--'}</div>
            </div>
            <div>
              <div className="detail-field-label">Notes</div>
              <div className="detail-field-value">{selected['Notes'] || '--'}</div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete Confirmation ──────────────────── */}
      <Modal open={modalMode === 'delete'} onClose={() => { setModalMode(null); setSelected(null); }} title="Delete Record">
        {selected && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Are you sure you want to delete the inventory record for{' '}
              <strong style={{ color: 'var(--text)' }}>{resolveItem(selected)?.name || 'this item'}</strong>?
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
