module.exports = {
  apps: [
    {
      name: "shop-os-api",
      script: "./dist/index.js",
      instances: 1,           // Set to 1 for Render Free Tier (512MB RAM)
      exec_mode: "fork",      // Cluster mode is unnecessary for 0.1 CPU
      env: {
        NODE_ENV: "production",
        RUN_WORKERS: "false", // Tells index.ts to NOT start any BullMQ workers here
        PORT: 4000
      }
    },
    {
      name: "shop-os-workers",
      script: "./dist/index.js",
      instances: 1,           // Do not run background workers in cluster mode (prevents job overlaps)
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        RUN_API: "false",     // Tells index.ts to ONLY boot the BullMQ queue listeners
        PORT: 4001
      }
    }
  ]
};
