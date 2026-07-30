import * as path from 'node:path';
import { inspectProject } from '../capabilities/inspect-project.js';
import { generatePackagingPlan } from '../capabilities/generate-packaging-plan.js';
import { preflightCheck } from '../capabilities/preflight-check.js';
import { buildDockerImage } from '../capabilities/build-docker-image.js';
import type {
  BuildDockerImageOutput,
  GeneratePackagingPlanOutput,
  InspectProjectOutput,
} from '../capabilities/types.js';
import type { PreflightCheckOutput } from '../capabilities/preflight-check.js';

export interface DeliverInput {
  sourceDir: string;
  imageName?: string;
  tag?: string;
  platform?: 'linux/amd64' | 'linux/arm64';
  containerPort?: number;
  healthcheckPath?: string;
}

export interface DeliverOutput {
  status: 'success' | 'failed';
  failed_stage?: 'inspect' | 'plan' | 'preflight' | 'build_or_runtime';
  inspect: InspectProjectOutput;
  plan?: GeneratePackagingPlanOutput;
  preflight?: PreflightCheckOutput;
  delivery?: BuildDockerImageOutput;
  evidence?: {
    image_ref?: string;
    build_log?: string;
    release_manifest: string;
    container_started: boolean;
    healthcheck_passed?: boolean;
  };
}

interface DeliverDependencies {
  inspect: typeof inspectProject;
  plan: typeof generatePackagingPlan;
  preflight: typeof preflightCheck;
  build: typeof buildDockerImage;
}

const defaultDependencies: DeliverDependencies = {
  inspect: inspectProject,
  plan: generatePackagingPlan,
  preflight: preflightCheck,
  build: buildDockerImage,
};

export async function deliverProject(
  input: DeliverInput,
  dependencies: DeliverDependencies = defaultDependencies
): Promise<DeliverOutput> {
  const sourceDir = path.resolve(input.sourceDir);
  const inspect = await dependencies.inspect(sourceDir);
  if (inspect.status !== 'success') {
    return { status: 'failed', failed_stage: 'inspect', inspect };
  }

  const plan = await dependencies.plan(sourceDir, ['Docker'], 'ubuntu-22.04');
  if (plan.status !== 'success' || !plan.plan_path) {
    return { status: 'failed', failed_stage: 'plan', inspect, plan };
  }

  // Intentionally use the complete default check set. A delivery command must not
  // silently skip Registry connectivity merely to make a cached build look green.
  const preflight = await dependencies.preflight({ source_dir: sourceDir, plan_path: plan.plan_path });
  if (!preflight.all_passed) {
    return { status: 'failed', failed_stage: 'preflight', inspect, plan, preflight };
  }

  const imageName = input.imageName || deriveImageName(sourceDir);
  const inferred = inspect.runtime_hints?.confidence !== 'low' ? inspect.runtime_hints : undefined;
  const containerPort = input.containerPort ?? inferred?.container_port;
  const healthcheckPath = input.healthcheckPath ?? inferred?.healthcheck_path;
  const delivery = await dependencies.build({
    source_dir: sourceDir,
    plan_path: plan.plan_path,
    image_name: imageName,
    tags: [input.tag || 'forgekit'],
    platform: input.platform || 'linux/amd64',
    verify_runtime: true,
    container_port: containerPort,
    healthcheck_path: healthcheckPath,
  });
  if (delivery.status !== 'success') {
    return { status: 'failed', failed_stage: 'build_or_runtime', inspect, plan, preflight, delivery };
  }

  return {
    status: 'success',
    inspect,
    plan,
    preflight,
    delivery,
    evidence: {
      image_ref: delivery.image_ref,
      build_log: delivery.build_log,
      release_manifest: path.join(sourceDir, 'release-manifest.json'),
      container_started: delivery.runtime_verification?.container_started === true,
      healthcheck_passed: delivery.runtime_verification?.healthcheck_passed,
    },
  };
}

function deriveImageName(sourceDir: string): string {
  const base = path.basename(sourceDir).toLowerCase().replace(/[^a-z0-9_.-]+/g, '-');
  return base.replace(/^[_.-]+|[_.-]+$/g, '') || 'forgekit-project';
}
