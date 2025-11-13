import { apiClient } from '../utils/api-client';
import chalk from 'chalk';

interface ConfigOptions {
  provider?: string;
  key?: string;
  url?: string;
  model?: string;
  show?: boolean;
}

export async function configCommand(options: ConfigOptions) {
  try {
    // 显示当前配置
    if (options.show) {
      console.log(chalk.blue('⚙️ Current configuration:'));
      
      const response = await apiClient.get('/api/config');
      
      if (response.success) {
        const config = response.data;
        
        console.log(chalk.cyan('\n🤖 Stagehand Configuration:'));
        console.log(`  Model Provider: ${chalk.yellow(config.stagehand.modelProvider)}`);
        console.log(`  API Key: ${chalk.gray(config.stagehand.apiKey || 'Not set')}`);
        console.log(`  Model Name: ${chalk.yellow(config.stagehand.modelName || 'Default')}`);
        if (config.stagehand.customApiUrl) {
          console.log(`  Custom API URL: ${chalk.yellow(config.stagehand.customApiUrl)}`);
        }
        
        console.log(chalk.cyan('\n🔌 WebSocket Configuration:'));
        console.log(`  Port: ${chalk.yellow(config.websocket.port)}`);
        console.log(`  Reconnect Interval: ${chalk.yellow(config.websocket.reconnectInterval)}ms`);
        console.log(`  Max Reconnect Attempts: ${chalk.yellow(config.websocket.maxReconnectAttempts)}`);
        
        console.log(chalk.cyan('\n⚡ Electron Configuration:'));
        console.log(`  Default Debug Port: ${chalk.yellow(config.electron.defaultDebugPort)}`);
        console.log(`  Health Check Interval: ${chalk.yellow(config.electron.healthCheckInterval)}ms`);
        
      } else {
        console.error(chalk.red(`❌ Failed to get configuration: ${response.error}`));
        process.exit(1);
      }
      return;
    }

    // 更新配置
    const updates: any = {};
    
    if (options.provider || options.key || options.url || options.model) {
      updates.stagehand = {};
      
      if (options.provider) {
        if (!['openai', 'anthropic', 'custom'].includes(options.provider)) {
          console.error(chalk.red('❌ Invalid provider. Must be one of: openai, anthropic, custom'));
          process.exit(1);
        }
        updates.stagehand.modelProvider = options.provider;
      }
      
      if (options.key) {
        updates.stagehand.apiKey = options.key;
      }
      
      if (options.url) {
        updates.stagehand.customApiUrl = options.url;
      }
      
      if (options.model) {
        updates.stagehand.modelName = options.model;
      }
    }

    if (Object.keys(updates).length === 0) {
      console.log(chalk.yellow('⚠️ No configuration changes specified.'));
      console.log(chalk.gray('Use --show to view current configuration or specify options to update.'));
      console.log(chalk.gray('Available options: --provider, --key, --url, --model'));
      return;
    }

    console.log(chalk.blue('⚙️ Updating configuration...'));
    
    const response = await apiClient.put('/api/config', updates);
    
    if (response.success) {
      console.log(chalk.green('✅ Configuration updated successfully!'));
      
      // 显示更新的内容
      if (updates.stagehand) {
        console.log(chalk.cyan('\n📝 Updated settings:'));
        Object.entries(updates.stagehand).forEach(([key, value]) => {
          const displayValue = key === 'apiKey' ? '***' : value;
          console.log(`  ${key}: ${chalk.yellow(displayValue)}`);
        });
      }
      
      console.log(chalk.gray('\n💡 Restart the service for changes to take effect.'));
      
    } else {
      console.error(chalk.red(`❌ Configuration update failed: ${response.error}`));
      if (response.details) {
        console.error(chalk.red('Details:'));
        response.details.forEach((detail: string) => {
          console.error(chalk.red(`  - ${detail}`));
        });
      }
      process.exit(1);
    }

  } catch (error) {
    console.error(chalk.red('❌ Error managing configuration:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}
