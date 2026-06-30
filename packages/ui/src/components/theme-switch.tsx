'use client';

import { Button } from '@heroui/react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Theme is unknown on the server; render nothing until mounted to avoid hydration mismatch.
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = resolvedTheme === 'dark';
  return (
    <Button aria-label="Toggle theme" onPress={() => setTheme(isDark ? 'light' : 'dark')}>
      {isDark ? '☀︎' : '☾'}
    </Button>
  );
}
