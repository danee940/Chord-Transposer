import { defineConfig, devices } from "@playwright/test";
import {
  appPort,
  appUrl,
  gotenbergPort,
  gotenbergUrl,
  pdfConversionFailureMarker,
  python,
  repoRoot,
} from "./e2e/support/environment";

const isCI = process.env["CI"] !== undefined;
const MOBILE_TAG = /@mobile/;

export default defineConfig({
  testDir: "e2e/specs",
  outputDir: "test-results",
  globalSetup: "./e2e/support/global-setup.ts",
  fullyParallel: true,
  timeout: isCI ? 60_000 : 30_000,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : "25%",
  reporter: isCI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: appUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] }, grep: MOBILE_TAG },
    { name: "mobile-safari", use: { ...devices["iPhone 15"] }, grep: MOBILE_TAG },
  ],
  webServer: [
    {
      name: "fake-gotenberg",
      command: `"${python}" e2e/support/fake_gotenberg.py ${gotenbergPort} "${pdfConversionFailureMarker}"`,
      cwd: repoRoot,
      url: `${gotenbergUrl}/health`,
      reuseExistingServer: false,
    },
    {
      name: "app",
      command:
        `"${python}" -m gunicorn --chdir src --config src/gunicorn.conf.py ` +
        `--bind 127.0.0.1:${appPort} --access-logfile /dev/null app:app`,
      cwd: repoRoot,
      url: `${appUrl}/health`,
      reuseExistingServer: false,
      env: { GOTENBERG_URL: gotenbergUrl, LOG_LEVEL: "WARNING", GUNICORN_LOG_LEVEL: "warning" },
    },
  ],
});
