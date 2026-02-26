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
} from 'recharts';

/* ═══════════════════════════════════════════
   Constants & Types
   ═══════════════════════════════════════════ */

const COLORS = ['#6366f1', '#f97316', '#10b981', '#06b6d4', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6'];

const STATUS_COLORS: Record<string, string> = {
  Active: '#10b981',
  Draft: '#f59e0b',
  Obsolete: '#6b7280',
  'Under Review': '#a855f7',
};

const CHART_TOOLTIP = {
  contentStyle: { background: '#1a2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 },
  labelStyle: { color: '#94a3b8' },
  itemStyle: { color: '#f1f5f9' },
};

const PAGE_SIZE = 25;

type SortDir = 'asc' | 'desc';
type StatusFilter = 'All' | 'Active' | 'Draft' | 'Obsolete' | 'Under Review';

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: any) => React.ReactNode;
}

interface Props {
  boms: Record<string, any>[];
  bomLines: Record<string, any>[];
  items: Record<string, any>[];
}

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */

function resolveRef(val: any): string {
  if (Array.isArray(val)) return val[0] || '';
  return String(val ?? '');
}

function resolveStatus(val: any): string {
  if (Array.isArray(val)) return val[0] || 'Unknown';
  return String(val ?? 'Unknown');
}

function fmt$(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtNum(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function interpolateColor(ratio: number): string {
  // 0 = green (#10b981), 1 = red (#ef4444)
  const r = Math.round(16 + ratio * (239 - 16));
  const g = Math.round(185 + ratio * (68 - 185));
  const b = Math.round(129 + ratio * (68 - 129));
  return `rgb(${r}, ${g}, ${b})`;
}

/* ═══════════════════════════════════════════
   Table Columns
   ═══════════════════════════════════════════ */

const formFields = [
  { name: 'BOM Code', label: 'BOM Code', type: 'text' as const, required: true },
  { name: 'Version', label: 'Version', type: 'number' as const },
  { name: 'Status', label: 'Status', type: 'select' as const, options: ['Draft', 'Active', 'Obsolete', 'Under Review'] },
  { name: 'Effective Date', label: 'Effective Date', type: 'date' as const },
  { name: 'Expiry Date', label: 'Expiry Date', type: 'date' as const },
  { name: 'Yield Pct', label: 'Yield Pct', type: 'number' as const },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
];

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function BOMClient({ boms: initialBoms, bomLines, items }: Props) {
  const [boms, setBoms] = useState(initialBoms);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view' | null>(null);
  const [selected, setSelected] = useState<Record<string, any> | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [sortCol, setSortCol] = useState<string>('BOM Code');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedBomId, setSelectedBomId] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [expandedTreeNodes, setExpandedTreeNodes] = useState<Set<string>>(new Set(['__all__']));

  // ── Lookup Maps ──────────────────────────
  const itemMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const item of items) {
      if (item.id) map[item.id] = item;
    }
    return map;
  }, [items]);

  const bomMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const bom of boms) {
      if (bom.id) map[bom.id] = bom;
    }
    return map;
  }, [boms]);

  const linesByBom = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const line of bomLines) {
      const bomRef = resolveRef(line['BOM']);
      if (!bomRef) continue;
      if (!map[bomRef]) map[bomRef] = [];
      map[bomRef].push(line);
    }
    return map;
  }, [bomLines]);

  // ── Table columns (with item name resolution) ──
  const tableColumns: Column[] = useMemo(() => [
    { key: 'BOM Code', label: 'BOM Code', sortable: true },
    {
      key: 'Item', label: 'Item', sortable: true,
      render: (v: any) => {
        const ref = resolveRef(v);
        const item = itemMap[ref];
        return item ? (item['Item Name'] || item['Name'] || 'Unknown') : '\u2014';
      },
    },
    { key: 'Version', label: 'Ver', sortable: true },
    { key: 'Status', label: 'Status', sortable: true, render: (v: any) => <StatusBadge value={v} /> },
    {
      key: 'Effective Date', label: 'Effective', sortable: true,
      render: (v: any) => v ? new Date(v).toLocaleDateString() : '\u2014',
    },
    {
      key: 'Expiry Date', label: 'Expiry', sortable: true,
      render: (v: any) => v ? new Date(v).toLocaleDateString() : '\u2014',
    },
    { key: 'Yield Pct', label: 'Yield %', sortable: true, render: (v: any) => v != null ? `${v}%` : '\u2014' },
    {
      key: '_components', label: 'Components', sortable: false,
      render: (_: any, row: any) => {
        const lines = linesByBom[row.id] || [];
        return (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text-dim)' }}>
            {lines.length}
          </span>
        );
      },
    },
  ], [itemMap, linesByBom]);

  // ═══════════════════════════════════════════
  // Feature 1: Executive KPIs
  // ═══════════════════════════════════════════

  const kpis = useMemo(() => {
    let active = 0, draft = 0, obsolete = 0, underReview = 0;
    let totalYield = 0, yieldCount = 0;

    for (const bom of boms) {
      const s = resolveStatus(bom['Status']);
      if (s === 'Active') active++;
      else if (s === 'Draft') draft++;
      else if (s === 'Obsolete') obsolete++;
      else if (s === 'Under Review') underReview++;

      const y = Number(bom['Yield Pct'] ?? 0);
      if (y > 0) { totalYield += y; yieldCount++; }
    }

    // Unique components used across all BOM lines
    const uniqueItems = new Set<string>();
    for (const line of bomLines) {
      const ref = resolveRef(line['Item']);
      if (ref) uniqueItems.add(ref);
    }

    // Avg BOM depth from Position field
    let totalMaxPosition = 0, bomWithPositions = 0;
    const positionsByBom: Record<string, number[]> = {};
    for (const line of bomLines) {
      const bomRef = resolveRef(line['BOM']);
      const pos = Number(line['Position'] ?? 0);
      if (bomRef) {
        if (!positionsByBom[bomRef]) positionsByBom[bomRef] = [];
        positionsByBom[bomRef].push(pos);
      }
    }
    for (const positions of Object.values(positionsByBom)) {
      const maxPos = Math.max(...positions, 0);
      if (maxPos > 0) { totalMaxPosition += maxPos; bomWithPositions++; }
    }
    const avgDepth = bomWithPositions > 0 ? totalMaxPosition / bomWithPositions : 0;

    // Estimated material cost (item cost x quantity from bom lines)
    let totalMaterialCost = 0;
    for (const line of bomLines) {
      const itemRef = resolveRef(line['Item']);
      const item = itemMap[itemRef];
      const qty = Number(line['Quantity'] ?? 0);
      const unitCost = Number(item?.['Unit Cost'] ?? item?.['Standard Cost'] ?? 0);
      totalMaterialCost += unitCost * qty;
    }

    return {
      total: boms.length,
      active, draft, obsolete, underReview,
      componentsUsed: uniqueItems.size,
      avgDepth: avgDepth.toFixed(1),
      avgYield: yieldCount > 0 ? (totalYield / yieldCount).toFixed(1) : '0',
      materialCost: totalMaterialCost,
    };
  }, [boms, bomLines, itemMap]);

  // ═══════════════════════════════════════════
  // Feature 2: BOM Tree Visualization
  // ═══════════════════════════════════════════

  const treeData = useMemo(() => {
    if (!selectedBomId) return { nodes: [] as any[], totalCost: 0, maxCost: 0 };

    const lines = linesByBom[selectedBomId] || [];
    const nodes = lines.map((line) => {
      const itemRef = resolveRef(line['Item']);
      const item = itemMap[itemRef];
      const qty = Number(line['Quantity'] ?? 0);
      const scrapPct = Number(line['Scrap Pct'] ?? 0);
      const position = Number(line['Position'] ?? 0);
      const unitCost = Number(item?.['Unit Cost'] ?? item?.['Standard Cost'] ?? 0);
      const extendedCost = unitCost * qty * (1 + scrapPct / 100);

      return {
        id: line.id,
        itemName: item?.['Item Name'] || item?.['Name'] || 'Unknown Component',
        quantity: qty,
        scrapPct,
        position,
        unitCost,
        extendedCost,
        uom: line['Unit of Measure'] ?? '',
        notes: line['Notes'] ?? '',
      };
    }).sort((a, b) => a.position - b.position);

    const totalCost = nodes.reduce((sum, n) => sum + n.extendedCost, 0);
    const maxCost = Math.max(...nodes.map(n => n.extendedCost), 1);

    return { nodes, totalCost, maxCost };
  }, [selectedBomId, linesByBom, itemMap]);

  // ═══════════════════════════════════════════
  // Feature 3: Cost Rollup Calculator
  // ═══════════════════════════════════════════

  const costRollup = useMemo(() => {
    if (!selectedBomId || treeData.nodes.length === 0) return null;

    const selectedBom = bomMap[selectedBomId];
    const yieldPct = Number(selectedBom?.['Yield Pct'] ?? 100);

    const pieData = treeData.nodes
      .filter(n => n.extendedCost > 0)
      .map(n => ({ name: n.itemName, value: Math.round(n.extendedCost * 100) / 100 }))
      .sort((a, b) => b.value - a.value);

    const barData = treeData.nodes
      .filter(n => n.extendedCost > 0)
      .map(n => {
        const materialCost = n.unitCost * n.quantity;
        const scrapAllowance = n.extendedCost - materialCost;
        return {
          name: n.itemName.length > 15 ? n.itemName.slice(0, 15) + '...' : n.itemName,
          material: Math.round(materialCost * 100) / 100,
          scrap: Math.round(scrapAllowance * 100) / 100,
        };
      })
      .sort((a, b) => (b.material + b.scrap) - (a.material + a.scrap))
      .slice(0, 10);

    const rawTotal = treeData.totalCost;
    const yieldAdjusted = yieldPct > 0 ? rawTotal / (yieldPct / 100) : rawTotal;

    return { pieData, barData, rawTotal, yieldAdjusted, yieldPct };
  }, [selectedBomId, treeData, bomMap]);

  // ═══════════════════════════════════════════
  // Feature 4: Where-Used Analysis
  // ═══════════════════════════════════════════

  const whereUsedResults = useMemo(() => {
    if (!selectedItemId) return [];

    const bomIds = new Set<string>();
    for (const line of bomLines) {
      const itemRef = resolveRef(line['Item']);
      if (itemRef === selectedItemId) {
        const bomRef = resolveRef(line['BOM']);
        if (bomRef) bomIds.add(bomRef);
      }
    }

    return boms.filter(b => bomIds.has(b.id)).map(bom => {
      const lines = linesByBom[bom.id] || [];
      const matchingLine = lines.find(l => resolveRef(l['Item']) === selectedItemId);
      const parentItemRef = resolveRef(bom['Item']);
      const parentItem = itemMap[parentItemRef];
      return {
        bomId: bom.id,
        bomCode: bom['BOM Code'] || 'No Code',
        status: resolveStatus(bom['Status']),
        version: bom['Version'] || '1',
        parentItemName: parentItem?.['Item Name'] || parentItem?.['Name'] || 'Unknown',
        quantity: Number(matchingLine?.['Quantity'] ?? 0),
        scrapPct: Number(matchingLine?.['Scrap Pct'] ?? 0),
      };
    });
  }, [selectedItemId, bomLines, boms, linesByBom, itemMap]);

  // ═══════════════════════════════════════════
  // Feature 5: Version Timeline
  // ═══════════════════════════════════════════

  const timeline = useMemo(() => {
    return boms
      .filter(b => b['Effective Date'])
      .map(bom => ({
        id: bom.id,
        bomCode: bom['BOM Code'] || 'No Code',
        version: bom['Version'] || '1',
        status: resolveStatus(bom['Status']),
        effectiveDate: new Date(bom['Effective Date']),
        expiryDate: bom['Expiry Date'] ? new Date(bom['Expiry Date']) : null,
        itemRef: resolveRef(bom['Item']),
      }))
      .sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime());
  }, [boms]);

  const timelineBounds = useMemo(() => {
    if (timeline.length === 0) return { min: Date.now(), max: Date.now(), range: 1 };
    const dates = timeline.flatMap(t => [t.effectiveDate.getTime(), ...(t.expiryDate ? [t.expiryDate.getTime()] : [])]);
    const min = Math.min(...dates);
    const max = Math.max(...dates, min + 86400000);
    return { min, max, range: max - min };
  }, [timeline]);

  // ═══════════════════════════════════════════
  // Feature 6: Enhanced Data Table
  // ═══════════════════════════════════════════

  const filtered = useMemo(() => {
    let result = boms;

    // Status filter
    if (statusFilter !== 'All') {
      result = result.filter(r => resolveStatus(r['Status']) === statusFilter);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(r => {
        // Search across BOM fields + resolved item name
        const itemRef = resolveRef(r['Item']);
        const item = itemMap[itemRef];
        const itemName = (item?.['Item Name'] || item?.['Name'] || '').toLowerCase();
        return (
          itemName.includes(q) ||
          Object.values(r).some(v => v != null && String(v).toLowerCase().includes(q))
        );
      });
    }

    // Sort
    result = [...result].sort((a, b) => {
      let aVal: any, bVal: any;
      if (sortCol === 'Item') {
        const aItem = itemMap[resolveRef(a['Item'])];
        const bItem = itemMap[resolveRef(b['Item'])];
        aVal = (aItem?.['Item Name'] || '').toLowerCase();
        bVal = (bItem?.['Item Name'] || '').toLowerCase();
      } else {
        aVal = a[sortCol] ?? '';
        bVal = b[sortCol] ?? '';
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [boms, statusFilter, search, sortCol, sortDir, itemMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = useCallback((col: string) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
    setPage(1);
  }, [sortCol]);

  // ── Status filter counts ──
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: boms.length, Active: 0, Draft: 0, Obsolete: 0, 'Under Review': 0 };
    for (const bom of boms) {
      const s = resolveStatus(bom['Status']);
      if (counts[s] !== undefined) counts[s]++;
    }
    return counts;
  }, [boms]);

  // ═══════════════════════════════════════════
  // Feature 7: CRUD Handlers
  // ═══════════════════════════════════════════

  const handleCreate = async (values: Record<string, any>) => {
    await createRecord(TABLES.BILL_OF_MATERIALS, values);
    setModalMode(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleUpdate = async (values: Record<string, any>) => {
    if (!selected) return;
    await updateRecord(TABLES.BILL_OF_MATERIALS, selected.id, values);
    setModalMode(null);
    setSelected(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleDelete = async () => {
    if (!selected) return;
    await deleteRecord(TABLES.BILL_OF_MATERIALS, selected.id);
    setBoms(prev => prev.filter(r => r.id !== selected.id));
    setModalMode(null);
    setSelected(null);
  };

  // ── Tree toggle ──
  const toggleTreeNode = (id: string) => {
    setExpandedTreeNodes(prev => {
      const next = new Set(prev);
      next.delete('__all__');
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ═══════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════ */

  return (
    <div>
      {/* ── Header ─────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Bill of Materials</h1>
          <p className="page-subtitle">
            Engineering BOM management &mdash; structure, costing, version control &amp; where-used analysis
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setSelected(null); setModalMode('create'); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          New BOM
        </button>
      </div>

      {/* ── Feature 1: Executive KPI Cards ─────────────── */}
      <div className="stat-row">
        {/* Total BOMs */}
        <div className="kpi-card">
          <div className="kpi-label">Total BOMs</div>
          <div className="kpi-value" style={{ color: '#6366f1' }}>{kpis.total}</div>
          {/* Mini status bar */}
          <div style={{ display: 'flex', gap: 2, marginTop: 10, height: 6, borderRadius: 3, overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
            {kpis.active > 0 && (
              <div style={{ flex: kpis.active, background: '#10b981', borderRadius: 3 }} title={`Active: ${kpis.active}`} />
            )}
            {kpis.draft > 0 && (
              <div style={{ flex: kpis.draft, background: '#f59e0b', borderRadius: 3 }} title={`Draft: ${kpis.draft}`} />
            )}
            {kpis.obsolete > 0 && (
              <div style={{ flex: kpis.obsolete, background: '#6b7280', borderRadius: 3 }} title={`Obsolete: ${kpis.obsolete}`} />
            )}
            {kpis.underReview > 0 && (
              <div style={{ flex: kpis.underReview, background: '#a855f7', borderRadius: 3 }} title={`Under Review: ${kpis.underReview}`} />
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>
            <span><span style={{ color: '#10b981' }}>{kpis.active}</span> Active</span>
            <span><span style={{ color: '#f59e0b' }}>{kpis.draft}</span> Draft</span>
            <span><span style={{ color: '#6b7280' }}>{kpis.obsolete}</span> Obs</span>
          </div>
        </div>

        {/* Components Used */}
        <div className="kpi-card">
          <div className="kpi-label">Components Used</div>
          <div className="kpi-value" style={{ color: '#06b6d4' }}>{kpis.componentsUsed}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            unique items across {bomLines.length} BOM lines
          </div>
        </div>

        {/* Avg BOM Depth */}
        <div className="kpi-card">
          <div className="kpi-label">Avg BOM Depth</div>
          <div className="kpi-value" style={{ color: '#a855f7' }}>{kpis.avgDepth}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            levels (from Position field)
          </div>
        </div>

        {/* Avg Yield */}
        <div className="kpi-card">
          <div className="kpi-label">Avg Yield</div>
          <div className="kpi-value" style={{ color: '#f59e0b' }}>{kpis.avgYield}%</div>
          <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(Number(kpis.avgYield), 100)}%`, height: '100%', background: '#f59e0b', borderRadius: 2 }} />
          </div>
        </div>

        {/* Estimated Material Cost */}
        <div className="kpi-card">
          <div className="kpi-label">Est. Material Cost</div>
          <div className="kpi-value" style={{ color: '#10b981' }}>{fmt$(kpis.materialCost)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            total across all BOM lines
          </div>
        </div>
      </div>

      {/* ── BOM Selector for Tree + Cost ───────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="chart-card" style={{ padding: '16px 20px' }}>
          <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8, display: 'block' }}>
            Select BOM for Tree &amp; Cost Analysis
          </label>
          <select
            className="input"
            value={selectedBomId}
            onChange={(e) => { setSelectedBomId(e.target.value); setExpandedTreeNodes(new Set(['__all__'])); }}
          >
            <option value="">Choose a BOM...</option>
            {boms.map((bom) => {
              const item = itemMap[resolveRef(bom['Item'])];
              const itemName = item?.['Item Name'] || item?.['Name'] || 'Unknown';
              return (
                <option key={bom.id} value={bom.id}>
                  {bom['BOM Code'] || 'No Code'} \u2014 {itemName} (v{bom['Version'] || '1'}, {resolveStatus(bom['Status'])})
                </option>
              );
            })}
          </select>
        </div>

        <div className="chart-card" style={{ padding: '16px 20px' }}>
          <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8, display: 'block' }}>
            Select Item for Where-Used Analysis
          </label>
          <select
            className="input"
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
          >
            <option value="">Choose an item...</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item['Item Name'] || item['Name'] || 'Unknown'} {item['Item Type'] ? `(${item['Item Type']})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Feature 2: BOM Tree Visualization ──────────── */}
      {selectedBomId && treeData.nodes.length > 0 && (
        <div className="table-container" style={{ marginBottom: 20 }}>
          <div className="toolbar">
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
              Component Tree
              <span style={{ fontWeight: 500, color: 'var(--text-dim)', fontSize: 12 }}>
                ({treeData.nodes.length} components, {fmt$(treeData.totalCost)} total)
              </span>
            </h3>
          </div>

          <div style={{ padding: '12px 20px' }}>
            {treeData.nodes.map((node, idx) => {
              const costRatio = treeData.maxCost > 0 ? node.extendedCost / treeData.maxCost : 0;
              const barColor = interpolateColor(costRatio);
              const costPct = treeData.totalCost > 0 ? (node.extendedCost / treeData.totalCost * 100) : 0;

              return (
                <div
                  key={node.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 0',
                    marginLeft: node.position * 24,
                    borderBottom: idx < treeData.nodes.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  {/* Position indicator */}
                  <div style={{
                    width: 28, height: 28, borderRadius: 6,
                    background: `${barColor}18`, color: barColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, flexShrink: 0,
                  }}>
                    L{node.position}
                  </div>

                  {/* Item info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {node.itemName}
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      <span>Qty: <strong style={{ color: 'var(--text-dim)' }}>{fmtNum(node.quantity)}</strong></span>
                      {node.uom && <span>UoM: {resolveStatus(node.uom)}</span>}
                      {node.scrapPct > 0 && <span style={{ color: '#f59e0b' }}>Scrap: {node.scrapPct}%</span>}
                    </div>
                  </div>

                  {/* Cost bar + value */}
                  <div style={{ width: 180, flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: barColor, fontFamily: "'JetBrains Mono', monospace" }}>
                        {fmt$(node.extendedCost)}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{costPct.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                      <div style={{ width: `${costPct}%`, height: '100%', background: barColor, borderRadius: 2, transition: 'width 0.3s ease' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedBomId && treeData.nodes.length === 0 && (
        <div className="chart-card" style={{ marginBottom: 20 }}>
          <div className="empty-state">No BOM lines found for this bill of materials.</div>
        </div>
      )}

      {/* ── Feature 3: Cost Rollup Calculator ──────────── */}
      {costRollup && costRollup.pieData.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          {/* Pie chart: cost by component */}
          <div className="chart-card">
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 700 }}>Cost by Component</h3>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 12px 0' }}>Material cost distribution for selected BOM</p>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={costRollup.pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {costRollup.pieData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  {...CHART_TOOLTIP}
                  formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Cost']}
                />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  formatter={(v: string) => (
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>
                      {v.length > 20 ? v.slice(0, 20) + '...' : v}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Stacked bar: material + scrap allowance */}
          <div className="chart-card">
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 700 }}>Cost Layers</h3>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 4px 0' }}>Material cost + scrap allowance by component</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={costRollup.barData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={120} />
                <Tooltip
                  {...CHART_TOOLTIP}
                  formatter={(value: any, name?: string) => [`$${Number(value).toFixed(2)}`, name === 'material' ? 'Material' : 'Scrap Allowance']}
                />
                <Bar dataKey="material" stackId="cost" fill="#6366f1" radius={[0, 0, 0, 0]} name="Material" />
                <Bar dataKey="scrap" stackId="cost" fill="#f97316" radius={[0, 4, 4, 0]} name="Scrap Allowance" />
              </BarChart>
            </ResponsiveContainer>

            {/* Total cost summary */}
            <div style={{ borderTop: '1px solid var(--border)', padding: '14px 0 4px 0', marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>
                <span>Raw Material Cost</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{fmt$(costRollup.rawTotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>
                <span>Yield Adjustment ({costRollup.yieldPct}%)</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: costRollup.yieldPct < 100 ? '#f59e0b' : '#10b981' }}>
                  {costRollup.yieldPct < 100 ? '+' : ''}{fmt$(costRollup.yieldAdjusted - costRollup.rawTotal)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: 'var(--text)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                <span>Total with Yield</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#10b981' }}>{fmt$(costRollup.yieldAdjusted)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Feature 4: Where-Used Analysis ─────────────── */}
      {selectedItemId && (
        <div className="chart-card" style={{ marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            Where-Used Analysis
            <span style={{ fontWeight: 500, color: 'var(--text-dim)', fontSize: 12 }}>
              &mdash; {itemMap[selectedItemId]?.['Item Name'] || 'Selected Item'}
            </span>
          </h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
            BOMs that include this item as a component
          </p>

          {whereUsedResults.length === 0 ? (
            <div className="empty-state" style={{ padding: 32 }}>
              This item is not used in any Bill of Materials.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {whereUsedResults.map((r) => (
                <div
                  key={r.bomId}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '14px 16px',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease',
                  }}
                  onClick={() => { setSelectedBomId(r.bomId); setExpandedTreeNodes(new Set(['__all__'])); }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>
                        {r.bomCode}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                        {r.parentItemName}
                      </div>
                    </div>
                    <StatusBadge value={r.status} />
                  </div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-muted)' }}>
                    <span>v{r.version}</span>
                    <span>Qty: <strong style={{ color: 'var(--text-dim)' }}>{fmtNum(r.quantity)}</strong></span>
                    {r.scrapPct > 0 && <span style={{ color: '#f59e0b' }}>Scrap: {r.scrapPct}%</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Feature 5: Version Timeline ────────────────── */}
      {timeline.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 700 }}>Version Timeline</h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
            BOM versions by effective and expiry date ranges
          </p>

          <div style={{ position: 'relative', padding: '8px 0', overflowX: 'auto' }}>
            {/* Timeline axis */}
            <div style={{ position: 'relative', height: Math.max(timeline.length * 40 + 30, 80), minWidth: 600 }}>
              {/* Horizontal axis line */}
              <div style={{ position: 'absolute', top: 0, left: 60, right: 16, height: 1, background: 'var(--border)' }} />

              {/* Date labels */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                const dateMs = timelineBounds.min + pct * timelineBounds.range;
                return (
                  <div
                    key={pct}
                    style={{
                      position: 'absolute',
                      top: -18,
                      left: `calc(60px + ${pct * 100}% * (1 - 76px / 100%))`,
                      transform: 'translateX(-50%)',
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {new Date(dateMs).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                  </div>
                );
              })}

              {/* BOM bars */}
              {timeline.map((t, idx) => {
                const startPct = (t.effectiveDate.getTime() - timelineBounds.min) / timelineBounds.range;
                const endPct = t.expiryDate
                  ? (t.expiryDate.getTime() - timelineBounds.min) / timelineBounds.range
                  : 1;
                const barColor = STATUS_COLORS[t.status] || '#6b7280';
                const top = 20 + idx * 40;
                const containerWidth = 'calc(100% - 76px)';

                return (
                  <div key={t.id} style={{ position: 'absolute', top, left: 0, right: 0, height: 32, display: 'flex', alignItems: 'center' }}>
                    {/* Label */}
                    <div style={{ width: 56, flexShrink: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textAlign: 'right', paddingRight: 8, fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.bomCode}
                    </div>
                    {/* Bar area */}
                    <div style={{ flex: 1, position: 'relative', height: '100%' }}>
                      <div
                        style={{
                          position: 'absolute',
                          left: `${startPct * 100}%`,
                          width: `${Math.max((endPct - startPct) * 100, 1)}%`,
                          top: 4,
                          height: 24,
                          background: `${barColor}25`,
                          border: `1px solid ${barColor}60`,
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                          paddingLeft: 8,
                          gap: 6,
                          overflow: 'hidden',
                        }}
                        title={`${t.bomCode} v${t.version} (${t.status}) | ${t.effectiveDate.toLocaleDateString()} - ${t.expiryDate?.toLocaleDateString() || 'No expiry'}`}
                      >
                        <span style={{ fontSize: 10, fontWeight: 700, color: barColor, whiteSpace: 'nowrap' }}>
                          v{t.version}
                        </span>
                        <span style={{ fontSize: 10, color: barColor, opacity: 0.7, whiteSpace: 'nowrap' }}>
                          {t.status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Feature 6: Enhanced Data Table ─────────────── */}
      <div className="table-container">
        {/* Status filter tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 20px' }}>
          {(['All', 'Active', 'Draft', 'Obsolete', 'Under Review'] as StatusFilter[]).map((tab) => {
            const isActive = statusFilter === tab;
            const tabColor = tab === 'All' ? '#6366f1' : STATUS_COLORS[tab] || '#6b7280';
            return (
              <button
                key={tab}
                onClick={() => { setStatusFilter(tab); setPage(1); }}
                style={{
                  padding: '10px 16px',
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? tabColor : 'var(--text-muted)',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? `2px solid ${tabColor}` : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {tab}
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  background: isActive ? `${tabColor}20` : 'rgba(255,255,255,0.05)',
                  color: isActive ? tabColor : 'var(--text-muted)',
                  padding: '1px 6px',
                  borderRadius: 10,
                }}>
                  {statusCounts[tab] || 0}
                </span>
              </button>
            );
          })}
        </div>

        <div className="toolbar">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            {statusFilter === 'All' ? 'All BOMs' : `${statusFilter} BOMs`}
            <span style={{ fontWeight: 500, color: 'var(--text-dim)', fontSize: 12 }}> ({filtered.length})</span>
          </h3>
          <div className="search-bar">
            <span className="search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            </span>
            <input
              className="input"
              placeholder="Search BOMs, items..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ width: 260 }}
            />
          </div>
        </div>

        {pageData.length === 0 ? (
          <div className="empty-state">No BOMs found matching your criteria</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {tableColumns.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => c.sortable && handleSort(c.key)}
                    style={{ cursor: c.sortable ? 'pointer' : 'default', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {c.label}
                      {c.sortable && sortCol === c.key && (
                        <span style={{ fontSize: 10, opacity: 0.7 }}>
                          {sortDir === 'asc' ? '\u25B2' : '\u25BC'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.map((row) => (
                <tr key={row.id} onClick={() => { setSelected(row); setModalMode('view'); }} style={{ cursor: 'pointer' }}>
                  {tableColumns.map((c) => (
                    <td key={c.key}>
                      {c.render ? c.render(row[c.key], row) : String(row[c.key] ?? '\u2014')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
          <span className="pagination-info">Page {page} of {totalPages}</span>
          <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}

      {/* ═══════════════════════════════════════════
         Feature 7: CRUD Modals
         ═══════════════════════════════════════════ */}

      <Modal open={modalMode === 'create'} onClose={() => setModalMode(null)} title="New BOM">
        <RecordForm fields={formFields} onSubmit={handleCreate} onCancel={() => setModalMode(null)} submitLabel="Create" />
      </Modal>

      <Modal open={modalMode === 'edit'} onClose={() => { setModalMode(null); setSelected(null); }} title="Edit BOM">
        {selected && <RecordForm fields={formFields} initialValues={selected} onSubmit={handleUpdate} onCancel={() => { setModalMode(null); setSelected(null); }} submitLabel="Update" />}
      </Modal>

      <Modal open={modalMode === 'view' && !!selected} onClose={() => { setModalMode(null); setSelected(null); }} title="BOM Details">
        {selected && (
          <div>
            {/* Detail header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '12px 16px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: '#6366f120', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{selected['BOM Code'] || 'No Code'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  Version {selected['Version'] || '1'} &middot; {resolveStatus(selected['Status'])}
                </div>
              </div>
            </div>

            <div className="detail-grid" style={{ marginBottom: 24 }}>
              {Object.entries(selected).filter(([k]) => !['id', 'createdAt', 'updatedAt', 'createdBy'].includes(k)).map(([key, val]) => {
                let display: string;
                if (key === 'Item') {
                  const ref = resolveRef(val);
                  const item = itemMap[ref];
                  display = item ? (item['Item Name'] || item['Name'] || ref) : (ref || '\u2014');
                } else if (key === 'Effective Date' || key === 'Expiry Date') {
                  display = val ? new Date(val as string).toLocaleDateString() : '\u2014';
                } else if (key === 'Yield Pct') {
                  display = val != null ? `${val}%` : '\u2014';
                } else {
                  display = val == null || val === '' ? '\u2014' : String(val);
                }
                return (
                  <div key={key}>
                    <div className="detail-field-label">{key}</div>
                    <div className="detail-field-value">{display}</div>
                  </div>
                );
              })}
            </div>

            {/* BOM Lines within detail view */}
            {(() => {
              const lines = linesByBom[selected.id] || [];
              if (lines.length === 0) return null;
              return (
                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
                    Components ({lines.length})
                  </h4>
                  <table className="data-table" style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>UoM</th>
                        <th>Scrap %</th>
                        <th>Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line: any) => {
                        const itemRef = resolveRef(line['Item']);
                        const item = itemMap[itemRef];
                        const qty = Number(line['Quantity'] ?? 0);
                        const unitCost = Number(item?.['Unit Cost'] ?? item?.['Standard Cost'] ?? 0);
                        return (
                          <tr key={line.id}>
                            <td style={{ fontWeight: 600 }}>{item?.['Item Name'] || item?.['Name'] || 'Unknown'}</td>
                            <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtNum(qty)}</td>
                            <td>{line['Unit of Measure'] || '\u2014'}</td>
                            <td style={{ color: Number(line['Scrap Pct'] ?? 0) > 0 ? '#f59e0b' : 'var(--text-dim)' }}>
                              {Number(line['Scrap Pct'] ?? 0) > 0 ? `${line['Scrap Pct']}%` : '\u2014'}
                            </td>
                            <td style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: '#10b981' }}>
                              {fmt$(unitCost * qty)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}

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
