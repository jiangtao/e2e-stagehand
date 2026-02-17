/**
 * 库模块导出索引
 */

// 目标模块
export * from './target/types';
export * from './target/auto-detector';
export * from './target/web-url-target';
export * from './target/electron-target';
export * from './target/chrome-target';

// Session 模块
export * from './session/session-manager';
export * from './db/session-database';

// 录制模块
export * from './recorder/types';
export * from './recorder/video-recorder';
