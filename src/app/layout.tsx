import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AppShell } from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'MRP Enterprise',
  description: 'Enterprise Material Requirements Planning System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try { const t = localStorage.getItem('mrp-theme'); if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark'); }
          catch(e) {}
        ` }} />
      </head>
      <body>
        <ThemeProvider>
          <div className="app-layout">
            <Sidebar />
            <main className="app-main">
              <AppShell>
                {children}
              </AppShell>
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
