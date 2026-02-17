/**
 * 统一目标(Target)类型定义
 * 用于抽象 Web URL、Electron、Chrome 等不同的测试目标
 */

import type { V3Context } from '@browserbasehq/stagehand';

/**
 * 目标类型
 */
export type TargetType = 'web-url' | 'electron' | 'chrome';

/**
 * 目标状态
 */
export type TargetStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * CDP 连接信息
 */
export interface CDPConnectionInfo {
  port: number;
  wsUrl?: string;
  targets?: Array<{
    id: string;
    type: string;
    title: string;
    url: string;
  }>;
}

/**
 * 浏览器启动选项
 */
export interface BrowserLaunchOptions {
  headless?: boolean;
  args?: string[];
  userDataDir?: string;
  ignoreDefaultArgs?: boolean | string[];
}

/**
 * 目标连接结果
 */
export interface TargetConnectionResult {
  context: V3Context;
  cdpUrl: string;
  targetId: string;
}

/**
 * 统一的目标接口
 * 所有的测试目标（Web URL、Electron、Chrome）都实现这个接口
 */
export interface Target {
  /** 唯一标识符 */
  readonly id: string;

  /** 目标类型 */
  readonly type: TargetType;

  /** 显示名称 */
  readonly displayName: string;

  /** 当前状态 */
  status: TargetStatus;

  /** 连接上下文 */
  context?: V3Context;

  /** 最后更新时间 */
  lastActivity?: Date;

  /**
   * 连接到目标并返回 Stagehand V3Context
   */
  connect(): Promise<TargetConnectionResult>;

  /**
   * 断开连接
   */
  disconnect(): Promise<void>;

  /**
   * 检查是否已连接
   */
  isConnected(): boolean;

  /**
   * 获取 CDP 连接信息（如果有）
   */
  getCDPInfo?(): CDPConnectionInfo | null;

  /**
   * 刷新连接状态
   */
  refreshStatus(): Promise<TargetStatus>;
}

/**
 * 检测到的目标信息
 */
export interface DetectedTarget {
  port: number;
  type: TargetType;
  url?: string;
  title?: string;
  favicon?: string;
  wsUrl?: string;
  autoDetected: true;
}

/**
 * 目标选择器选项
 */
export interface TargetSelectorOptions {
  /** 是否只显示自动检测到的目标 */
  autoDetectedOnly?: boolean;
  /** 目标类型过滤 */
  typeFilter?: TargetType[];
  /** 最大显示数量 */
  maxResults?: number;
}
