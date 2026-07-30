#!/usr/bin/env node

import { Command } from 'commander';
import { deliverProject } from './deliver.js';

const program = new Command();
interface DeliverCliOptions {
  image?: string;
  tag: string;
  platform: 'linux/amd64' | 'linux/arm64';
  port?: number;
  healthPath?: string;
}
program.name('forgekit').description('Inspect, build, start, and prove a project works').version('0.2.2-rc.1');

program
  .command('deliver')
  .description('Run inspect → plan → full preflight → build → runtime verification')
  .argument('[source]', 'project directory', '.')
  .option('--image <name>', 'image name')
  .option('--tag <tag>', 'image tag', 'forgekit')
  .option('--platform <platform>', 'linux/amd64 or linux/arm64', 'linux/amd64')
  .option('--port <number>', 'container port used for HTTP verification', parsePort)
  .option('--health-path <path>', 'HTTP health path, for example /health')
  .action(async (source: string, options: DeliverCliOptions) => {
    if (options.healthPath && !options.port) {
      program.error('--health-path requires --port');
    }
    if (!['linux/amd64', 'linux/arm64'].includes(options.platform)) {
      program.error('--platform must be linux/amd64 or linux/arm64');
    }
    const result = await deliverProject({
      sourceDir: source,
      imageName: options.image,
      tag: options.tag,
      platform: options.platform,
      containerPort: options.port,
      healthcheckPath: options.healthPath,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status !== 'success') {
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('port must be 1-65535');
  }
  return port;
}
