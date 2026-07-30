# Public case: ghidra-mcp fixed GID conflict — 2026-07-30

## Source

- Public issue: <https://github.com/bethington/ghidra-mcp/issues/416>
- Retrieved: 2026-07-30
- Reported failure: `groupadd: GID '1000' already exists` while building from `eclipse-temurin:21-jdk`

## Before

ForgeKit accepted the log but returned `unknown_error` with low confidence. No existing rule distinguished a fixed container UID/GID collision from a generic command failure.

## Diagnostic change

The public excerpt is now part of the provenance-preserving regression corpus. ForgeKit reports:

- code: `build_config_invalid`
- category: `dockerfile`
- confidence: `high`
- cause: the Dockerfile's fixed user/group identity conflicts with an identity already present in the selected base image

The suggested action intentionally begins with read-only `getent passwd` / `getent group` checks. It recommends either deliberately reusing the suitable existing group or selecting a configurable, unoccupied ID. It does not suggest deleting base-image accounts, recursively opening permissions, or hiding the collision.

## Verification boundary

Local tests confirm the public log is classified consistently and that the advice does not contain `groupdel`. The complete public development corpus remains 12/12 correct, with no duplicate logs or detected sensitive strings.

This does not prove that the issue reporter adopted the recommendation or that the upstream image now builds and runs. Upstream confirmation is required before counting a completed pilot or runtime verification.
