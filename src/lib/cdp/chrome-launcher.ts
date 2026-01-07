import { spawn, ChildProcess } from 'child_process';
import { existsSync } from 'fs';

export interface ChromeLaunchOptions {
  chromePath: string;
  port: number;
  incognito?: boolean;
}

export interface ChromeProcess {
  process: ChildProcess;
  pid: number;
}

/**
 * 启动 Chrome 浏览器
 */
export function launchChrome(options: ChromeLaunchOptions): ChromeProcess {
  const { chromePath, port, incognito = false } = options;

  // 检查 Chrome 路径是否存在
  if (!existsSync(chromePath)) {
    throw new Error(`Chrome executable not found at: ${chromePath}`);
  }

  // 构建启动参数
  const args: string[] = [
    `--remote-debugging-port=${port}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
  ];

  // 如果启用隐私模式，添加 incognito 参数
  if (incognito) {
    args.push('--incognito');
  }

  console.log(`🚀 Launching Chrome with debugging port ${port}...`);
  console.log(`   Path: ${chromePath}`);
  console.log(`   Incognito: ${incognito}`);
  console.log(`   Args: ${args.join(' ')}`);

  // 启动 Chrome 进程
  const process = spawn(chromePath, args, {
    detached: false,
    stdio: 'ignore', // 忽略输出，避免干扰
  });

  // 处理进程错误
  process.on('error', (error) => {
    console.error(`❌ Failed to launch Chrome:`, error);
    throw new Error(`Failed to launch Chrome: ${error.message}`);
  });

  const pid = process.pid;
  if (!pid) {
    throw new Error('Failed to get Chrome process PID');
  }

  console.log(`✅ Chrome launched successfully (PID: ${pid})`);

  return {
    process,
    pid,
  };
}

/**
 * 终止 Chrome 进程
 */
export function killChrome(process: ChromeProcess): void {
  try {
    if (process.process && !process.process.killed) {
      console.log(`🛑 Terminating Chrome process (PID: ${process.pid})...`);
      process.process.kill('SIGTERM');
      
      // 如果进程在 3 秒内没有退出，强制终止
      setTimeout(() => {
        if (process.process && !process.process.killed) {
          console.log(`⚠️  Force killing Chrome process (PID: ${process.pid})...`);
          process.process.kill('SIGKILL');
        }
      }, 3000);
    }
  } catch (error) {
    console.error(`❌ Failed to kill Chrome process:`, error);
  }
}

/**
 * 等待端口可用（用于等待 Chrome 启动完成）
 */
export async function waitForPort(port: number, timeout: number = 10000): Promise<boolean> {
  const startTime = Date.now();
  const checkInterval = 200; // 每 200ms 检查一次

  return new Promise((resolve) => {
    const checkPort = async () => {
      try {
        const net = await import('net');
        const client = new net.Socket();
        
        const connectPromise = new Promise<boolean>((resolveConnect) => {
          client.setTimeout(100);
          client.once('connect', () => {
            client.destroy();
            resolveConnect(true);
          });
          client.once('timeout', () => {
            client.destroy();
            resolveConnect(false);
          });
          client.once('error', () => {
            client.destroy();
            resolveConnect(false);
          });
          client.connect(port, '127.0.0.1');
        });

        const isAvailable = await connectPromise;
        
        if (isAvailable) {
          resolve(true);
          return;
        }
      } catch (error) {
        // 忽略错误，继续检查
      }

      // 检查是否超时
      if (Date.now() - startTime >= timeout) {
        resolve(false);
        return;
      }

      // 继续检查
      setTimeout(checkPort, checkInterval);
    };

    checkPort();
  });
}








