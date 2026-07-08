/**
 * M2: inspect_project 单元测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { inspectProject } from '../../../src/capabilities/inspect-project.js';

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgekit-inspect-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFile(name: string, content: string) {
  fs.writeFileSync(path.join(tmpDir, name), content);
}

describe('M2: inspect_project', () => {
  it('Python 项目识别（pyproject.toml + app.py）', async () => {
    const dir = path.join(tmpDir, 'python-project');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'pyproject.toml'), '[project]\nname = "demo"\npython_requires = ">=3.10"\n');
    fs.writeFileSync(path.join(dir, 'app.py'), 'from flask import Flask\napp = Flask(__name__)');

    const result = await inspectProject(dir);

    expect(result.status).toBe('success');
    expect(result.language).toBe('Python');
    expect(result.runtime).toContain('3.10');
    expect(result.entrypoints).toContain('app.py');
    expect(result.existing_packaging?.pyproject_toml).toBe(true);
    expect(result.recommendations?.some((r) => r.includes('Docker'))).toBe(true);
  });

  it('Python 项目识别（requirements.txt）', async () => {
    const dir = path.join(tmpDir, 'python-req');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'requirements.txt'), 'flask==2.3.0\n');
    fs.writeFileSync(path.join(dir, 'main.py'), 'print("hello")');

    const result = await inspectProject(dir);

    expect(result.status).toBe('success');
    expect(result.language).toBe('Python');
    expect(result.entrypoints).toContain('main.py');
    expect(result.existing_packaging?.requirements_txt).toBe(true);
  });

  it('已有 Dockerfile 时正确检测', async () => {
    const dir = path.join(tmpDir, 'with-dockerfile');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'Dockerfile'), 'FROM python:3.10-slim\n');
    fs.writeFileSync(path.join(dir, 'app.py'), '');

    const result = await inspectProject(dir);

    expect(result.existing_packaging?.dockerfile).toBe(true);
    expect(result.warnings?.some((w) => w.includes('Dockerfile'))).toBeFalsy();
  });

  it('无 Dockerfile 时给出警告', async () => {
    const dir = path.join(tmpDir, 'no-dockerfile');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'app.py'), '');

    const result = await inspectProject(dir);

    expect(result.warnings?.some((w) => w.includes('Dockerfile'))).toBe(true);
  });

  it('TypeScript 项目识别（package.json + typescript）', async () => {
    const dir = path.join(tmpDir, 'ts-project');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'ts-demo', main: 'dist/index.js', dependencies: { typescript: '^5.0.0' } })
    );

    const result = await inspectProject(dir);

    expect(result.language).toBe('TypeScript');
    expect(result.runtime).toBe('Node.js');
    expect(result.entrypoints).toContain('dist/index.js');
  });

  it('Go 项目识别（go.mod + main.go）', async () => {
    const dir = path.join(tmpDir, 'go-project');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'go.mod'), 'module demo\n\ngo 1.21\n');
    fs.writeFileSync(path.join(dir, 'main.go'), 'package main\n');

    const result = await inspectProject(dir);

    expect(result.language).toBe('Go');
    expect(result.entrypoints).toContain('main.go');
  });

  it('无入口时返回警告', async () => {
    const dir = path.join(tmpDir, 'no-entry');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'utils.py'), 'def helper(): pass\n');

    const result = await inspectProject(dir);

    expect(result.warnings?.some((w) => w.includes('入口'))).toBe(true);
    expect(result.entrypoints).toHaveLength(0);
  });

  it('源目录不存在时返回 path_not_found 错误', async () => {
    const result = await inspectProject('/nonexistent/path/xyz');

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('path_not_found');
  });

  it('源路径是文件时返回 invalid_path 错误', async () => {
    const filePath = path.join(tmpDir, 'a-file.txt');
    fs.writeFileSync(filePath, 'hello');

    const result = await inspectProject(filePath);

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('invalid_path');
  });
});
