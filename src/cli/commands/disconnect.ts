import { apiClient } from '../utils/api-client';
import chalk from 'chalk';

interface DisconnectOptions {
  instance: string;
}

export async function disconnectCommand(options: DisconnectOptions) {
  try {
    const instanceId = options.instance;
    
    console.log(chalk.blue(`🔌 Disconnecting from instance ${chalk.cyan(instanceId)}...`));
    
    const response = await apiClient.delete(`/api/instances/${instanceId}/disconnect`);

    if (response.success) {
      console.log(chalk.green('✅ Successfully disconnected!'));
      console.log(chalk.gray(response.data.message));
    } else {
      console.error(chalk.red(`❌ Disconnect failed: ${response.error}`));
      process.exit(1);
    }

  } catch (error) {
    console.error(chalk.red('❌ Error disconnecting from instance:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}
