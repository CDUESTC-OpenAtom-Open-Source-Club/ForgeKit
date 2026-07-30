#!/usr/bin/env node

import { Command } from 'commander';
import { diagnoseBuildFailure } from '../capabilities/diagnose-build-failure.js';
import { deliverProject } from './deliver.js';

const program = new Command();
interface DeliverCliOptions {
  image?: string;
  tag: string;
  platform: 'linux/amd64' | 'linux/arm64';
  port?: number;
  healthPath?: string;
}
interface DiagnoseCliOptions {
  file?: string;
  text?: string;
}
program.name('forgekit').description('Inspect, build, start, and prove a project works').version('0.2.2-rc.1');

program
  .command('diagnose')
  .description('Diagnose a Docker/build failure log without modifying the project')
  .argument('[log-file]', 'log file path, or - to read from stdin')
  .option('--file <path>', 'log file path (same as the positional argument)')
  .option('--text <log>', 'diagnose log text supplied directly')
  .action(async (logFile: string | undefined, options: DiagnoseCliOptions) => {
    const supplied = [logFile !== undefined, options.file !== undefined, options.text !== undefined]
      .filter(Boolean).length;
    if (supplied > 1) {
      program.error('provide exactly one of [log-file], --file, or --text');
    }

    let result: ReturnType<typeof diagnoseBuildFailure>;
    if (options.text !== undefined) {
      result = diagnoseBuildFailure({ log_text: options.text });
    } else {
      const file = options.file ?? logFile;
      if (file && file !== '-') {
        result = diagnoseBuildFailure({ source_dir: process.cwd(), log_path: file });
      } else if (!process.stdin.isTTY) {
        result = diagnoseBuildFailure({ log_text: await readStdin() });
      } else {
        program.error('provide a log file, --text, or pipe a log to stdin');
        return;
      }
    }

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status !== 'success') {
      process.exitCode = 2;
    } else if (result.diagnosis?.code === 'unknown_error') {
      process.exitCode = 1;
    }
  });

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

async function readStdin(): Promise<string> {
  let text = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin as AsyncIterable<string>) {
    text += chunk;
  }
  return text;
}
