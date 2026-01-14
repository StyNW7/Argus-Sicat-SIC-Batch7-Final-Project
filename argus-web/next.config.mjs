/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // devIndicators: {
  //   buildActivity: false,
  //   appIsrStatus: false,
  // },
};

export default nextConfig;