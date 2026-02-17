/**
 * 基准测试 API
 * GET /api/tests/benchmarks - 获取所有基准测试
 * POST /api/tests/benchmarks - 执行基准测试
 * GET /api/tests/benchmarks/[id]/status - 获取测试状态
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { BenchmarkExecutor } from '@/lib/benchmark/executor';

const BENCHMARKS_DIR = join(process.cwd(), 'tests', 'benchmarks');

// 存储正在运行的测试
const runningTests = new Map<string, BenchmarkExecutor>();

async function loadBenchmark(name: string) {
  const filePath = join(BENCHMARKS_DIR, `${name}.json`);
  if (!existsSync(filePath)) {
    return null;
  }
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

async function listBenchmarks() {
  if (!existsSync(BENCHMARKS_DIR)) {
    return [];
  }

  const files = await readdir(BENCHMARKS_DIR);
  const benchmarks = [];

  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const content = await readFile(join(BENCHMARKS_DIR, file), 'utf-8');
        const benchmark = JSON.parse(content);
        benchmarks.push({
          id: file.replace('.json', ''),
          name: benchmark.name,
          description: benchmark.description,
          version: benchmark.version,
          metadata: benchmark.metadata,
        });
      } catch (error) {
        console.error(`Failed to load benchmark ${file}:`, error);
      }
    }
  }

  return benchmarks;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const benchmarkId = searchParams.get('id');

    if (benchmarkId) {
      // 获取单个基准测试详情
      const benchmark = await loadBenchmark(benchmarkId);
      if (!benchmark) {
        return NextResponse.json({
          success: false,
          error: 'Benchmark not found',
        }, { status: 404 });
      }

      // 检查是否正在运行
      const runningTest = Array.from(runningTests.entries()).find(
        ([id]) => id.includes(benchmarkId)
      );

      return NextResponse.json({
        success: true,
        benchmark,
        running: !!runningTest,
        status: runningTest ? 'running' : 'idle',
      });
    }

    // 获取所有基准测试列表
    const benchmarks = await listBenchmarks();
    return NextResponse.json({
      success: true,
      benchmarks,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { benchmarkId, targetId, options = {} } = body;

    if (!benchmarkId) {
      return NextResponse.json({
        success: false,
        error: 'Missing benchmarkId',
      }, { status: 400 });
    }

    // 加载基准测试配置
    const benchmark = await loadBenchmark(benchmarkId);
    if (!benchmark) {
      return NextResponse.json({
        success: false,
        error: 'Benchmark not found',
      }, { status: 404 });
    }

    // 创建测试执行会话
    const sessionId = `benchmark-${benchmarkId}-${Date.now()}`;

    // 创建执行器并启动测试
    const executor = new BenchmarkExecutor(benchmark);

    // 在后台异步执行测试
    runningTests.set(sessionId, executor);

    // 启动测试（不等待完成）
    executor.execute().then((result) => {
      console.log(`[Benchmark] Test ${sessionId} completed:`, result);
      runningTests.delete(sessionId);
    }).catch((error) => {
      console.error(`[Benchmark] Test ${sessionId} failed:`, error);
      runningTests.delete(sessionId);
    });

    return NextResponse.json({
      success: true,
      sessionId,
      benchmark: {
        id: benchmarkId,
        name: benchmark.name,
        steps: benchmark.steps.length,
      },
      status: 'running',
      message: 'Benchmark test started',
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
