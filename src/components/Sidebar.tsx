'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

/* ── NAV structure ──────────────────────────────── */

interface NavItem {
  label: string;
  href: string;
}

interface NavGroup {
  category: string;
  icon: React.ReactNode;
  items: NavItem[];
}

const ICON_SIZE = 16;

const icons = {
  overview: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="9.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="1.5" y="9.5" width="5" height="5" rx="1" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
    </svg>
  ),
  masterData: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="8" cy="4" rx="6" ry="2.5" />
      <path d="M2 4v4c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5V4" />
      <path d="M2 8v4c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5V8" />
    </svg>
  ),
  engineering: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2.5L13.5 6.5L6.5 13.5H2.5V9.5L9.5 2.5Z" />
      <path d="M8 4L12 8" />
      <path d="M10 6.5L12.5 4L14 5.5" />
    </svg>
  ),
  purchasing: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 1H3L3.6 3M3.6 3H14L12 9H5L3.6 3Z" />
      <circle cx="5.5" cy="13" r="1.25" />
      <circle cx="11.5" cy="13" r="1.25" />
    </svg>
  ),
  sales: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1.5 12 5 6 9 9 14.5 2" />
      <polyline points="10.5 2 14.5 2 14.5 6" />
    </svg>
  ),
  manufacturing: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 14V8L6 5V8L10 5V8L14 5V14H2Z" />
      <line x1="2" y1="14" x2="14" y2="14" />
      <rect x="5" y="10" width="2" height="4" rx="0.5" />
      <rect x="9" y="10" width="2" height="4" rx="0.5" />
    </svg>
  ),
  inventory: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 5.5L8 2.5L13.5 5.5V10.5L8 13.5L2.5 10.5V5.5Z" />
      <path d="M2.5 5.5L8 8.5L13.5 5.5" />
      <line x1="8" y1="8.5" x2="8" y2="13.5" />
    </svg>
  ),
  planning: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
      <line x1="2" y1="6" x2="14" y2="6" />
      <line x1="5.5" y1="2.5" x2="5.5" y2="0.5" />
      <line x1="10.5" y1="2.5" x2="10.5" y2="0.5" />
      <rect x="4" y="8" width="2" height="1.5" rx="0.3" />
      <rect x="7" y="8" width="2" height="1.5" rx="0.3" />
      <rect x="10" y="8" width="2" height="1.5" rx="0.3" />
      <rect x="4" y="10.5" width="2" height="1.5" rx="0.3" />
      <rect x="7" y="10.5" width="2" height="1.5" rx="0.3" />
    </svg>
  ),
  quality: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5L2.5 4V8C2.5 11.5 8 14.5 8 14.5C8 14.5 13.5 11.5 13.5 8V4L8 1.5Z" />
      <polyline points="5.5 8 7.2 9.8 10.5 6.2" />
    </svg>
  ),
  capacityFinance: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 2V8L12 10" />
      <path d="M8 8L4.5 5" />
    </svg>
  ),
};

const NAV: NavGroup[] = [
  { category: 'Overview', icon: icons.overview, items: [
    { label: 'Dashboard', href: '/' },
    { label: 'MRP Simulation', href: '/mrp' },
    { label: 'Analytics', href: '/analytics' },
    { label: 'Activity Log', href: '/audit' },
  ]},
  { category: 'Master Data', icon: icons.masterData, items: [
    { label: 'Items', href: '/items' },
    { label: 'Suppliers', href: '/suppliers' },
    { label: 'Customers', href: '/customers' },
    { label: 'Warehouses', href: '/warehouses' },
    { label: 'Work Centers', href: '/work-centers' },
    { label: 'Units of Measure', href: '/uom' },
  ]},
  { category: 'Engineering', icon: icons.engineering, items: [
    { label: 'Bill of Materials', href: '/bom' },
    { label: 'BOM Lines', href: '/bom-lines' },
    { label: 'BOM Explosion', href: '/bom-explosion' },
    { label: 'Routings', href: '/routings' },
    { label: 'Routing Operations', href: '/routing-ops' },
  ]},
  { category: 'Purchasing', icon: icons.purchasing, items: [
    { label: 'Purchase Orders', href: '/purchase-orders' },
    { label: 'PO Lines', href: '/po-lines' },
  ]},
  { category: 'Sales', icon: icons.sales, items: [
    { label: 'Sales Orders', href: '/sales-orders' },
    { label: 'SO Lines', href: '/so-lines' },
  ]},
  { category: 'Manufacturing', icon: icons.manufacturing, items: [
    { label: 'Production Orders', href: '/production-orders' },
    { label: 'Prod Operations', href: '/prod-ops' },
  ]},
  { category: 'Inventory', icon: icons.inventory, items: [
    { label: 'Inventory', href: '/inventory' },
    { label: 'Transactions', href: '/inv-transactions' },
  ]},
  { category: 'Planning', icon: icons.planning, items: [
    { label: 'Demand Forecasts', href: '/forecasts' },
    { label: 'MRP Runs', href: '/mrp-runs' },
    { label: 'Recommendations', href: '/mrp-recs' },
  ]},
  { category: 'Quality', icon: icons.quality, items: [
    { label: 'Inspections', href: '/inspections' },
    { label: 'Check Items', href: '/check-items' },
  ]},
  { category: 'Capacity & Finance', icon: icons.capacityFinance, items: [
    { label: 'Capacity Plans', href: '/capacity' },
    { label: 'Cost Centers', href: '/cost-centers' },
  ]},
];

/* ── Fuzzy match helper ─────────────────────────── */

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let qi = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

/* ── Flat item list for keyboard nav ────────────── */

function flatItems(groups: NavGroup[], search: string): NavItem[] {
  const result: NavItem[] = [];
  for (const g of groups) {
    for (const item of g.items) {
      if (!search || fuzzyMatch(item.label, search) || fuzzyMatch(g.category, search)) {
        result.push(item);
      }
    }
  }
  return result;
}

/* ── Component ──────────────────────────────────── */

interface SidebarProps {
  counts?: Record<string, number>;
}

export function Sidebar({ counts }: SidebarProps) {
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [focusIdx, setFocusIdx] = useState(-1);
  const navRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const linkRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());

  const flat = useMemo(() => flatItems(NAV, search), [search]);

  const toggleCategory = useCallback((cat: string) => {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  /* Keyboard navigation */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIdx((i) => {
          const next = Math.min(i + 1, flat.length - 1);
          linkRefs.current.get(flat[next]?.href)?.focus();
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIdx((i) => {
          if (i <= 0) {
            searchRef.current?.focus();
            return -1;
          }
          const next = i - 1;
          linkRefs.current.get(flat[next]?.href)?.focus();
          return next;
        });
      } else if (e.key === 'Home') {
        e.preventDefault();
        searchRef.current?.focus();
        setFocusIdx(-1);
      }
    },
    [flat],
  );

  /* Reset focus index when search changes */
  useEffect(() => {
    setFocusIdx(-1);
  }, [search]);

  const isSearching = search.length > 0;

  return (
    <aside className="sidebar" onKeyDown={handleKeyDown}>
      {/* ── Brand ──────────────────────────────── */}
      <div className="sidebar-brand">
        <div
          style={{
            width: 34,
            height: 34,
            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)',
            borderRadius: 9,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            color: 'white',
            fontWeight: 800,
            boxShadow: '0 2px 12px rgba(99,102,241,0.35), inset 0 1px 1px rgba(255,255,255,0.2)',
            flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 3H8V8H3V3Z" fill="white" fillOpacity="0.9" rx="1" />
            <path d="M10 3H15V8H10V3Z" fill="white" fillOpacity="0.6" rx="1" />
            <path d="M3 10H8V15H3V10Z" fill="white" fillOpacity="0.6" rx="1" />
            <path d="M10 10H15V15H10V10Z" fill="white" fillOpacity="0.35" rx="1" />
          </svg>
        </div>
        <div className="sidebar-brand-text">
          <h1>MRP Enterprise</h1>
          <p>Material Planning Console</p>
        </div>
      </div>

      {/* ── Search ─────────────────────────────── */}
      <div style={{ padding: '10px 10px 2px' }}>
        <div style={{ position: 'relative' }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="var(--text-dim)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          >
            <circle cx="7" cy="7" r="4.5" />
            <line x1="10.5" y1="10.5" x2="14" y2="14" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search navigation..."
            aria-label="Search navigation"
            style={{
              width: '100%',
              padding: '7px 10px 7px 32px',
              border: '1px solid var(--border)',
              borderRadius: 7,
              fontSize: 12,
              fontFamily: 'inherit',
              color: 'var(--text)',
              background: 'var(--bg-input)',
              outline: 'none',
              transition: 'border-color 150ms ease, box-shadow 150ms ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-focus)';
              e.currentTarget.style.boxShadow = '0 0 0 2px var(--primary-glow)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && flat.length > 0) {
                e.preventDefault();
                setFocusIdx(0);
                linkRefs.current.get(flat[0]?.href)?.focus();
              }
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label="Clear search"
              style={{
                position: 'absolute',
                right: 6,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 4,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="2" y1="2" x2="10" y2="10" />
                <line x1="10" y1="2" x2="2" y2="10" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Nav groups ─────────────────────────── */}
      <nav className="sidebar-nav" ref={navRef} role="navigation" aria-label="Main navigation">
        {NAV.map((group) => {
          const filteredItems = isSearching
            ? group.items.filter(
                (item) => fuzzyMatch(item.label, search) || fuzzyMatch(group.category, search),
              )
            : group.items;

          if (filteredItems.length === 0) return null;

          const isCollapsed = !isSearching && collapsed[group.category];
          const hasActiveChild = group.items.some((item) => pathname === item.href);

          return (
            <div key={group.category} style={{ marginBottom: 2 }}>
              {/* Category header */}
              <button
                onClick={() => !isSearching && toggleCategory(group.category)}
                aria-expanded={!isCollapsed}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  width: '100%',
                  padding: '12px 12px 5px',
                  border: 'none',
                  background: 'none',
                  cursor: isSearching ? 'default' : 'pointer',
                  textAlign: 'left',
                  borderRadius: 6,
                  transition: 'background 150ms ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSearching) e.currentTarget.style.background = 'var(--sidebar-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'none';
                }}
              >
                {/* Chevron */}
                {!isSearching && (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    stroke="var(--text-dim)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transition: 'transform 200ms ease',
                      transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                      flexShrink: 0,
                    }}
                  >
                    <polyline points="2.5 3 5 5.5 7.5 3" />
                  </svg>
                )}
                {/* Category icon */}
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: hasActiveChild ? 'var(--primary)' : 'var(--text-dim)',
                    flexShrink: 0,
                    transition: 'color 150ms ease',
                  }}
                >
                  {group.icon}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: hasActiveChild ? 'var(--text-secondary)' : 'var(--text-dim)',
                    transition: 'color 150ms ease',
                    flex: 1,
                  }}
                >
                  {group.category}
                </span>
                {/* Category item count (when collapsed) */}
                {isCollapsed && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: 'var(--text-dim)',
                      background: 'var(--bg-elevated)',
                      padding: '1px 6px',
                      borderRadius: 100,
                      lineHeight: '16px',
                    }}
                  >
                    {group.items.length}
                  </span>
                )}
              </button>

              {/* Items */}
              <div
                style={{
                  overflow: 'hidden',
                  maxHeight: isCollapsed ? 0 : filteredItems.length * 40,
                  opacity: isCollapsed ? 0 : 1,
                  transition: 'max-height 250ms ease, opacity 200ms ease',
                }}
              >
                {filteredItems.map((item) => {
                  const active = pathname === item.href;
                  const count = counts?.[item.href] ?? counts?.[item.label];

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      ref={(el) => {
                        if (el) linkRefs.current.set(item.href, el);
                        else linkRefs.current.delete(item.href);
                      }}
                      className={`sidebar-link${active ? ' active' : ''}`}
                      tabIndex={0}
                      onFocus={() => {
                        const idx = flat.findIndex((f) => f.href === item.href);
                        if (idx >= 0) setFocusIdx(idx);
                      }}
                      style={{
                        position: 'relative',
                        borderLeft: active
                          ? '2.5px solid var(--primary)'
                          : '2.5px solid transparent',
                        marginLeft: 2,
                        paddingLeft: 10,
                        fontWeight: active ? 600 : 450,
                        background: active ? 'var(--sidebar-active)' : undefined,
                        color: active ? '#a5b4fc' : undefined,
                        transition: 'all 120ms ease, border-color 120ms ease, background 120ms ease',
                      }}
                    >
                      {/* Small dot indicator */}
                      <span
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: '50%',
                          background: active ? 'var(--primary)' : 'var(--text-dim)',
                          display: 'block',
                          flexShrink: 0,
                          transition: 'background 120ms ease, transform 120ms ease',
                          transform: active ? 'scale(1.3)' : 'scale(1)',
                        }}
                      />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.label}
                      </span>
                      {/* Count badge */}
                      {count != null && count > 0 && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            fontFamily: "'JetBrains Mono', monospace",
                            color: active ? 'var(--primary-hover)' : 'var(--text-dim)',
                            background: active
                              ? 'rgba(99,102,241,0.15)'
                              : 'var(--bg-elevated)',
                            padding: '1px 6px',
                            borderRadius: 100,
                            lineHeight: '16px',
                            flexShrink: 0,
                            transition: 'all 120ms ease',
                          }}
                        >
                          {count > 999 ? `${(count / 1000).toFixed(1)}k` : count}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* No results */}
        {isSearching && flat.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '24px 12px',
              color: 'var(--text-dim)',
              fontSize: 12,
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 16 16"
              fill="none"
              stroke="var(--text-dim)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }}
            >
              <circle cx="7" cy="7" r="4.5" />
              <line x1="10.5" y1="10.5" x2="14" y2="14" />
            </svg>
            No items match &ldquo;{search}&rdquo;
          </div>
        )}
      </nav>
    </aside>
  );
}
