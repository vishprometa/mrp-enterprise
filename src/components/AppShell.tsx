'use client';

import { useState } from 'react';
import TopBar from './TopBar';
import AiChat from './AiChat';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <>
      <TopBar onOpenAI={() => setAiOpen(true)} />
      {children}
      <AiChat open={aiOpen} onClose={() => setAiOpen(false)} />
    </>
  );
}
