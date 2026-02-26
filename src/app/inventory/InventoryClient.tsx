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

/* ================================================================
   Types
   ================================================================ */

interface Props {
  inventory: Record<string, any>[];
  items: Record<string, any>[];
  warehouses: Record<string, any>[];
}

type AgingStatus = 'fresh' | 'normal' | 'aging';

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

const AGING_CONFIG: Record<AgingStatus, { label: string; color: string; bg: string }> = {
  fresh: { label: 'Fresh', color: '#10b981', bg: '#10b98118' },
  normal: { label: 'Normal', color: '#06b6d4', bg: '#06b6d418' },
  aging: { label: 'Aging', color: '#f59e0b', bg: '#f59e0b18' },
};

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

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 });
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
        {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
      </div>
    </div>
  );
}

/* ================================================================
   Component
   ================================================================ */

export function InventoryClient({ inventory: initialInventory, items, warehouses }: Props) {
  const [inventory, setInventory] = useState(initialInventory);
  const [search, setSearch] = useState('');
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view' | 'delete' | null>(null);
  const [selected, setSelected] = useState<Record<string, any> | null>(null);

  /* -- Lookup maps ------------------------------------------------ */
  const itemMap = useMemo(() => {
    const m: Record<string, { name: string; sku: string; safetyStock: number; reorderPoint: number; cost: number }> = {};
    for (const it of items) {
      if (it.id) {
        m[it.id] = {
          name: it['Item Name'] || it['Name'] || it['Description'] || `Item ${it.id.slice(-4)}`,
          sku: it['SKU'] || it['Item Code'] || '',
          safetyStock: Number(it['Safety Stock'] ?? 0),
          reorderPoint: Number(it['Reorder Point'] ?? it['Safety Stock'] ?? 0),
          cost: Number(it['Standard Cost'] ?? 0),
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

  /* -- Resolve helpers -------------------------------------------- */
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

  const resolveWarehouseId = useCallback((inv: Record<string, any>): string | null => {
    const ref = inv['Warehouse'];
    return Array.isArray(ref) ? ref[0] : ref || null;
  }, []);

  /* -- Enriched inventory with computed fields -------------------- */
  const enrichedInventory = useMemo(() => {
    return inventory.map((inv) => {
      const item = resolveItem(inv);
      const qtyOnHand = Number(inv['Qty On Hand'] ?? 0);
      const qtyReserved = Number(inv['Qty Reserved'] ?? 0);
      const qtyAvailable = Number(inv['Qty Available'] ?? qtyOnHand - qtyReserved);
      const safetyStock = item?.safetyStock ?? 0;
      const reorderPoint = item?.reorderPoint ?? safetyStock;
      const cost = item?.cost ?? 0;

      // Stock health ratio
      const ratio = reorderPoint > 0 ? qtyAvailable / reorderPoint : (qtyAvailable > 0 ? 999 : 0);
      const health: 'green' | 'yellow' | 'red' = ratio >= 2 ? 'green' : ratio >= 1 ? 'yellow' : 'red';
      const pct = reorderPoint > 0 ? Math.min(100, (qtyAvailable / (reorderPoint * 3)) * 100) : (qtyAvailable > 0 ? 100 : 0);

      // Inventory Turnover proxy: cost / qty on hand
      const turnoverRatio = qtyOnHand > 0 ? cost / qtyOnHand : 0;

      // Aging indicator
      let aging: AgingStatus;
      if (reorderPoint > 0 && qtyOnHand > 1.5 * reorderPoint) aging = 'fresh';
      else if (reorderPoint > 0 && qtyOnHand < reorderPoint * 0.5) aging = 'aging';
      else aging = 'normal';

      // Inventory value
      const inventoryValue = cost * qtyOnHand;

      // Is below reorder point?
      const belowReorder = reorderPoint > 0 && qtyAvailable < reorderPoint;

      return {
        raw: inv,
        id: inv.id,
        sku: item?.sku || 'N/A',
        name: item?.name || 'Unknown Item',
        qtyOnHand,
        qtyReserved,
        qtyAvailable,
        safetyStock,
        reorderPoint,
        cost,
        ratio,
        health,
        pct,
        turnoverRatio: Math.round(turnoverRatio * 100) / 100,
        aging,
        inventoryValue,
        belowReorder,
      };
    }).sort((a, b) => a.ratio - b.ratio);
  }, [inventory, resolveItem]);

  /* -- KPI calculations ------------------------------------------- */
  const kpis = useMemo(() => {
    let totalOnHand = 0;
    let totalReserved = 0;
    let lowStockCount = 0;
    let totalTurnover = 0;
    let turnoverCount = 0;
    let valueAtRisk = 0;
    const warehouseIds = new Set<string>();

    for (const ei of enrichedInventory) {
      totalOnHand += ei.qtyOnHand;
      totalReserved += ei.qtyReserved;
      if (ei.belowReorder) lowStockCount++;
      if (ei.turnoverRatio > 0) {
        totalTurnover += ei.turnoverRatio;
        turnoverCount++;
      }
      if (ei.belowReorder) {
        valueAtRisk += ei.inventoryValue;
      }
      const whId = resolveWarehouseId(ei.raw);
      if (whId) warehouseIds.add(whId);
    }

    const avgTurnover = turnoverCount > 0 ? Math.round((totalTurnover / turnoverCount) * 100) / 100 : 0;
    return { totalOnHand, totalReserved, lowStockCount, uniqueWarehouses: warehouseIds.size, avgTurnover, valueAtRisk };
  }, [enrichedInventory, resolveWarehouseId]);

  /* -- Chart: Inventory Value by Warehouse (bar) ------------------ */
  const valueByWarehouseData = useMemo(() => {
    const sums: Record<string, number> = {};
    for (const ei of enrichedInventory) {
      const whName = resolveWarehouse(ei.raw) || 'Unassigned';
      sums[whName] = (sums[whName] || 0) + ei.inventoryValue;
    }
    return Object.entries(sums)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [enrichedInventory, resolveWarehouse]);

  /* -- Chart: Stock Level Distribution (histogram-style) ---------- */
  const stockDistData = useMemo(() => {
    const buckets: Record<string, number> = { '0': 0, '1-50': 0, '51-200': 0, '201-500': 0, '501-1000': 0, '1000+': 0 };
    for (const ei of enrichedInventory) {
      const q = ei.qtyOnHand;
      if (q === 0) buckets['0']++;
      else if (q <= 50) buckets['1-50']++;
      else if (q <= 200) buckets['51-200']++;
      else if (q <= 500) buckets['201-500']++;
      else if (q <= 1000) buckets['501-1000']++;
      else buckets['1000+']++;
    }
    return Object.entries(buckets)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [enrichedInventory]);

  /* -- Chart: Inventory Health pie (Fresh/Normal/Aging) ----------- */
  const agingChartData = useMemo(() => {
    const counts: Record<AgingStatus, number> = { fresh: 0, normal: 0, aging: 0 };
    for (const ei of enrichedInventory) counts[ei.aging]++;
    return [
      { name: 'Fresh', value: counts.fresh, fill: '#10b981' },
      { name: 'Normal', value: counts.normal, fill: '#06b6d4' },
      { name: 'Aging', value: counts.aging, fill: '#f59e0b' },
    ].filter((d) => d.value > 0);
  }, [enrichedInventory]);

  /* -- Warehouse Utilization Heatmap data ------------------------- */
  const warehouseHeatmap = useMemo(() => {
    const whData: Record<string, { name: string; qty: number; value: number; count: number }> = {};
    for (const ei of enrichedInventory) {
      const whName = resolveWarehouse(ei.raw) || 'Unassigned';
      if (!whData[whName]) whData[whName] = { name: whName, qty: 0, value: 0, count: 0 };
      whData[whName].qty += ei.qtyOnHand;
      whData[whName].value += ei.inventoryValue;
      whData[whName].count++;
    }
    return Object.values(whData).sort((a, b) => b.value - a.value);
  }, [enrichedInventory, resolveWarehouse]);

  /* -- Alerts ----------------------------------------------------- */
  const alerts = useMemo(() => {
    return enrichedInventory
      .filter((ei) => ei.reorderPoint > 0 && ei.qtyAvailable < ei.reorderPoint * 2)
      .map((ei) => ({
        ...ei,
        severity: ei.qtyAvailable < ei.reorderPoint ? 'critical' as const : 'warning' as const,
      }));
  }, [enrichedInventory]);

  /* -- Filtered records ------------------------------------------- */
  const filtered = useMemo(() => {
    if (!search.trim()) return enrichedInventory;
    const q = search.toLowerCase();
    return enrichedInventory.filter((ei) => {
      const wh = resolveWarehouse(ei.raw);
      return (
        ei.name.toLowerCase().includes(q) ||
        ei.sku.toLowerCase().includes(q) ||
        (wh || '').toLowerCase().includes(q) ||
        (ei.raw['Lot Number'] || '').toLowerCase().includes(q) ||
        (ei.raw['Bin Location'] || '').toLowerCase().includes(q)
      );
    });
  }, [enrichedInventory, search, resolveWarehouse]);

  /* -- CRUD handlers ---------------------------------------------- */
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

  /* ================================================================
     Render
     ================================================================ */

  return (
    <div>
      {/* -- Header ------------------------------------------------ */}
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

      {/* -- KPI Row ----------------------------------------------- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 24 }}>
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
            {kpis.lowStockCount > 0 ? 'Below reorder point' : 'All stocks healthy'}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Active Warehouses</div>
          <div className="kpi-value" style={{ color: '#06b6d4' }}>{kpis.uniqueWarehouses}</div>
          <div className="kpi-trend neutral">{warehouses.length} total configured</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Avg Turnover Ratio</div>
          <div className="kpi-value" style={{ color: '#a855f7' }}>{kpis.avgTurnover.toFixed(2)}</div>
          <div className="kpi-trend neutral">cost / qty proxy</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Value at Risk</div>
          <div className="kpi-value" style={{ color: kpis.valueAtRisk > 0 ? '#ef4444' : '#10b981', fontSize: kpis.valueAtRisk > 99999 ? 20 : undefined }}>
            {formatCurrency(kpis.valueAtRisk)}
          </div>
          <div className="kpi-trend neutral">below reorder point</div>
        </div>
      </div>

      {/* -- Stock Health Bars ------------------------------------- */}
      {enrichedInventory.length > 0 && (
        <div className="glass-card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Stock Health Monitor</h3>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '2px 0 0' }}>
                Inventory levels relative to reorder point thresholds
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
            {enrichedInventory.slice(0, 12).map((ei) => (
              <div key={ei.id} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 80, flexShrink: 0 }}>
                  <span className="mono-text" style={{ fontSize: 10 }}>{ei.sku || 'N/A'}</span>
                </div>
                <div style={{ width: 140, flexShrink: 0, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ei.name}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="progress-bar lg">
                    <div
                      className={`progress-bar-fill ${ei.health}`}
                      style={{ width: `${Math.max(2, ei.pct)}%` }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, flexShrink: 0, fontSize: 11, color: 'var(--text-muted)', minWidth: 220 }}>
                  <span>OH: <strong style={{ color: 'var(--text)' }}>{ei.qtyOnHand}</strong></span>
                  <span>Rsv: <strong style={{ color: '#f59e0b' }}>{ei.qtyReserved}</strong></span>
                  <span>Avl: <strong style={{ color: ei.health === 'red' ? '#ef4444' : ei.health === 'yellow' ? '#f59e0b' : '#10b981' }}>{ei.qtyAvailable}</strong></span>
                  <span>SS: <strong style={{ color: 'var(--text-dim)' }}>{ei.safetyStock}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -- Warehouse Utilization Heatmap ------------------------- */}
      {warehouseHeatmap.length > 0 && (
        <div className="glass-card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
            Warehouse Utilization
          </h3>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 16px' }}>
            Inventory distribution across warehouse locations
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {warehouseHeatmap.map((wh, idx) => {
              // Normalize color intensity based on relative value
              const maxValue = warehouseHeatmap[0]?.value || 1;
              const intensity = Math.max(0.2, wh.value / maxValue);
              const baseColor = COLORS[idx % COLORS.length];
              return (
                <div
                  key={wh.name}
                  style={{
                    background: `${baseColor}${Math.round(intensity * 40).toString(16).padStart(2, '0')}`,
                    border: `1px solid ${baseColor}44`,
                    borderRadius: 'var(--radius)',
                    padding: '14px 16px',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                    {wh.name}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                    <span>Qty: <strong style={{ color: baseColor }}>{wh.qty.toLocaleString()}</strong></span>
                    <span>Items: <strong style={{ color: 'var(--text)' }}>{wh.count}</strong></span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: baseColor, marginTop: 4 }}>
                    {formatCurrency(wh.value)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* -- Enhanced Charts (grid-3) ------------------------------ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {/* Bar: Inventory Value by Warehouse */}
        <div className="chart-card">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px' }}>
            Inventory Value by Warehouse
          </h3>
          <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 16px' }}>
            Total value (cost * qty) per warehouse
          </p>
          {valueByWarehouseData.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={valueByWarehouseData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis
                  dataKey="name"
                  tick={AXIS_TICK}
                  axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                  tickLine={false}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={55}
                  tickFormatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
                />
                <Tooltip
                  {...CHART_TOOLTIP}
                  cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                  formatter={(value: any) => [formatCurrency(Number(value)), 'Value']}
                />
                <Bar dataKey="value" name="Inventory Value" radius={[4, 4, 0, 0]} maxBarSize={42}>
                  {valueByWarehouseData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bar: Stock Level Distribution */}
        <div className="chart-card">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px' }}>
            Stock Level Distribution
          </h3>
          <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 16px' }}>
            Records grouped by quantity range
          </p>
          {stockDistData.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stockDistData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
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
                <Bar dataKey="value" name="Records" radius={[4, 4, 0, 0]} maxBarSize={42}>
                  {stockDistData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie: Inventory Health (Fresh/Normal/Aging) */}
        <div className="chart-card">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px' }}>
            Inventory Health
          </h3>
          <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 16px' }}>
            Fresh / Normal / Aging classification
          </p>
          {agingChartData.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={agingChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {agingChartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
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
      </div>

      {/* -- Alerts ------------------------------------------------ */}
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
                    <span>Reorder Pt: <strong style={{ color: 'var(--text-dim)' }}>{a.reorderPoint}</strong></span>
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

      {/* -- Data Table -------------------------------------------- */}
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
                  <th>Aging</th>
                  <th style={{ textAlign: 'right' }}>Turnover</th>
                  <th>Lot Number</th>
                  <th>Bin</th>
                  <th>Expiry</th>
                  <th style={{ width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ei) => {
                  const wh = resolveWarehouse(ei.raw);
                  const agingInfo = AGING_CONFIG[ei.aging];

                  return (
                    <tr key={ei.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text)' }}>{ei.name}</td>
                      <td><span className="mono-text">{ei.sku}</span></td>
                      <td style={{ color: 'var(--text-secondary)' }}>{wh || '--'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                        {ei.qtyOnHand.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#f59e0b' }}>
                        {ei.qtyReserved.toLocaleString()}
                      </td>
                      <td style={{
                        textAlign: 'right', fontWeight: 600,
                        fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                        color: ei.belowReorder ? '#ef4444' : '#10b981',
                      }}>
                        {ei.qtyAvailable.toLocaleString()}
                      </td>
                      {/* Aging Indicator */}
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center',
                          padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                          color: agingInfo.color,
                          background: agingInfo.bg,
                          border: `1px solid ${agingInfo.color}33`,
                        }}>
                          {agingInfo.label}
                        </span>
                      </td>
                      {/* Turnover Ratio */}
                      <td style={{
                        textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                        fontWeight: 600,
                        color: ei.turnoverRatio > 10 ? '#10b981' : ei.turnoverRatio > 1 ? '#06b6d4' : '#f59e0b',
                      }}>
                        {ei.turnoverRatio > 0 ? ei.turnoverRatio.toFixed(2) : '--'}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{ei.raw['Lot Number'] || '--'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{ei.raw['Bin Location'] || '--'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {ei.raw['Expiry Date'] ? new Date(ei.raw['Expiry Date']).toLocaleDateString() : '--'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openView(ei.raw)} title="View">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(ei.raw)} title="Edit">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => openDelete(ei.raw)} title="Delete" style={{ color: 'var(--danger)' }}>
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

      {/* -- Create Modal ------------------------------------------ */}
      <Modal open={modalMode === 'create'} onClose={() => setModalMode(null)} title="Add Inventory Record">
        <RecordForm fields={formFields} onSubmit={handleCreate} onCancel={() => setModalMode(null)} submitLabel="Create" />
      </Modal>

      {/* -- Edit Modal -------------------------------------------- */}
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

      {/* -- View Modal -------------------------------------------- */}
      <Modal open={modalMode === 'view'} onClose={() => { setModalMode(null); setSelected(null); }} title="Inventory Detail">
        {selected && (() => {
          const ei = enrichedInventory.find((e) => e.id === selected.id);
          const wh = resolveWarehouse(selected);
          const agingInfo = ei ? AGING_CONFIG[ei.aging] : null;
          return (
            <div>
              {/* Status badges */}
              {ei && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                  {agingInfo && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                      color: agingInfo.color, background: agingInfo.bg,
                      border: `1px solid ${agingInfo.color}33`,
                    }}>
                      {agingInfo.label}
                    </span>
                  )}
                  {ei.belowReorder && (
                    <span className="badge badge-danger">Below Reorder Point</span>
                  )}
                </div>
              )}
              <div className="detail-grid">
                <div>
                  <div className="detail-field-label">Item</div>
                  <div className="detail-field-value">{ei?.name || resolveItem(selected)?.name || 'Unknown'}</div>
                </div>
                <div>
                  <div className="detail-field-label">SKU</div>
                  <div className="detail-field-value" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>{ei?.sku || '--'}</div>
                </div>
                <div>
                  <div className="detail-field-label">Warehouse</div>
                  <div className="detail-field-value">{wh || '--'}</div>
                </div>
                <div>
                  <div className="detail-field-label">Qty On Hand</div>
                  <div className="detail-field-value">{(ei?.qtyOnHand ?? Number(selected['Qty On Hand'] ?? 0)).toLocaleString()}</div>
                </div>
                <div>
                  <div className="detail-field-label">Qty Reserved</div>
                  <div className="detail-field-value">{(ei?.qtyReserved ?? Number(selected['Qty Reserved'] ?? 0)).toLocaleString()}</div>
                </div>
                <div>
                  <div className="detail-field-label">Qty Available</div>
                  <div className="detail-field-value" style={{ color: ei?.belowReorder ? '#ef4444' : '#10b981' }}>
                    {(ei?.qtyAvailable ?? Number(selected['Qty Available'] ?? 0)).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="detail-field-label">Turnover Ratio</div>
                  <div className="detail-field-value" style={{
                    color: ei && ei.turnoverRatio > 10 ? '#10b981' : ei && ei.turnoverRatio > 1 ? '#06b6d4' : '#f59e0b',
                  }}>
                    {ei && ei.turnoverRatio > 0 ? ei.turnoverRatio.toFixed(2) : '--'}
                  </div>
                </div>
                <div>
                  <div className="detail-field-label">Inventory Value</div>
                  <div className="detail-field-value">{ei ? formatCurrency(ei.inventoryValue) : '--'}</div>
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
            </div>
          );
        })()}
      </Modal>

      {/* -- Delete Confirmation ----------------------------------- */}
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
