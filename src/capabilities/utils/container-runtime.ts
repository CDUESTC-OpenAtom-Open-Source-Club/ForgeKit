import { runCommand } from './command.js';

export type ContainerRuntimeKind = 'docker' | 'podman' | 'unknown';

export interface ContainerRuntimeInfo {
  kind: ContainerRuntimeKind;
  version: string;
  compatibility: 'stable' | 'experimental' | 'unknown';
  displayName: string;
}

export function detectContainerRuntime(): ContainerRuntimeInfo {
  const cliVersion = runCommand('docker', ['--version'], { timeout: 10000 });
  const serverVersion = runCommand(
    'docker',
    ['version', '--format', '{{.Server.Version}}'],
    { timeout: 10000 }
  );
  const combined = `${cliVersion.stdout}\n${cliVersion.stderr}\n${serverVersion.stdout}\n${serverVersion.stderr}`;
  const version = serverVersion.stdout.trim() || extractVersion(combined) || 'unknown';

  if (/podman/i.test(combined)) {
    return {
      kind: 'podman',
      version,
      compatibility: 'experimental',
      displayName: `Podman Docker CLI compatibility (${version})`,
    };
  }

  if (/docker/i.test(combined) || serverVersion.success) {
    return {
      kind: 'docker',
      version,
      compatibility: 'stable',
      displayName: `Docker Engine (${version})`,
    };
  }

  return {
    kind: 'unknown',
    version,
    compatibility: 'unknown',
    displayName: `Unknown Docker-compatible runtime (${version})`,
  };
}

function extractVersion(value: string): string | undefined {
  return value.match(/\b\d+\.\d+(?:\.\d+)?(?:[-+][\w.-]+)?\b/)?.[0];
}
