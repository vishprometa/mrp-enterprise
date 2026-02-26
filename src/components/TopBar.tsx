'use client';

import { usePathname } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';

const PAGE_META: Record<string, { title: string; category: string }> = {
  '/': { title: 'Dashboard', category: 'Overview' },
  '/mrp': { title: 'MRP Simulation', category: 'Overview' },
  '/analytics': { title: 'Analytics', category: 'Overview' },
  '/audit': { title: 'Activity Log', category: 'Overview' },
  '/items': { title: 'Items', category: 'Master Data' },
  '/suppliers': { title: 'Suppliers', category: 'Master Data' },
  '/customers': { title: 'Customers', category: 'Master Data' },
  '/warehouses': { title: 'Warehouses', category: 'Master Data' },
  '/work-centers': { title: 'Work Centers', category: 'Master Data' },
  '/uom': { title: 'Units of Measure', category: 'Master Data' },
  '/bom': { title: 'Bill of Materials', category: 'Engineering' },
  '/bom-lines': { title: 'BOM Lines', category: 'Engineering' },
  '/bom-explosion': { title: 'BOM Explosion', category: 'Engineering' },
  '/routings': { title: 'Routings', category: 'Engineering' },
  '/routing-ops': { title: 'Routing Ops', category: 'Engineering' },
  '/purchase-orders': { title: 'Purchase Orders', category: 'Purchasing' },
  '/po-lines': { title: 'PO Lines', category: 'Purchasing' },
  '/sales-orders': { title: 'Sales Orders', category: 'Sales' },
  '/so-lines': { title: 'SO Lines', category: 'Sales' },
  '/production-orders': { title: 'Production Orders', category: 'Manufacturing' },
  '/prod-ops': { title: 'Prod Operations', category: 'Manufacturing' },
  '/inventory': { title: 'Inventory', category: 'Inventory' },
  '/inv-transactions': { title: 'Transactions', category: 'Inventory' },
  '/forecasts': { title: 'Demand Forecasts', category: 'Planning' },
  '/mrp-runs': { title: 'MRP Runs', category: 'Planning' },
  '/mrp-recs': { title: 'Recommendations', category: 'Planning' },
  '/inspections': { title: 'Inspections', category: 'Quality' },
  '/check-items': { title: 'Check Items', category: 'Quality' },
  '/capacity': { title: 'Capacity Plans', category: 'Capacity & Finance' },
  '/cost-centers': { title: 'Cost Centers', category: 'Capacity & Finance' },
};

interface TopBarProps {
  onOpenAI: () => void;
}

export default function TopBar({ onOpenAI }: TopBarProps) {
  const pathname = usePathname();
  const { theme, toggle: toggleTheme } = useTheme();

  const meta = PAGE_META[pathname] || { title: 'Page', category: 'App' };

  return (
    <div
      style={{
        height: 52,
        minHeight: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--bg-card)',
        gap: 16,
      }}
    >
      {/* Left: Breadcrumb + Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ color: 'var(--text-dim)' }}>Home</span>
          <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>/</span>
          <span style={{ color: 'var(--text-dim)' }}>{meta.category}</span>
          <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>/</span>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{meta.title}</span>
        </nav>
      </div>

      {/* Right: Search, Theme, AI, Notifications */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-dim)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            style={{
              height: 32,
              width: 200,
              paddingLeft: 32,
              paddingRight: 12,
              fontSize: 13,
              border: '1px solid var(--border)',
              borderRadius: 6,
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text)',
              outline: 'none',
            }}
          />
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border)',
            borderRadius: 6,
            backgroundColor: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {theme === 'dark' ? (
            /* Sun icon */
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            /* Moon icon */
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        {/* Ask AI Button */}
        <button
          onClick={onOpenAI}
          style={{
            height: 32,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 12px',
            fontSize: 13,
            fontWeight: 500,
            border: 'none',
            borderRadius: 6,
            backgroundColor: 'var(--primary)',
            color: '#fff',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {/* Sparkle icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" />
          </svg>
          Ask AI
        </button>

        {/* Notification Bell */}
        <button
          title="Notifications"
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border)',
            borderRadius: 6,
            backgroundColor: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            position: 'relative',
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {/* Decorative dot */}
          <span
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: '#ef4444',
            }}
          />
        </button>
      </div>
    </div>
  );
}
