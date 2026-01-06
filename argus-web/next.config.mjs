/** @type {import('next').NextConfig} */
const nextConfig = {
  // Matikan pengecekan ESLint saat build
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Matikan pengecekan error TypeScript saat build
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;