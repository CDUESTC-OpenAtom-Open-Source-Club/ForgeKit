import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { runCommand } = vi.hoisted(() => ({ runCommand: vi.fn() }));
vi.mock('../../../src/capabilities/utils/command.js', () => ({
  commandExists: () => true,
  runCommand,
}));

import { preflightCheck } from '../../../src/capabilities/preflight-check.js';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgekit-local-base-'));
  runCommand.mockReset();
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('registry preflight with local base images', () => {
  it('passes without a network request when every Dockerfile base image exists locally', async () => {
    fs.writeFileSync(path.join(dir, 'Dockerfile'), 'FROM node:20-alpine AS build\nFROM node:20-alpine\n');
    runCommand.mockImplementation((_command: string, args: string[]) => ({
      success: args[0] === 'image' && args[1] === 'inspect' && args[2] === 'node:20-alpine',
      exitCode: 0, stdout: '', stderr: '',
    }));
    const result = await preflightCheck({ source_dir: dir, checks: ['registry_connectivity'] });
    expect(result.all_passed).toBe(true);
    expect(result.checks[0].details).toContain('不证明远端 Registry 可达');
    expect(runCommand).not.toHaveBeenCalledWith('curl', expect.anything());
  });

  it('still checks the Registry when any base image is missing locally', async () => {
    fs.writeFileSync(path.join(dir, 'Dockerfile'), 'FROM node:20-alpine\nFROM nginx:alpine\n');
    runCommand.mockImplementation((command: string, args: string[]) => {
      if (command === 'curl') {
        return { success: false, exitCode: 7, stdout: '000', stderr: 'unreachable' };
      }
      return { success: args[2] === 'node:20-alpine', exitCode: 1, stdout: '', stderr: '' };
    });
    const result = await preflightCheck({ source_dir: dir, checks: ['registry_connectivity'] });
    expect(result.all_passed).toBe(false);
    expect(runCommand).toHaveBeenCalledWith('curl', expect.any(Array));
  });
});
