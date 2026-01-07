import { apiClient } from '../utils/api-client';
import chalk from 'chalk';

interface ConnectOptions {
  port: string;
  appPath?: string;
  type?: string;
  chromePath?: string;
  incognito?: boolean;
}

export async function connectCommand(options: ConnectOptions) {
  try {
    const instanceType = (options.type || 'electron') as 'electron' | 'chrome';
    const instanceTypeLabel = instanceType === 'chrome' ? 'Chrome' : 'Electron';
    
    console.log(chalk.blue(`🔌 Connecting to ${instanceTypeLabel} instance...`));
    
    const port = parseInt(options.port);
    if (isNaN(port) || port < 1024 || port > 65535) {
      console.error(chalk.red('❌ Invalid port number. Must be between 1024 and 65535.'));
      process.exit(1);
    }

    // 验证 Chrome 相关参数
    if (instanceType === 'chrome' && !options.chromePath) {
      console.error(chalk.red('❌ chromePath is required when instanceType is "chrome"'));
      console.error(chalk.yellow('   Use --chrome-path <path> to specify Chrome executable path'));
      process.exit(1);
    }

    const response = await apiClient.post('/api/instances/connect', {
      port,
      appPath: options.appPath,
      instanceType,
      chromePath: options.chromePath,
      incognito: options.incognito || false
    });

    if (response.success) {
      const { instanceId, instance } = response.data;
      
      console.log(chalk.green('✅ Successfully connected!'));
      console.log(chalk.cyan(`Instance ID: ${instanceId}`));
      console.log(chalk.gray(`Type: ${instance.instanceType || 'electron'}`));
      console.log(chalk.gray(`Port: ${instance.port}`));
      if (instance.appPath) {
        console.log(chalk.gray(`App Path: ${instance.appPath}`));
      }
      if (instance.incognito) {
        console.log(chalk.gray(`Incognito: Yes`));
      }
      console.log(chalk.gray(`Connected at: ${new Date(instance.connectedAt).toLocaleString()}`));
      
      // 保存实例 ID 到本地配置 (简单实现)
      process.env.LAST_INSTANCE_ID = instanceId;
      
    } else {
      console.error(chalk.red(`❌ Connection failed: ${response.error}`));
      process.exit(1);
    }

  } catch (error) {
    const instanceType = (options.type || 'electron') as 'electron' | 'chrome';
    const instanceTypeLabel = instanceType === 'chrome' ? 'Chrome' : 'Electron';
    console.error(chalk.red(`❌ Error connecting to ${instanceTypeLabel}:`));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}
