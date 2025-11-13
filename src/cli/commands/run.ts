import { apiClient } from '../utils/api-client';
import { readFileSync } from 'fs';
import chalk from 'chalk';

interface RunOptions {
  instance: string;
  task?: string;
  action?: string;
  wait: string;
}

export async function runCommand(options: RunOptions) {
  try {
    const instanceId = options.instance;
    const waitTime = parseInt(options.wait) * 1000;

    console.log(chalk.blue(`🚀 Running task on instance ${chalk.cyan(instanceId)}...`));

    let actions: string[] = [];

    // 从文件读取任务或使用直接操作
    if (options.task) {
      try {
        const taskContent = readFileSync(options.task, 'utf8');
        actions = taskContent
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#')); // 过滤空行和注释
        
        console.log(chalk.gray(`📄 Loaded ${actions.length} actions from ${options.task}`));
      } catch (error) {
        console.error(chalk.red(`❌ Failed to read task file: ${error}`));
        process.exit(1);
      }
    } else if (options.action) {
      actions = [options.action];
    } else {
      console.error(chalk.red('❌ Either --task or --action must be specified'));
      process.exit(1);
    }

    // 执行每个操作
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      console.log(chalk.blue(`\n📝 Step ${i + 1}/${actions.length}: ${action}`));

      try {
        const response = await apiClient.post(`/api/instances/${instanceId}/act`, {
          action
        });

        if (response.success) {
          console.log(chalk.green('✅ Action completed successfully'));
          if (response.data.result) {
            console.log(chalk.gray(`Result: ${JSON.stringify(response.data.result, null, 2)}`));
          }
        } else {
          console.error(chalk.red(`❌ Action failed: ${response.error}`));
          
          // 询问是否继续
          const readline = require('readline');
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });

          const answer = await new Promise<string>((resolve) => {
            rl.question(chalk.yellow('Continue with next action? (y/N): '), resolve);
          });
          
          rl.close();

          if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
            console.log(chalk.yellow('🛑 Task execution stopped by user'));
            process.exit(0);
          }
        }

        // 等待指定时间后执行下一个操作
        if (i < actions.length - 1 && waitTime > 0) {
          console.log(chalk.gray(`⏳ Waiting ${options.wait} seconds before next action...`));
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }

      } catch (error) {
        console.error(chalk.red(`❌ Error executing action "${action}":`));
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    }

    console.log(chalk.green(`\n🎉 All ${actions.length} actions completed successfully!`));

  } catch (error) {
    console.error(chalk.red('❌ Error running task:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}
