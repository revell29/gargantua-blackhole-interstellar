/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: true,
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
  },
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"], // Ensure these packages are transpiled
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude Three.js from the server build
      config.externals.push("three");
    }
    return config;
  },
};

export default nextConfig;
