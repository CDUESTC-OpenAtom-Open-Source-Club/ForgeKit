import { beforeEach, describe, expect, it, vi } from 'vitest';

const { runCommand } = vi.hoisted(() => ({ runCommand: vi.fn() }));
vi.mock('../../../../src/capabilities/utils/command.js', () => ({ runCommand }));

import { detectContainerRuntime } from '../../../../src/capabilities/utils/container-runtime.js';

beforeEach(() => runCommand.mockReset());

describe('detectContainerRuntime', () => {
  it('does not present Podman compatibility as Docker Engine support', () => {
    runCommand
      .mockReturnValueOnce({ success: true, exitCode: 0, stdout: 'podman version 4.9.4-rhel', stderr: '' })
      .mockReturnValueOnce({ success: true, exitCode: 0, stdout: '4.9.4-rhel', stderr: '' });
    expect(detectContainerRuntime()).toEqual(expect.objectContaining({
      kind: 'podman',
      compatibility: 'experimental',
      version: '4.9.4-rhel',
    }));
  });

  it('marks Docker Engine as stable', () => {
    runCommand
      .mockReturnValueOnce({ success: true, exitCode: 0, stdout: 'Docker version 28.1.1', stderr: '' })
      .mockReturnValueOnce({ success: true, exitCode: 0, stdout: '28.1.1', stderr: '' });
    expect(detectContainerRuntime()).toEqual(expect.objectContaining({
      kind: 'docker',
      compatibility: 'stable',
    }));
  });
});
