#!/usr/bin/env node

import { Command } from 'commander';
import { connectCommand } from './commands/connect';
import { listCommand } from './commands/list';
import { runCommand } from './commands/run';
import { disconnectCommand } from './commands/disconnect';
import { configCommand } from './commands/config';
import { statusCommand } from './commands/status';
import { agentCommand } from './commands/agent';

const program = new Command();

program
  .name('stagehand-electron')
  .description('AI-powered browser automation for Electron applications')
  .version('1.0.0');

// 连接命令
program
  .command('connect')
  .description('Connect to an Electron or Chrome instance')
  .option('-p, --port <number>', 'CDP debug port', '9222')
  .option('-a, --app-path <path>', 'Path to Electron application')
  .option('-t, --type <type>', 'Instance type (electron or chrome)', 'electron')
  .option('-c, --chrome-path <path>', 'Path to Chrome executable (required for Chrome)')
  .option('--incognito', 'Launch Chrome in incognito mode')
  .action(connectCommand);

// 列出实例命令
program
  .command('list')
  .alias('ls')
  .description('List all connected Electron instances')
  .option('-v, --verbose', 'Show detailed information')
  .action(listCommand);

// 运行任务命令
program
  .command('run')
  .description('Run a task on an Electron instance')
  .requiredOption('-i, --instance <id>', 'Instance ID')
  .option('-t, --task <file>', 'Task file path')
  .option('-a, --action <action>', 'Direct action to perform')
  .option('-w, --wait <seconds>', 'Wait time between actions', '1')
  .action(runCommand);

// 断开连接命令
program
  .command('disconnect')
  .description('Disconnect from an Electron instance')
  .requiredOption('-i, --instance <id>', 'Instance ID')
  .action(disconnectCommand);

// 配置命令
program
  .command('config')
  .description('Manage configuration')
  .option('-p, --provider <provider>', 'AI model provider (openai, anthropic, custom)')
  .option('-k, --key <key>', 'API key')
  .option('-u, --url <url>', 'Custom API URL')
  .option('-m, --model <model>', 'Model name')
  .option('-s, --show', 'Show current configuration')
  .action(configCommand);

// 状态命令
program
  .command('status')
  .description('Show service status')
  .option('-i, --instance <id>', 'Specific instance ID')
  .action(statusCommand);

// 代理客户端命令
program
  .command('agent')
  .description('Start agent client to connect local CDP instances to remote server')
  .option('-s, --server <url>', 'Remote server WebSocket URL', 'ws://localhost:8080')
  .option('-u, --user-id <id>', 'User ID (auto-generated if not provided)')
  .option('-n, --name <name>', 'Agent name')
  .option('-t, --token <token>', 'Agent token (optional)')
  .action(agentCommand);

// 解析命令行参数
program.parse();

export default program;
