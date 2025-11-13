import { apiClient } from '../utils/api-client';
import chalk from 'chalk';

interface ListOptions {
  verbose?: boolean;
}

export async function listCommand(options: ListOptions) {
  try {
    console.log(chalk.blue('📋 Listing Electron instances...'));
    
    const response = await apiClient.get('/api/instances');

    if (response.success) {
      const { instances, count } = response.data;
      
      if (count === 0) {
        console.log(chalk.yellow('📭 No Electron instances connected.'));
        console.log(chalk.gray('Use "stagehand-electron connect --port <port>" to connect to an instance.'));
        return;
      }

      console.log(chalk.green(`✅ Found ${count} connected instance(s):\n`));
      
      instances.forEach((instance: any, index: number) => {
        const statusIcon = instance.status === 'connected' ? '🟢' : '🔴';
        const healthIcon = instance.isHealthy ? '💚' : '💔';
        
        console.log(`${index + 1}. ${statusIcon} Instance ${chalk.cyan(instance.id)}`);
        console.log(`   Port: ${chalk.yellow(instance.port)}`);
        console.log(`   Status: ${chalk.magenta(instance.status)} ${healthIcon}`);
        
        if (options.verbose) {
          console.log(`   Connected: ${chalk.gray(new Date(instance.connectedAt).toLocaleString())}`);
          console.log(`   Last Activity: ${chalk.gray(new Date(instance.lastActivity).toLocaleString())}`);
          if (instance.appPath) {
            console.log(`   App Path: ${chalk.gray(instance.appPath)}`);
          }
          if (instance.pid) {
            console.log(`   PID: ${chalk.gray(instance.pid)}`);
          }
        }
        
        console.log(''); // Empty line between instances
      });

    } else {
      console.error(chalk.red(`❌ Failed to list instances: ${response.error}`));
      process.exit(1);
    }

  } catch (error) {
    console.error(chalk.red('❌ Error listing instances:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}
