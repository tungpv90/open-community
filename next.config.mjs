const isDevelopment = process.env.NODE_ENV === 'development';
const useStandaloneOutput = process.env.BUILD_STANDALONE === '1' || process.platform !== 'win32';

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(useStandaloneOutput ? { output: 'standalone' } : {}),
  distDir: isDevelopment ? '.next-dev' : '.next',
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=()' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
