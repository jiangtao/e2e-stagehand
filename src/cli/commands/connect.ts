import { apiClient } from '../utils/api-client';
import chalk from 'chalk';

interface ConnectOptions {
  port: string;
  appPath?: string;
}

export async function connectCommand(options: ConnectOptions) {
  try {
    console.log(chalk.blue('🔌 Connecting to Electron instance...'));
    
    const port = parseInt(options.port);
    if (isNaN(port) || port < 1024 || port > 65535) {
      console.error(chalk.red('❌ Invalid port number. Must be between 1024 and 65535.'));
      process.exit(1);
    }

    const response = await apiClient.post('/api/instances/connect', {
      port,
      appPath: options.appPath
    });

    if (response.success) {
      const { instanceId, instance } = response.data;
      
      console.log(chalk.green('✅ Successfully connected!'));
      console.log(chalk.cyan(`Instance ID: ${instanceId}`));
      console.log(chalk.gray(`Port: ${instance.port}`));
      if (instance.appPath) {
        console.log(chalk.gray(`App Path: ${instance.appPath}`));
      }
      console.log(chalk.gray(`Connected at: ${new Date(instance.connectedAt).toLocaleString()}`));
      
      // 保存实例 ID 到本地配置 (简单实现)
      process.env.LAST_INSTANCE_ID = instanceId;
      
    } else {
      console.error(chalk.red(`❌ Connection failed: ${response.error}`));
      process.exit(1);
    }

  } catch (error) {
    console.error(chalk.red('❌ Error connecting to Electron:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}
