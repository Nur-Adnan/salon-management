'use client';

import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';

// Dark mode via next-themes (HeroUI v3 reads the `class`/`data-theme` attribute).
// HeroUI v3 itself needs no provider.
export function UiProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  );
}
