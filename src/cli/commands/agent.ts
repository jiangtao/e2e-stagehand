import chalk from 'chalk';
import { startAgent } from '../../agent';
import { getConfig } from '../../agent/config';

interface AgentOptions {
  server?: string;
  userId?: string;
  name?: string;
  token?: string;
}

export async function agentCommand(options: AgentOptions) {
  try {
    console.log(chalk.blue('🚀 Starting Stagehand Agent...'));

    // 构建配置
    const config = getConfig();
    
    if (options.server) {
      config.serverUrl = options.server;
    }
    
    if (options.userId) {
      config.userId = options.userId;
    }
    
    if (options.name) {
      config.name = options.name;
    }
    
    if (options.token) {
      config.token = options.token;
    }

    // 如果没有 userId，生成一个
    if (!config.userId) {
      config.userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log(chalk.yellow(`⚠️  No userId provided, generated: ${config.userId}`));
    }

    console.log(chalk.cyan(`   Server: ${config.serverUrl}`));
    console.log(chalk.cyan(`   User ID: ${config.userId}`));
    console.log(chalk.cyan(`   Name: ${config.name}`));
    console.log('');

    // 启动代理
    await startAgent(config);

  } catch (error) {
    console.error(chalk.red('❌ Error starting agent:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

