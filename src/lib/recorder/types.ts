/**
 * 视频录制模块类型定义
 */

/**
 * 录制状态
 */
export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopped' | 'error';

/**
 * 录制质量配置
 */
export interface RecordingQuality {
  /** 视频比特率 (kbps) */
  videoBitsPerSecond?: number;
  /** 帧率 */
  frameRate?: number;
  /** 视频宽度 */
  width?: number;
  /** 视频高度 */
  height?: number;
  /** 是否包含音频 */
  audio?: boolean;
}

/**
 * 录制配置
 */
export interface RecordingOptions {
  /** 录制质量 */
  quality?: RecordingQuality;
  /** 是否静音录制 */
  muted?: boolean;
  /** 最大录制时长 (毫秒) */
  maxDuration?: number;
  /** 录制超时后自动停止 */
  autoStop?: boolean;
}

/**
 * 录制会话信息
 */
export interface RecordingSession {
  id: string;
  targetId: string;
  status: RecordingStatus;
  startedAt: Date;
  endedAt?: Date;
  duration?: number; // 毫秒
  size?: number; // 字节
  options?: RecordingOptions;
}

/**
 * 录制进度信息
 */
export interface RecordingProgress {
  sessionId: string;
  targetId: string;
  duration: number; // 当前录制时长 (毫秒)
  size: number; // 当前大小 (字节)
  status: RecordingStatus;
}

/**
 * 录制结果
 */
export interface RecordingResult {
  sessionId: string;
  success: boolean;
  blob?: Blob;
  url?: string;
  duration?: number;
  size?: number;
  error?: string;
}
