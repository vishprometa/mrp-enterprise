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
    <div className="top-bar">
      <div className="top-bar-section">
        <nav className="top-bar-breadcrumb">
          <span>Home</span>
          <span className="separator">/</span>
          <span>{meta.category}</span>
          <span className="separator">/</span>
          <span className="current">{meta.title}</span>
        </nav>
      </div>

      <div className="top-bar-actions">
        {/* Search trigger */}
        <button className="top-bar-search" type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>Search...</span>
          <kbd>⌘K</kbd>
        </button>

        {/* Theme toggle */}
        <button
          className="top-bar-icon-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
        >
          {theme === 'dark' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        {/* Ask AI button */}
        <button className="top-bar-ai-btn" onClick={onOpenAI}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" />
          </svg>
          Ask AI
        </button>

        {/* Notifications */}
        <button className="top-bar-icon-btn" title="Notifications">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="notification-dot" />
        </button>

        {/* Avatar */}
        <div className="top-bar-avatar">VM</div>
      </div>
    </div>
  );
}
