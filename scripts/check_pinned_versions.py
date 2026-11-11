"""Fail when versions that are pinned by hand in two places have drifted apart.

Dependabot bumps ``package-lock.json`` and the ``FROM`` images in the Dockerfile,
but it cannot update a workflow's container image tag or an action's ``version``
input. This check keeps those hand-written pins in step with the files that are
updated automatically:

- the Playwright container image in ``.github/workflows/ci.yml`` must match the
  ``@playwright/test`` version installed by ``package-lock.json``, because the
  image ships the browsers for exactly that release;
- the uv version installed by ``astral-sh/setup-uv`` in the workflow must match
  the uv image the Dockerfile copies the binary from, so CI and the deployed
  image resolve the lock file with the same resolver.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORKFLOW = ROOT / ".github" / "workflows" / "ci.yml"
PACKAGE_LOCK = ROOT / "package-lock.json"
DOCKERFILE = ROOT / "Dockerfile"

PLAYWRIGHT_IMAGE_RE = re.compile(r"mcr\.microsoft\.com/playwright:v(?P<version>[\d.]+)-")
SETUP_UV_VERSION_RE = re.compile(
    r'uses: astral-sh/setup-uv@[^\n]*\n\s+with:\n\s+version: "(?P<version>[^"]+)"'
)
DOCKER_UV_IMAGE_RE = re.compile(r"ghcr\.io/astral-sh/uv:(?P<version>[\d.]+)")


def single_value(name: str, values: set[str]) -> str:
    """Return the one value found for a pin, failing when it is missing or inconsistent."""
    if len(values) != 1:
        raise SystemExit(f"{name}: expected exactly one version, found {sorted(values) or 'none'}")
    return values.pop()


def playwright_image_version(workflow: str) -> str:
    """Return the Playwright release named by the CI container image tag."""
    return single_value("Playwright image in ci.yml", set(PLAYWRIGHT_IMAGE_RE.findall(workflow)))


def playwright_package_version(lock: dict[str, object]) -> str:
    """Return the @playwright/test version pinned by the npm lock file."""
    packages = lock.get("packages")
    if not isinstance(packages, dict):
        raise SystemExit("package-lock.json has no packages table")
    entry = packages.get("node_modules/@playwright/test")
    if not isinstance(entry, dict) or not isinstance(entry.get("version"), str):
        raise SystemExit("package-lock.json does not pin @playwright/test")
    return entry["version"]


def setup_uv_version(workflow: str) -> str:
    """Return the uv version every setup-uv step in the workflow installs."""
    return single_value("setup-uv version in ci.yml", set(SETUP_UV_VERSION_RE.findall(workflow)))


def dockerfile_uv_version(dockerfile: str) -> str:
    """Return the uv version the Dockerfile copies its binary from."""
    return single_value("uv image in Dockerfile", set(DOCKER_UV_IMAGE_RE.findall(dockerfile)))


def main() -> int:
    """Compare each pair of pins and report every mismatch."""
    workflow = WORKFLOW.read_text()
    lock = json.loads(PACKAGE_LOCK.read_text())
    dockerfile = DOCKERFILE.read_text()

    pairs = [
        (
            "Playwright",
            playwright_image_version(workflow),
            "ci.yml container image",
            playwright_package_version(lock),
            "package-lock.json @playwright/test",
        ),
        (
            "uv",
            setup_uv_version(workflow),
            "ci.yml setup-uv version",
            dockerfile_uv_version(dockerfile),
            "Dockerfile uv image",
        ),
    ]
    failures = 0
    for name, left, left_source, right, right_source in pairs:
        if left == right:
            print(f"{name}: {left} ({left_source} == {right_source})")
        else:
            failures += 1
            print(
                f"::error::{name} pins disagree: {left_source} has {left}, "
                f"{right_source} has {right}. Bump both together."
            )
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
