import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- -p 3000",
    url: "http://127.0.0.1:3000/api/check-env",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      ALLOW_GUEST_ACCESS: "true",
      ALLOW_LOCAL_SSRF: "true",
      PORT: "3000",
      AUTH_SECRET: "/qFU+YZy+FFr7NsaJQvtXEGfccdnOpLwYI7wDt2IEp8=",
      DATABASE_URL: "file:./dev.db",
      NEXTAUTH_URL: "http://127.0.0.1:3000",
      LOCAL_WORKSPACE_PATH: process.env.LOCAL_WORKSPACE_PATH || process.cwd(),
    },
  },
});
