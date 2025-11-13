import { apiClient } from '../utils/api-client';
import chalk from 'chalk';

interface StatusOptions {
  instance?: string;
}

export async function statusCommand(options: StatusOptions) {
  try {
    console.log(chalk.blue('📊 Checking service status...'));

    // 检查特定实例状态
    if (options.instance) {
      const instanceId = options.instance;
      
      try {
        // 获取实例列表来查找特定实例
        const response = await apiClient.get('/api/instances');
        
        if (response.success) {
          const instance = response.data.instances.find((inst: any) => inst.id === instanceId);
          
          if (!instance) {
            console.error(chalk.red(`❌ Instance ${instanceId} not found`));
            process.exit(1);
          }

          console.log(chalk.cyan(`\n🔍 Instance ${instanceId} Status:`));
          
          const statusIcon = instance.status === 'connected' ? '🟢' : '🔴';
          const healthIcon = instance.isHealthy ? '💚' : '💔';
          
          console.log(`  Status: ${statusIcon} ${chalk.magenta(instance.status)}`);
          console.log(`  Health: ${healthIcon} ${instance.isHealthy ? chalk.green('Healthy') : chalk.red('Unhealthy')}`);
          console.log(`  Port: ${chalk.yellow(instance.port)}`);
          console.log(`  Connected: ${chalk.gray(new Date(instance.connectedAt).toLocaleString())}`);
          console.log(`  Last Activity: ${chalk.gray(new Date(instance.lastActivity).toLocaleString())}`);
          
          if (instance.appPath) {
            console.log(`  App Path: ${chalk.gray(instance.appPath)}`);
          }
          
          if (instance.pid) {
            console.log(`  PID: ${chalk.gray(instance.pid)}`);
          }

        } else {
          console.error(chalk.red(`❌ Failed to get instance status: ${response.error}`));
          process.exit(1);
        }
        
        return;
      } catch (error) {
        console.error(chalk.red(`❌ Error checking instance status: ${error}`));
        process.exit(1);
      }
    }

    // 检查整体服务状态
    try {
      // 检查 API 服务
      const instancesResponse = await apiClient.get('/api/instances');
      const configResponse = await apiClient.get('/api/config');
      
      console.log(chalk.green('✅ API Service: Online'));
      
      if (instancesResponse.success && configResponse.success) {
        const { instances, count } = instancesResponse.data;
        
        console.log(chalk.cyan('\n📊 Service Overview:'));
        console.log(`  Connected Instances: ${chalk.yellow(count)}`);
        
        if (count > 0) {
          const healthyCount = instances.filter((inst: any) => inst.isHealthy).length;
          const unhealthyCount = count - healthyCount;
          
          console.log(`  Healthy Instances: ${chalk.green(healthyCount)}`);
          if (unhealthyCount > 0) {
            console.log(`  Unhealthy Instances: ${chalk.red(unhealthyCount)}`);
          }
        }
        
        // 显示配置状态
        const config = configResponse.data;
        console.log(chalk.cyan('\n⚙️ Configuration Status:'));
        console.log(`  Model Provider: ${chalk.yellow(config.stagehand.modelProvider)}`);
        console.log(`  API Key: ${config.stagehand.apiKey ? chalk.green('Set') : chalk.red('Not set')}`);
        console.log(`  WebSocket Port: ${chalk.yellow(config.websocket.port)}`);
        
        // 尝试检查 WebSocket 连接
        console.log(chalk.cyan('\n🔌 WebSocket Status:'));
        try {
          // 这里可以添加 WebSocket 连接测试
          console.log(`  Port ${config.websocket.port}: ${chalk.yellow('Unknown (requires connection test)')}`);
        } catch (wsError) {
          console.log(`  Port ${config.websocket.port}: ${chalk.red('Unavailable')}`);
        }

      } else {
        console.error(chalk.red('❌ API Service: Partial failure'));
        if (!instancesResponse.success) {
          console.error(chalk.red(`  Instances API: ${instancesResponse.error}`));
        }
        if (!configResponse.success) {
          console.error(chalk.red(`  Config API: ${configResponse.error}`));
        }
      }

    } catch (error) {
      console.error(chalk.red('❌ API Service: Offline'));
      console.error(chalk.red('Make sure the Stagehand service is running on http://localhost:3000'));
      console.error(chalk.gray('Start with: npm run dev'));
      process.exit(1);
    }

  } catch (error) {
    console.error(chalk.red('❌ Error checking status:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}
