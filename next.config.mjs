const basePath = process.env.NEXT_PUBLIC_BASE_PATH
  ? `/${process.env.NEXT_PUBLIC_BASE_PATH.replace(/^\/+|\/+$/g, '')}`
  : '';

// When building for a subpath-proxied preview (no NEXT_PUBLIC_BASE_PATH set),
// use a relative assetPrefix so the site works under an opaque path prefix.
const assetPrefix = basePath || './';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
  images: { unoptimized: true },
  trailingSlash: true,
  basePath,
  assetPrefix,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
