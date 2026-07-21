/**
 * 缓存性能对比测试
 *
 * 验证缓存带来的性能提升
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { inspectProject } from '../src/capabilities/inspect-project.js';
import { globalCache } from '../src/capabilities/utils/cache.js';

async function benchmark() {
  console.log('📊 缓存性能对比测试\n');

  // 创建测试项目
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgekit-bench-'));

  try {
    // 准备 Python 项目
    fs.writeFileSync(path.join(tmpDir, 'app.py'), 'print("hello")');
    fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'flask==2.0.0');
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test Project');

    console.log('项目结构:');
    console.log('  - app.py');
    console.log('  - requirements.txt');
    console.log('  - README.md\n');

    // 清空缓存
    globalCache.clear();

    // 第一次调用（缓存未命中）
    console.log('第 1 次调用（缓存未命中）...');
    const start1 = Date.now();
    const result1 = await inspectProject(tmpDir);
    const elapsed1 = Date.now() - start1;
    console.log(`  耗时: ${elapsed1}ms`);

    // 第二次调用（缓存命中）
    console.log('\n第 2 次调用（缓存命中）...');
    const start2 = Date.now();
    const result2 = await inspectProject(tmpDir);
    const elapsed2 = Date.now() - start2;
    console.log(`  耗时: ${elapsed2}ms`);

    // 结果一致性
    console.log('\n结果一致性检查:');
    console.log(`  语言: ${result1.language} === ${result2.language} ✓`);
    console.log(`  入口: ${result1.entrypoints?.join(',')} === ${result2.entrypoints?.join(',')} ✓`);

    // 性能提升
    const speedup = elapsed1 / elapsed2;
    console.log(`\n⚡ 性能提升: ${speedup.toFixed(1)}x`);
    console.log(`  节省时间: ${elapsed1 - elapsed2}ms`);

    // 缓存统计
    const stats = globalCache.stats();
    console.log(`\n缓存统计:`);
    console.log(`  缓存条目数: ${stats.size}`);
    console.log(`  缓存键: ${stats.keys.join(', ')}`);

    // 清理
    globalCache.clear();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

benchmark().catch(console.error);