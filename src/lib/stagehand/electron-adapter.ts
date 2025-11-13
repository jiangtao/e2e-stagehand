import { Stagehand } from '@browserbasehq/stagehand';
import { electronConnector } from '@/lib/cdp/electron-connector';
import { StagehandConfig } from '@/types';

export class ElectronStagehandAdapter {
  private stagehand: Stagehand | null = null;
  private instanceId: string | null = null;
  private config: StagehandConfig;

  constructor(config: StagehandConfig) {
    this.config = config;
  }

  /**
   * 初始化 Stagehand 并连接到 Electron 实例
   */
  async init(instanceId: string): Promise<void> {
    this.instanceId = instanceId;
    
    // 获取实例信息
    const instance = electronConnector.getInstance(instanceId);
    if (!instance) {
      throw new Error(`Electron instance ${instanceId} not found`);
    }

    try {
      // 创建 Stagehand 实例
      this.stagehand = new Stagehand({
        env: 'LOCAL'
      });

      await this.stagehand.init();
      console.log(`✅ Stagehand initialized for instance ${instanceId}`);
    } catch (error) {
      console.error(`❌ Failed to initialize Stagehand for ${instanceId}:`, error);
      throw error;
    }
  }

  /**
   * 执行 AI 驱动的操作
   */
  async act(action: string, options?: any): Promise<any> {
    if (!this.stagehand || !this.instanceId) {
      throw new Error('Stagehand not initialized');
    }

    try {
      console.log(`🤖 Executing action: ${action}`);
      
      const result = await this.stagehand.act({
        action,
        ...options
      });

      // 发出操作事件用于实时可视化
      electronConnector.emit('stagehandOperation', {
        type: 'act',
        instanceId: this.instanceId,
        action,
        result,
        timestamp: new Date()
      });

      return result;
    } catch (error) {
      console.error(`❌ Stagehand action failed:`, error);
      throw error;
    }
  }

  /**
   * 提取数据
   */
  async extract(instruction: string, schema?: any): Promise<any> {
    if (!this.stagehand || !this.instanceId) {
      throw new Error('Stagehand not initialized');
    }

    try {
      console.log(`🔍 Extracting data: ${instruction}`);
      
      const result = await this.stagehand.extract(instruction, schema);

      // 发出操作事件
      electronConnector.emit('stagehandOperation', {
        type: 'extract',
        instanceId: this.instanceId,
        instruction,
        result,
        timestamp: new Date()
      });

      return result;
    } catch (error) {
      console.error(`❌ Stagehand extraction failed:`, error);
      throw error;
    }
  }

  /**
   * 观察页面状态
   */
  async observe(instruction?: string): Promise<any> {
    if (!this.stagehand || !this.instanceId) {
      throw new Error('Stagehand not initialized');
    }

    try {
      console.log(`👀 Observing page: ${instruction || 'general observation'}`);
      
      const result = await this.stagehand.observe(instruction || 'Describe what you see on the page');

      // 发出操作事件
      electronConnector.emit('stagehandOperation', {
        type: 'observe',
        instanceId: this.instanceId,
        instruction,
        result,
        timestamp: new Date()
      });

      return result;
    } catch (error) {
      console.error(`❌ Stagehand observation failed:`, error);
      throw error;
    }
  }

  /**
   * 导航到 URL
   */
  async navigate(url: string): Promise<void> {
    if (!this.stagehand || !this.instanceId) {
      throw new Error('Stagehand not initialized');
    }

    try {
      console.log(`🧭 Navigating to: ${url}`);
      
      // 使用 act 方法进行导航
      await this.stagehand.act(`Navigate to ${url}`);

      // 发出操作事件
      electronConnector.emit('stagehandOperation', {
        type: 'navigate',
        instanceId: this.instanceId,
        url,
        timestamp: new Date()
      });
    } catch (error) {
      console.error(`❌ Navigation failed:`, error);
      throw error;
    }
  }

  /**
   * 获取当前页面截图
   */
  async screenshot(): Promise<Buffer | null> {
    if (!this.stagehand) {
      throw new Error('Stagehand not initialized');
    }

    try {
      // 使用 act 方法进行截图
      await this.stagehand.act('Take a screenshot');
      
      // 注意：实际的截图功能需要根据 Stagehand 3.0 API 调整
      return null;
    } catch (error) {
      console.error(`❌ Screenshot failed:`, error);
      throw error;
    }
  }

  /**
   * 等待指定条件
   */
  async waitFor(condition: string, timeout: number = 30000): Promise<any> {
    if (!this.stagehand || !this.instanceId) {
      throw new Error('Stagehand not initialized');
    }

    try {
      console.log(`⏳ Waiting for condition: ${condition}`);
      
      // 使用 Stagehand 的等待功能
      const result = await this.stagehand.act(`Wait for ${condition}`);

      return result;
    } catch (error) {
      console.error(`❌ Wait condition failed:`, error);
      throw error;
    }
  }

  /**
   * 获取模型客户端选项
   */
  private getModelClientOptions(): any {
    switch (this.config.modelProvider) {
      case 'openai':
        return {
          apiKey: this.config.apiKey,
          baseURL: this.config.customApiUrl
        };
      case 'anthropic':
        return {
          apiKey: this.config.apiKey,
          baseURL: this.config.customApiUrl
        };
      case 'custom':
        return {
          apiKey: this.config.apiKey,
          baseURL: this.config.customApiUrl,
          model: this.config.modelName
        };
      default:
        throw new Error(`Unsupported model provider: ${this.config.modelProvider}`);
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    if (this.stagehand) {
      try {
        await this.stagehand.close();
        console.log(`🧹 Stagehand cleaned up for instance ${this.instanceId}`);
      } catch (error) {
        console.error(`❌ Error cleaning up Stagehand:`, error);
      }
      this.stagehand = null;
    }
    this.instanceId = null;
  }
}

/**
 * Stagehand 适配器管理器
 */
export class StagehandAdapterManager {
  private adapters: Map<string, ElectronStagehandAdapter> = new Map();
  private defaultConfig: StagehandConfig;

  constructor(defaultConfig: StagehandConfig) {
    this.defaultConfig = defaultConfig;
  }

  /**
   * 为实例创建适配器
   */
  async createAdapter(instanceId: string, config?: StagehandConfig): Promise<ElectronStagehandAdapter> {
    const adapterConfig = config || this.defaultConfig;
    const adapter = new ElectronStagehandAdapter(adapterConfig);
    
    await adapter.init(instanceId);
    this.adapters.set(instanceId, adapter);
    
    return adapter;
  }

  /**
   * 获取实例的适配器
   */
  getAdapter(instanceId: string): ElectronStagehandAdapter | null {
    return this.adapters.get(instanceId) || null;
  }

  /**
   * 移除适配器
   */
  async removeAdapter(instanceId: string): Promise<void> {
    const adapter = this.adapters.get(instanceId);
    if (adapter) {
      await adapter.cleanup();
      this.adapters.delete(instanceId);
    }
  }

  /**
   * 清理所有适配器
   */
  async cleanup(): Promise<void> {
    const cleanupPromises = Array.from(this.adapters.values()).map(adapter => 
      adapter.cleanup().catch(console.error)
    );
    
    await Promise.all(cleanupPromises);
    this.adapters.clear();
  }
}
