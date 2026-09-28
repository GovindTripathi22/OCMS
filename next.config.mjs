/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/**/*": ["./prisma/**/*"],
      "/**/*": ["./prisma/**/*"],
    },
  },
};

export default nextConfig;
