/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/**/*": ["./prisma/**/*"],
      "/**/*": ["./prisma/**/*"],
    },
  },
  async redirects() {
    return [
      {
        source: "/workspace",
        destination: "/workspace/new",
        permanent: false,
      },
      {
        source: "/dashboard",
        destination: "/workspace/new",
        permanent: false,
      },
      {
        source: "/app",
        destination: "/workspace/new",
        permanent: false,
      },
      {
        source: "/projects",
        destination: "/workspace/new",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
