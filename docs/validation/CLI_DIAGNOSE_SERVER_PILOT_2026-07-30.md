# CLI diagnose server pilot — 2026-07-30

## Why this was tested

ForgeKit's high-intent pages promise structured Docker failure diagnosis, but the public CLI previously exposed only the full `deliver` flow. This test closes that acquisition-to-activation gap with a read-only command that accepts an existing log.

## Fixed input and revision

- ForgeKit revision: `88c945a`
- Public source case: <https://github.com/lance-format/lance-data-viewer/issues/62>
- Input excerpt: multi-source `COPY backend/*.py .` followed by Docker's requirement that the destination end in `/`
- Installation route: GitHub package through `npx`, using the explicit `forgekit` executable

## Isolated server verification

The command was run as root on `47.108.249.115` inside a new directory under `/root`. It did not modify Nginx, databases, Redis, firewall rules, registries, or the existing public site.

```bash
npx --yes \
  --package=github:CDUESTC-OpenAtom-Open-Source-Club/ForgeKit#88c945a \
  forgekit diagnose build.log
```

Observed result:

```json
{
  "status": "success",
  "code": "build_config_invalid",
  "confidence": "high",
  "input_source": "file"
}
```

The existing public site returned HTTP 200 after the test.

## Verification coverage

- Direct text, file and stdin inputs are covered by runtime smoke tests.
- Known diagnostics exit `0`; unknown diagnostics exit `1`; invalid input exits `2`.
- Installed-package smoke verifies the packaged `forgekit diagnose` executable.
- CI run <https://github.com/CDUESTC-OpenAtom-Open-Source-Club/ForgeKit/actions/runs/30555057068> passed Node 18, Node 20, type checking, the full test suite, installed-package smoke, real Docker runtime proof and the end-to-end contract.

## Evidence boundary

This proves that the public installation route can classify this public log on the target server. It does not prove that an external maintainer adopted the suggestion, completed a pilot, reused ForgeKit after seven days, or paid for a delivery. Those funnel counters remain zero until independently evidenced.
