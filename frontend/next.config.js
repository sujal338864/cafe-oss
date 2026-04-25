const { withSentryConfig } = require("@sentry/nextjs");

const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://cafe-oss.onrender.com',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cafe-oss.onrender.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },
};

module.exports = withSentryConfig(
  nextConfig,
  {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    // Suppresses source map uploading logs during bundling
    silent: true,
    org: "velorex",
    project: "javascript-nextjs",
  },
  {
    // For all available options, see:
    // https://github.com/getsentry/sentry-nextjs/blob/master/src/common/types.ts

    // Forces Sentry to tunnel through the Next.js rewrite so requests aren't blocked by adlink/trackers
    tunnelRoute: "/monitoring",

    // Hides source maps from the public browser build to prevent code leaks
    hideSourceMaps: true,

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,
  }
);
