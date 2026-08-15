import type { ErrorCode, ForgeKitResult } from '../types.js';

export type DiagnosticCategory =
  | 'environment'
  | 'path'
  | 'dockerfile'
  | 'dependency'
  | 'registry'
  | 'architecture'
  | 'permission'
  | 'disk'
  | 'runtime'
  | 'unknown';

export type DiagnosticConfidence = 'high' | 'medium' | 'low';

export interface ErrorDiagnostic {
  code: ErrorCode;
  category: DiagnosticCategory;
  summary: string;
  probable_cause: string;
  confidence: DiagnosticConfidence;
  evidence: string[];
  suggested_actions: string[];
  verification: string[];
  suggested_fix: string;
  related_rules?: string[];
  severity: 'error' | 'warning' | 'info';
}

interface DiagnosticRule {
  pattern: RegExp;
  diagnostic: Omit<ErrorDiagnostic, 'evidence' | 'suggested_fix'>;
}

const DIAGNOSTIC_RULES: DiagnosticRule[] = [
  rule(
    /cannot find module ['"]\/(?:app|workspace|usr\/src\/app)\/[^'"]+['"]|python: can't open file ['"]\/(?:app|workspace|usr\/src\/app)\/[^'"]+['"]|exec .*: no such file or directory/i,
    'container_entrypoint_not_found', 'runtime', '容器启动入口不存在',
    '镜像已经形成，但 Dockerfile 的 CMD/ENTRYPOINT 指向了镜像内不存在的文件或命令。',
    ['核对 Dockerfile 的 CMD/ENTRYPOINT 与项目真实入口；Node 项目优先使用已声明且可运行的 npm start，Python 项目使用实际存在的入口文件。'],
    ['启动最终镜像并检查容器保持运行；如提供健康端点，再验证其返回成功状态。']
  ),
  rule(
    /docker daemon not running|cannot connect to the docker daemon|is the docker daemon running/i,
    'docker_daemon_unavailable', 'environment', 'Docker 守护进程未运行或不可用',
    'Docker 客户端存在，但当前 Docker context 无法连接到守护进程。',
    ['启动当前平台的 Docker 运行时，并确认所选 Docker context 正确；Linux systemd 环境可由有权限的用户运行 `systemctl start docker`。'],
    ['运行 `docker info`，确认 Server 部分能够正常返回。']
  ),
  rule(
    /permission denied[^\n]*(docker\.sock|docker daemon)|connect: permission denied/i,
    'docker_permission_denied', 'permission', '当前用户无权访问 Docker',
    '当前用户不能访问 Docker socket 或所选 Docker context。',
    ['检查 `docker context show` 和 Docker socket 的所有者；在 Linux 上按 Docker 官方 post-install 指引配置用户权限，避免直接放宽 socket 权限。'],
    ['重新登录后运行 `docker info`，确认无需提权即可连接。']
  ),
  rule(
    /no such file[^\n]*dockerfile|dockerfile not found|failed to read dockerfile/i,
    'dockerfile_not_found', 'path', 'Dockerfile 不存在或不可读',
    '传入的 Dockerfile 路径错误，或该文件不在当前构建上下文中。',
    ['确认 `-f` 指向的文件存在且可读，并核对构建上下文目录。'],
    ['运行 `test -r <Dockerfile路径>`，再使用相同的 `docker build -f ...` 参数重试。']
  ),
  rule(
    /copy failed[^\n]*(no such file|not found)|failed to calculate checksum[^\n]*(not found|no such file)|failed to compute cache key[^\n]*(not found|no such file)/i,
    'docker_copy_failed', 'path', 'Docker COPY/ADD 引用的文件不存在',
    'Dockerfile 引用的源路径不在构建上下文中，或被 `.dockerignore` 排除。',
    ['从构建上下文根目录核对 COPY/ADD 源路径，并检查 `.dockerignore`。'],
    ['确认目标文件能从构建上下文根目录访问，然后重新构建。'],
    'high', ['dockerfile_best_practices']
  ),
  rule(
    /when using copy with more than one source file[^\n]*destination must be a directory[^\n]*end with a \/|copy failed[^\n]*multiple source files[^\n]*destination[^\n]*directory/i,
    'build_config_invalid', 'dockerfile', 'Docker COPY 多源目标必须使用明确目录路径',
    'COPY 的通配符或多个源展开为多个文件；Docker classic builder 要求目标使用以 `/` 结尾的目录路径。部分 Podman 版本可能接受 `.`，但这不具备跨运行时可移植性。',
    ['将目标改为明确且以 `/` 结尾的目录，例如把 `COPY backend/*.py .` 改为 `COPY backend/*.py ./`。'],
    ['使用完全相同的 build context 和 Dockerfile 重试，确认 COPY 步骤通过；随后启动镜像验证应用。'],
    'high', ['dockerfile_best_practices']
  ),
  rule(
    /dockerfile parse error|failed to parse dockerfile|unknown instruction|syntax error[^\n]*dockerfile/i,
    'build_config_invalid', 'dockerfile', 'Dockerfile 语法无效',
    'Dockerfile 包含无法解析的指令、续行或参数。',
    ['根据证据中的行号检查对应指令；可先运行 Dockerfile lint 工具。'],
    ['修正后重新运行相同的 `docker build` 命令，确认解析阶段通过。']
  ),
  rule(
    /groupadd:\s*(?:gid ['"]?\d+['"]? already exists|group ['"][^'"]+['"] already exists)|useradd:\s*(?:uid ['"]?\d+['"]? is not unique|user ['"][^'"]+['"] already exists)/i,
    'build_config_invalid', 'dockerfile', '容器用户或组的固定 ID 与基础镜像冲突',
    'Dockerfile 创建用户或组时写死了基础镜像中已经存在的 UID/GID 或名称；更换基础镜像版本后，预占用的身份可能发生变化。',
    ['先在相同基础镜像中用 `getent passwd <UID>` 和 `getent group <GID>` 确认占用者；随后显式复用合适的现有组，或把 UID/GID 设计为可配置且选择未占用值。不要删除基础镜像账号或放宽文件权限来绕过冲突。'],
    ['使用相同基础镜像摘要和构建参数重试；启动最终镜像，并确认进程以预期的非 root UID/GID 运行且所需目录可读写。'],
    'high', ['dockerfile_best_practices']
  ),
  rule(
    /npm err![\s\S]{0,500}\beresolve\b|eresolve unable to resolve dependency tree/i,
    'npm_dependency_conflict', 'dependency', 'npm 依赖约束冲突',
    '项目中的直接依赖与 peer dependency 约束无法同时满足。',
    ['运行 `npm explain <包名>` 定位冲突来源，并优先调整显式版本约束；不要把 `--legacy-peer-deps` 作为默认修复。'],
    ['在干净目录运行 `npm ci`，并执行项目测试确认依赖树有效。']
  ),
  rule(
    /could not resolve dependency(?! tree)|conflicting peer de\bs?enden|conflicting peer dependency|while resolving:[^\n]*\bfound:[\s\S]{0,300}\bpeer [^:\n]* from [^\n]+/i,
    'npm_dependency_conflict', 'dependency', 'npm peer dependency 冲突',
    '`npm install` 因 peer dependency 无法同时满足而退出 ERESOLVE；通常是直接依赖锁定的版本与某个 peer 要求的范围不一致，而不是缓存或网络问题。',
    ['用 `npm explain <包名>` 定位冲突链，优先调整显式版本约束或升级冲突包；不要把 `--legacy-peer-deps` 作为默认修复。'],
    ['在干净目录运行 `npm ci`，确认依赖树与锁文件有效。']
  ),
  rule(
    /err:4[^\n]* (?:inrel|release|inrelease|packages)[^\n]*404[^\n]*not found|apt[^\n]*(?:404\s{2}not found|not found)[^\n]*release|eol|end[ -]of[ -]life/i,
    'distribution_unsupported', 'dependency', '发行版仓库已被 EOL / 不可达',
    'apt 源指向的发行版版本已到生命末期或 404，`apt update` 无法获得 Release 文件。',
    ['核对基础镜像的发行版版本与官方支持窗口；把镜像或源迁移到仍在支持的发行版，再在同一构建层内更新索引。'],
    ['在相同基础镜像内 `apt-get update` 成功，并确认所用仓库未被 EOL / 停用。'],
    'high', ['dockerfile_best_practices']
  ),
  rule(
    /npm ci can only install packages when[^\n]*(package-lock|npm-shrinkwrap)|package\.json and package-lock\.json are not in sync/i,
    'npm_dependency_conflict', 'dependency', 'npm 锁文件与 package.json 不一致',
    '`package-lock.json` 没有反映当前 `package.json` 的依赖约束。',
    ['在受信任的开发环境运行 `npm install` 更新锁文件，审查差异后提交。'],
    ['在干净目录重新运行 `npm ci`。']
  ),
  rule(
    /resolutionimpossible|cannot install [^\n]+ because these package versions have conflicting dependencies|conflicting dependencies/i,
    'pip_dependency_conflict', 'dependency', 'Python 依赖约束冲突',
    '两个或更多 Python 依赖要求了不兼容的版本范围。',
    ['查看 pip 报告的冲突链，放宽或统一顶层版本约束；不要同时固定互斥版本。'],
    ['在新的虚拟环境重新安装，并运行 `pip check`。']
  ),
  rule(
    /could not find a version that satisfies the requirement|no matching distribution found/i,
    'pip_package_not_found', 'dependency', 'pip 找不到兼容的包版本',
    '包名、版本约束、Python 版本、平台架构或索引源与可用发行版不兼容。',
    ['核对包名和版本范围，并检查当前 Python 版本、平台架构及 pip 索引配置。'],
    ['运行 `python -m pip index versions <包名>`，确认存在兼容版本后重试。']
  ),
  rule(
    /modulenotfounderror|module not found|cannot find module/i,
    'module_not_found', 'runtime', '应用运行时缺少模块',
    '依赖未安装、安装在错误环境，或生产依赖被错误排除。',
    ['确认缺失模块所属依赖已声明在项目清单中，并使用项目清单执行 `pip install`/`npm install`，不要只在运行中的容器临时安装。'],
    ['在最终镜像中执行最小 import/require 检查。']
  ),
  rule(
    /unable to locate package|no package matching [^\n]+ is available/i,
    'system_package_not_found', 'dependency', '系统包管理器找不到软件包',
    '软件包名称、发行版仓库或软件源索引与基础镜像不匹配。',
    ['核对基础镜像发行版和包名，并确保更新索引与安装发生在同一个构建层。'],
    ['在相同基础镜像中查询该包，确认仓库确实提供后再构建。']
  ),
  rule(
    /port[^\n]*already in use|\beaddrinuse\b|address already in use/i,
    'port_conflict', 'runtime', '端口已被占用',
    '容器或应用准备绑定的主机端口已被其他进程占用。',
    ['使用 `lsof -i :<端口>` 或平台等价工具确认占用者，再选择停止冲突服务或更换映射端口。'],
    ['使用新的端口映射启动容器，并检查应用健康状态。']
  ),
  rule(
    /no space left on device|not enough free disk space|write [^\n]*: no space left/i,
    'disk_space_exhausted', 'disk', '构建环境磁盘空间不足',
    'Docker 数据目录或构建上下文所在分区没有足够空间。',
    ['检查主机和 Docker 数据目录空间，确认无用缓存后再由用户决定是否清理。'],
    ['运行 `df -h` 和 `docker system df`，确认有足够空间后重试。']
  ),
  rule(
    /unauthorized: authentication required|pull access denied|requested access to the resource is denied/i,
    'registry_auth_failed', 'registry', '镜像仓库认证或授权失败',
    '当前凭据无效、已过期，或账号没有访问目标镜像的权限。',
    ['核对 Registry 地址和镜像名，并通过安全的凭据存储重新认证；不要把 Token 写入 Dockerfile。'],
    ['单独运行 `docker pull <镜像>`，确认当前账号具备访问权限。']
  ),
  rule(
    /network is unreachable|enetunreach|dial tcp[^\n]*i\/o timeout|tls handshake timeout|temporary failure in name resolution/i,
    'network_unreachable', 'registry', '构建期间网络或 DNS 不可达',
    '主机网络、DNS、代理或 Registry 连接在依赖下载阶段失败。',
    ['先确认主机能够解析并连接日志中的域名，再检查 Docker daemon 的代理、DNS 和所配置镜像源。'],
    ['单独拉取基础镜像或访问失败的依赖端点，确认连接恢复。']
  ),
  rule(
    /exec format error|no matching manifest for [^\n]+ in the manifest list/i,
    'architecture_mismatch', 'architecture', '镜像或可执行文件架构不匹配',
    '目标平台与基础镜像、构建产物或当前运行主机的 CPU 架构不一致。',
    ['核对 `--platform`、基础镜像 manifest 和编译目标架构，避免混用不同架构产物。'],
    ['运行 `docker image inspect <镜像>` 检查 Architecture/Os，并在目标架构环境做运行验证。']
  ),
  rule(
    /permission denied|\beacces\b|operation not permitted/i,
    'permission_denied', 'permission', '文件或命令权限不足',
    '构建步骤使用的用户对目标路径或命令没有所需权限。',
    ['检查失败路径的所有者、权限和当前 USER；只修正必要路径，避免递归放宽权限或无条件使用 sudo。'],
    ['以 Dockerfile 中相同用户执行最小读写或执行检查。'],
    'medium'
  ),
  // ===== 鸿蒙（HarmonyOS）专属诊断 =====
  rule(
    /hvigorw: command not found|command not found: hvigorw|Failed to load the hvigor|Cannot find module ['"]@ohos\/hvigor/i,
    'harmony_sdk_not_found', 'environment', '鸿蒙构建工具链不可用',
    'hvigorw / hvigor 未安装或未加入 PATH，或工程缺少 @ohos/hvigor 依赖。',
    ['安装 DevEco Studio 或 HarmonyOS Command Line Tools，并将其 bin 加入 PATH；确认工程已执行 `ohpm install`。'],
    ['运行 `hvigorw --version` 确认构建工具可用后再构建。']
  ),
  rule(
    /signingConfig ['"][^'"]+['"] (not found|is not defined)|certificate verify failed|signing config .* invalid|keystore .* not found/i,
    'harmony_signing_invalid', 'dependency', '鸿蒙签名配置无效或缺失',
    'build-profile.json5 中引用的 signingConfig 不存在，或证书/密钥库文件缺失、密码错误。',
    ['核对 build-profile.json5 的 signingConfigs 名称与 products.signingConfig 是否一致；确认 .cer/.p12/.p7b 路径正确且密码有效。'],
    ['用 AGC 正式签名重新配置后，运行 `hvigorw assembleApp` 验证。']
  ),
  rule(
    /compatibleSdkVersion .* (not satisfied|mismatch)|SDK version .* mismatch|the device does not support|targetSdkVersion .* invalid/i,
    'harmony_compatible_version_mismatch', 'runtime', '鸿蒙 API 版本不兼容',
    '工程的 compatibleSdkVersion / targetSdkVersion 与目标设备或构建环境不匹配。',
    ['将 build-profile.json5 / app.json5 的 compatibleSdkVersion 调整到目标设备支持的 API；确认 DevEco Command Line Tools 版本覆盖该 API。'],
    ['在目标 API 的 SDK 环境下重新构建并安装验证。']
  ),
  rule(
    /bundleName .* (invalid|is not valid|format error)|bundle name .* invalid/i,
    'harmony_bundle_name_invalid', 'runtime', 'bundleName 格式不合法',
    'app.json5 中的 bundleName 不符合反向域名规范（如 com.example.app）。',
    ['将 bundleName 改为反向域名格式，且须与 AppGallery Connect 创建应用时填写的一致。'],
    ['重新构建前确认 bundleName 与 AGC 应用记录完全一致。']
  ),
  rule(
    /profile .*\.p7b .* (not found|verification failed|invalid)|profile verification failed|Provision .* not found/i,
    'harmony_profile_missing', 'dependency', '鸿蒙发布 Profile 缺失或无效',
    '发布构建缺少 .p7b Profile，或 Profile 与证书/bundleName/设备不匹配。',
    ['在 AppGallery Connect 创建发布 Profile(.p7b) 并绑定当前证书与应用，放入工程后重新配置 signingConfigs。'],
    ['配置正式 Profile 后运行 `hvigorw assembleApp` 验证。']
  ),
  rule(
    /ohpm ERROR|ohpm .* failed|dependency resolve failed|Cannot find module ['"]@ohos\//i,
    'module_not_found', 'dependency', 'ohpm 依赖解析失败',
    '鸿蒙工程依赖未安装或版本冲突（ohpm 源/网络/版本约束问题）。',
    ['运行 `ohpm install` 安装依赖；核对 oh-package.json5 的版本约束与可用仓库；必要时切换镜像源。'],
    ['在干净目录重新执行 `ohpm install` 后构建。']
  ),
];

function rule(
  pattern: RegExp,
  code: ErrorCode,
  category: DiagnosticCategory,
  summary: string,
  probableCause: string,
  suggestedActions: string[],
  verification: string[],
  confidence: DiagnosticConfidence = 'high',
  relatedRules?: string[]
): DiagnosticRule {
  return {
    pattern,
    diagnostic: {
      code,
      category,
      summary,
      probable_cause: probableCause,
      confidence,
      suggested_actions: suggestedActions,
      verification,
      severity: 'error',
      related_rules: relatedRules,
    },
  };
}

export class ErrorDiagnostician {
  static diagnose(
    error: Error | string,
    context?: { stderr?: string; stdout?: string }
  ): ErrorDiagnostic | null {
    const parts = [typeof error === 'string' ? error : error.message, context?.stdout, context?.stderr]
      .filter((part): part is string => Boolean(part));
    const errorText = parts.join('\n');

    for (const item of DIAGNOSTIC_RULES) {
      if (item.pattern.test(errorText)) {
        const evidence = extractEvidence(errorText, item.pattern);
        return {
          ...item.diagnostic,
          evidence,
          suggested_fix: item.diagnostic.suggested_actions[0],
        };
      }
    }

    return null;
  }

  static enhanceResult(result: ForgeKitResult): ForgeKitResult {
    if (result.status === 'success' || !result.error) {
      return result;
    }

    const diagnostic = this.diagnose(result.error.summary, {
      stderr: result.error.detail_log,
    });
    if (!diagnostic) {
      return result;
    }

    return {
      ...result,
      error: {
        ...result.error,
        code: diagnostic.code,
        summary: diagnostic.summary,
        suggested_fix: diagnostic.suggested_fix,
      },
    };
  }
}

export function diagnoseBuildError(
  error: Error | string,
  stderr?: string,
  stdout?: string
): ErrorDiagnostic | null {
  return ErrorDiagnostician.diagnose(error, { stderr, stdout });
}

export function createUnknownDiagnostic(logText: string): ErrorDiagnostic {
  const evidence = redactSensitiveText(logText)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-5);
  return {
    code: 'unknown_error',
    category: 'unknown',
    summary: '暂时无法识别该构建失败',
    probable_cause: '当前规则库没有足够证据确定原因。',
    confidence: 'low',
    evidence,
    suggested_actions: ['保留完整脱敏日志，并从最早出现的 error/failed 行开始排查。'],
    verification: ['修复前后使用相同构建命令重试，并比较首次失败步骤。'],
    suggested_fix: '保留完整脱敏日志，并从最早出现的 error/failed 行开始排查。',
    severity: 'error',
  };
}

export function redactSensitiveText(text: string): string {
  return text
    .replace(/\b(bearer)\s+[a-z0-9._~+/-]+=*/gi, '$1 [REDACTED]')
    .replace(/\b(gh[pousr]_[a-z0-9_]{20,}|github_pat_[a-z0-9_]{20,}|sk-[a-z0-9_-]{20,})\b/gi, '[REDACTED]')
    .replace(/\b(token|api[_-]?key|secret|password|authorization)\s*[:=]\s*([^\s,;]+)/gi, '$1=[REDACTED]')
    .replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi, '[EMAIL]')
    .replace(/\/Users\/[^/\s]+\//g, '/Users/[USER]/')
    .replace(/\/home\/[^/\s]+\//g, '/home/[USER]/');
}

function extractEvidence(errorText: string, pattern: RegExp): string[] {
  const lines = errorText.split('\n');
  const evidence: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    pattern.lastIndex = 0;
    if (!pattern.test(lines[index]) && !pattern.test(lines.slice(index, index + 3).join('\n'))) {
      continue;
    }
    const start = Math.max(0, index - 1);
    const end = Math.min(lines.length, index + 3);
    for (const line of lines.slice(start, end)) {
      const redacted = redactSensitiveText(line.trim());
      if (redacted && !evidence.includes(redacted)) {
        evidence.push(redacted);
      }
    }
    if (evidence.length >= 5) {
      break;
    }
  }
  return evidence.slice(0, 5);
}
