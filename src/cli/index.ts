#!/usr/bin/env node

import { Command } from 'commander';
import { connectCommand } from './commands/connect';
import { listCommand } from './commands/list';
import { runCommand } from './commands/run';
import { disconnectCommand } from './commands/disconnect';
import { configCommand } from './commands/config';
import { statusCommand } from './commands/status';

const program = new Command();

program
  .name('stagehand-electron')
  .description('AI-powered browser automation for Electron applications')
  .version('1.0.0');

// 连接命令
program
  .command('connect')
  .description('Connect to an Electron instance')
  .option('-p, --port <number>', 'CDP debug port', '9222')
  .option('-a, --app-path <path>', 'Path to Electron application')
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

// 解析命令行参数
program.parse();

export default program;
