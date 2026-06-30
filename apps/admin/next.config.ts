import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // @salon/ui ships TypeScript source; Next compiles it. @salon/shared ships built JS.
  transpilePackages: ['@salon/ui'],
};

export default withNextIntl(nextConfig);
