/**
 * 简化的 Tab 管理器（使用 GLM）
 * 直接使用 CDP 协议，配置 GLM API
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { createGLMClient } from "@/lib/llm/glm-client";

export interface TabInfo {
  id: string;
  url: string;
  page: any;
  createdAt: Date;
  lastUsed: Date;
  status: "active" | "idle" | "closed";
}

export interface ChromeConnection {
  stagehand: Stagehand;
  tabs: Map<string, TabInfo>;
  customClient?: any;
}

/**
 * Chrome Tab 管理器（使用 GLM）
 */
export class SimpleTabManager {
  private static instance: SimpleTabManager;
  private connection?: ChromeConnection;
  private config: {
    maxTabs: number;
    maxIdleTime: number;
    cdpUrl: string;
    glmApiKey: string;
    glmBaseUrl: string;
  };

  private constructor(config = {}) {
    this.config = {
      maxTabs: config.maxTabs || 10,
      maxIdleTime: config.maxIdleTime || 30 * 60 * 1000,
      cdpUrl: config.cdpUrl || "ws://localhost:9222",
      glmApiKey: config.glmApiKey || process.env.GLM_API_KEY || "94ce4cebcb7b4b91b27b41fd159f19ed.z2QN4usqw9LKSzHE",
      glmBaseUrl: config.glmBaseUrl || process.env.GLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4/",
    };
  }

  static getInstance(config?: any): SimpleTabManager {
    if (!SimpleTabManager.instance) {
      SimpleTabManager.instance = new SimpleTabManager(config);
    }
    return SimpleTabManager.instance;
  }

  /**
   * 确保连接到 Chrome（使用 GLM）
   */
  private async ensureConnection(): Promise<ChromeConnection> {
    if (this.connection) {
      return this.connection;
    }

    console.log("[TabManager] Creating new Chrome connection (using GLM)");

    // 使用新的 GLM LLM Client
    const glmClient = createGLMClient({
      apiKey: this.config.glmApiKey,
      baseURL: this.config.glmBaseUrl,
      model: "glm-4-flash",
    });

    console.log("[TabManager] GLM Client created:", {
      type: glmClient.type,
      modelName: glmClient.modelName,
      hasVision: glmClient.hasVision,
    });

    // 创建 Stagehand（禁用内置 API）
    const stagehand = new Stagehand({
      env: "LOCAL",
      verbose: 0,
      disableAPI: true,
      llmClient: glmClient as any,
    });

    await stagehand.init();

    this.connection = {
      stagehand,
      tabs: new Map(),
      customClient: glmClient,
    };

    return this.connection;
  }

  /**
   * 为指定 URL 获取或创建 Tab
   */
  async getTab(url: string, config?: { id?: string; name?: string }): Promise<TabInfo> {
    const chrome = await this.ensureConnection();

    const tabId = config?.id || url;
    const existingTab = chrome.tabs.get(tabId);

    if (existingTab && existingTab.status !== "closed") {
      console.log(`[TabManager] Reusing existing tab: ${tabId}`);
      existingTab.lastUsed = new Date();
      return existingTab;
    }

    if (chrome.tabs.size >= this.config.maxTabs) {
      throw new Error(`Tab count reached limit (${this.config.maxTabs})`);
    }

    console.log(`[TabManager] Creating new tab: ${tabId} -> ${url}`);

    // 使用 CDP 创建新页面
    const page = await chrome.stagehand.context.createPage(url);

    const tab: TabInfo = {
      id: tabId,
      url,
      page,
      createdAt: new Date(),
      lastUsed: new Date(),
      status: "active",
    };

    chrome.tabs.set(tabId, tab);
    return tab;
  }

  /**
   * 关闭指定 Tab
   */
  async closeTab(tabId: string): Promise<void> {
    if (!this.connection) return;

    const tab = this.connection.tabs.get(tabId);
    if (!tab) return;

    console.log(`[TabManager] Closing tab: ${tabId}`);

    try {
      // 使用 CDP 关闭页面
      if (tab.page) {
        await tab.page.sendCDP("Page.close");
      }
    } catch (error) {
      console.error(`[TabManager] Error closing tab:`, error);
    }

    tab.status = "closed";
    this.connection.tabs.delete(tabId);
  }

  /**
   * 释放 Tab（标记为空闲，不关闭）
   */
  releaseTab(tabId: string): void {
    if (!this.connection) return;

    const tab = this.connection.tabs.get(tabId);
    if (tab && tab.status === "active") {
      console.log(`[TabManager] Releasing tab: ${tabId}`);
      tab.status = "idle";
      tab.lastUsed = new Date();
    }
  }

  /**
   * 检查 Tab 的登录状态
   */
  async checkLoginStatus(tabId: string): Promise<boolean> {
    if (!this.connection) return false;

    const tab = this.connection.tabs.get(tabId);
    if (!tab || tab.status === "closed") return false;

    const page = tab.page;

    try {
      const result = await page.sendCDP("Runtime.evaluate", {
        expression: `!!document.querySelector('[class*="login"], [class*="sign"], button:has-text("登录")') === null`,
        returnByValue: true,
      });

      return !result.result.value;  // 如果没有登录按钮，说明已登录
    } catch (error) {
      console.error("[TabManager] Login check failed:", error);
      return false;
    }
  }

  /**
   * 获取所有 Tab
   */
  getTabs(): TabInfo[] {
    if (!this.connection) return [];
    return Array.from(this.connection.tabs.values()).filter((t) => t.status !== "closed");
  }

  /**
   * 获取状态
   */
  getStatus(): {
    totalTabs: number;
    activeTabs: number;
    idleTabs: number;
    tabs: TabInfo[];
  } {
    const tabs = this.getTabs();
    return {
      totalTabs: tabs.length,
      activeTabs: tabs.filter((t) => t.status === "active").length,
      idleTabs: tabs.filter((t) => t.status === "idle").length,
      tabs,
    };
  }

  /**
   * 清理空闲 Tab
   */
  private cleanupIdleTabs(): void {
    if (!this.connection) return;

    const now = Date.now();
    const toClose: string[] = [];

    for (const [id, tab] of this.connection.tabs.entries()) {
      if (tab.status === "idle") {
        const idleTime = now - tab.lastUsed.getTime();
        if (idleTime > this.config.maxIdleTime) {
          console.log(`[TabManager] Cleanup idle tab: ${id}`);
          toClose.push(id);
        }
      }
    }

    for (const id of toClose) {
      this.closeTab(id);
    }
  }

  /**
   * 关闭所有 Tab（保持 Chrome 连接）
   */
  async closeAllTabs(): Promise<void> {
    if (!this.connection) return;

    console.log(`[TabManager] Closing all tabs (${this.connection.tabs.size})`);

    const tabIds = Array.from(this.connection.tabs.keys());

    for (const id of tabIds) {
      await this.closeTab(id);
    }
  }

  /**
   * 关闭 Chrome 连接
   */
  async closeConnection(): Promise<void> {
    await this.closeAllTabs();

    if (this.connection?.stagehand) {
      try {
        await this.connection.stagehand.close();
      } catch (error) {
        console.error("[TabManager] Error closing Chrome:", error);
      }
    }

    this.connection = undefined;
  }

  /**
   * 销毁管理器
   */
  static async destroy(): Promise<void> {
    if (SimpleTabManager.instance) {
      await SimpleTabManager.instance.closeConnection();
      SimpleTabManager.instance = null as any;
    }
  }
}

// 进程退出时清理
if (typeof process !== "undefined") {
  process.on("beforeExit", async () => {
    await SimpleTabManager.destroy();
  });

  process.on("SIGINT", async () => {
    await SimpleTabManager.destroy();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await SimpleTabManager.destroy();
    process.exit(0);
  });
}

// 导出便捷函数
export function getSimpleTabManager(config?: any): SimpleTabManager {
  return SimpleTabManager.getInstance(config);
}
