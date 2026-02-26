'use client';

import { useState, useMemo } from 'react';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

interface Props {
  boms: any[];
  bomLines: any[];
  items: any[];
}

interface TreeNode {
  id: string;
  itemName: string;
  itemSku: string;
  bomCode: string;
  quantity: number;
  scrapPct: number;
  level: number;
  children: TreeNode[];
  effectiveQty: number;
  isLeaf: boolean;
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

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function BomExplosionClient({ boms, bomLines, items }: Props) {
  const [selectedBomId, setSelectedBomId] = useState<string>('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [showQuantities, setShowQuantities] = useState(true);

  // Build lookup maps
  const itemMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const item of items) {
      if (item.id) map[item.id] = item;
    }
    return map;
  }, [items]);

  const bomsByItem = useMemo(() => {
    const map: Record<string, any> = {};
    for (const bom of boms) {
      const itemRef = resolveRef(bom['Item']);
      if (itemRef) map[itemRef] = bom;
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

  // Build tree recursively
  function buildTree(bomId: string, parentQty: number, level: number, visited: Set<string>): TreeNode[] {
    if (visited.has(bomId) || level > 10) return []; // Prevent infinite recursion
    visited.add(bomId);

    const bom = boms.find(b => b.id === bomId);
    const lines = linesByBom[bomId] || [];

    return lines.map((line, idx) => {
      const itemRef = resolveRef(line['Item']);
      const item = itemMap[itemRef];
      const qty = Number(line['Quantity'] || 0);
      const scrapPct = Number(line['Scrap Pct'] || 0);
      const effectiveQty = qty * parentQty * (1 + scrapPct / 100);

      // Check if this item has its own BOM (sub-assembly)
      const subBom = bomsByItem[itemRef];
      const children = subBom ? buildTree(subBom.id, effectiveQty, level + 1, new Set(visited)) : [];

      return {
        id: `${bomId}-${line.id || idx}`,
        itemName: item?.['Item Name'] || item?.['Name'] || item?.['SKU'] || 'Unknown Component',
        itemSku: item?.['SKU'] || '',
        bomCode: bom?.['BOM Code'] || '',
        quantity: qty,
        scrapPct,
        level,
        children,
        effectiveQty: Math.round(effectiveQty * 100) / 100,
        isLeaf: children.length === 0,
      };
    });
  }

  const tree = useMemo(() => {
    if (!selectedBomId) return [];
    return buildTree(selectedBomId, 1, 0, new Set());
  }, [selectedBomId, boms, bomLines, items]);

  // Count total nodes
  function countNodes(nodes: TreeNode[]): number {
    return nodes.reduce((acc, n) => acc + 1 + countNodes(n.children), 0);
  }

  const totalComponents = countNodes(tree);

  // Flatten for table/list display
  function flattenTree(nodes: TreeNode[]): TreeNode[] {
    const result: TreeNode[] = [];
    for (const node of nodes) {
      result.push(node);
      if (expandedNodes.has(node.id) || expandedNodes.has('__all__')) {
        result.push(...flattenTree(node.children));
      }
    }
    return result;
  }

  const flatNodes = flattenTree(tree);

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedNodes(new Set(['__all__']));
  const collapseAll = () => setExpandedNodes(new Set());

  // Selected BOM info
  const selectedBom = boms.find(b => b.id === selectedBomId);
  const selectedItem = selectedBom ? itemMap[resolveRef(selectedBom['Item'])] : null;

  // Level colors
  const levelColors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">BOM Explosion</h1>
          <p className="page-subtitle">
            Recursive bill of materials breakdown &mdash; {boms.length} BOMs, {bomLines.length} lines, {items.length} items
          </p>
        </div>
      </div>

      {/* BOM Selector */}
      <div className="card" style={{ marginBottom: 20, padding: '18px 24px' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label className="field-label">Select Bill of Materials</label>
            <select
              className="input"
              value={selectedBomId}
              onChange={(e) => { setSelectedBomId(e.target.value); setExpandedNodes(new Set()); }}
            >
              <option value="">Choose a BOM to explode...</option>
              {boms.map((bom) => {
                const item = itemMap[resolveRef(bom['Item'])];
                const itemName = item?.['Item Name'] || item?.['Name'] || 'Unknown';
                return (
                  <option key={bom.id} value={bom.id}>
                    {bom['BOM Code'] || 'No Code'} — {itemName} (v{bom['Version'] || '1'}, {resolveStatus(bom['Status'])})
                  </option>
                );
              })}
            </select>
          </div>
          {selectedBomId && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={expandAll}>Expand All</button>
              <button className="btn btn-secondary btn-sm" onClick={collapseAll}>Collapse All</button>
              <button className={`btn btn-sm ${showQuantities ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowQuantities(!showQuantities)}>
                {showQuantities ? 'Hide Qty' : 'Show Qty'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Selected BOM Summary */}
      {selectedBom && (
        <div className="kpi-grid" style={{ marginBottom: 20 }}>
          <div className="kpi-card">
            <div className="kpi-label">BOM Code</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)', fontFamily: "'JetBrains Mono', monospace" }}>{selectedBom['BOM Code'] || '—'}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Product</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{selectedItem?.['Item Name'] || selectedItem?.['Name'] || '—'}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{selectedItem?.['SKU'] || ''}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Total Components</div>
            <div className="kpi-value" style={{ color: '#06b6d4' }}>{totalComponents}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Status / Version</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
              <span className={`badge ${resolveStatus(selectedBom['Status']) === 'Active' ? 'badge-active' : 'badge-draft'}`}>
                {resolveStatus(selectedBom['Status'])}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>v{selectedBom['Version'] || '1'}</span>
            </div>
            {selectedBom['Yield Pct'] && (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>Yield: {selectedBom['Yield Pct']}%</div>
            )}
          </div>
        </div>
      )}

      {/* Tree View */}
      {selectedBomId && tree.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            No BOM lines found for this bill of materials.
          </div>
        </div>
      )}

      {flatNodes.length > 0 && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '45%' }}>Component</th>
                <th>Level</th>
                {showQuantities && <th>Qty Per</th>}
                {showQuantities && <th>Scrap %</th>}
                {showQuantities && <th>Effective Qty</th>}
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {flatNodes.map((node) => {
                const hasChildren = node.children.length > 0;
                const isExpanded = expandedNodes.has(node.id) || expandedNodes.has('__all__');
                const color = levelColors[node.level % levelColors.length];

                return (
                  <tr
                    key={node.id}
                    style={{ cursor: hasChildren ? 'pointer' : 'default' }}
                    onClick={() => hasChildren && toggleNode(node.id)}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: node.level * 24 }}>
                        {/* Expand/collapse icon */}
                        {hasChildren ? (
                          <span style={{ fontSize: 14, color: 'var(--text-muted)', width: 18, textAlign: 'center', transition: 'transform 0.15s ease', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                            ▶
                          </span>
                        ) : (
                          <span style={{ width: 18, textAlign: 'center', fontSize: 8, color }}>●</span>
                        )}

                        {/* Level indicator line */}
                        <div style={{ width: 3, height: 24, borderRadius: 2, background: color, flexShrink: 0 }} />

                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                            {node.itemName}
                          </div>
                          {node.itemSku && (
                            <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-dim)' }}>
                              {node.itemSku}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          background: `${color}20`,
                          color,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {node.level}
                      </span>
                    </td>
                    {showQuantities && (
                      <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600 }}>
                        {node.quantity}
                      </td>
                    )}
                    {showQuantities && (
                      <td style={{ color: node.scrapPct > 0 ? '#f59e0b' : 'var(--text-dim)', fontSize: 13 }}>
                        {node.scrapPct > 0 ? `${node.scrapPct}%` : '—'}
                      </td>
                    )}
                    {showQuantities && (
                      <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color }}>
                        {node.effectiveQty}
                      </td>
                    )}
                    <td>
                      {hasChildren ? (
                        <span className="badge badge-info">Sub-Assembly</span>
                      ) : (
                        <span className="badge badge-active">Raw Material</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* No BOM selected */}
      {!selectedBomId && (
        <div className="card">
          <div className="empty-state" style={{ padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🔧</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Select a Bill of Materials
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', maxWidth: 400, margin: '0 auto' }}>
              Choose a BOM from the dropdown above to see a recursive explosion of all components, sub-assemblies, and raw materials with their quantities.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
