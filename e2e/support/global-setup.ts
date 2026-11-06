import { execFileSync } from "node:child_process";
import { generatedFixturesDir, python, repoRoot } from "./environment";

export default function globalSetup(): void {
  execFileSync(python, ["e2e/support/build_fixtures.py", generatedFixturesDir], {
    cwd: repoRoot,
    env: { ...process.env, PYTHONPATH: "src" },
    stdio: "inherit",
  });
}
