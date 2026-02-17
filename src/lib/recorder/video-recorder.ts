/**
 * 视频录制器
 * 使用 Canvas captureStream + MediaRecorder 录制目标画面
 */

import { EventEmitter } from 'events';
import type {
  RecordingStatus,
  RecordingOptions,
  RecordingSession,
  RecordingProgress,
  RecordingResult,
  RecordingQuality,
} from './types';

/**
 * 默认录制质量
 */
const DEFAULT_QUALITY: RecordingQuality = {
  videoBitsPerSecond: 2500000, // 2.5 Mbps
  frameRate: 30,
  width: 1920,
  height: 1080,
  audio: false,
};

/**
 * 视频录制器类
 * 录制 CDP 目标的画面
 */
export class VideoRecorder extends EventEmitter {
  private recordings: Map<string, RecordingSession> = new Map();
  private mediaRecorders: Map<string, MediaRecorder> = new Map();
  private streams: Map<string, MediaStream> = new Map();
  private progressIntervals: Map<string, NodeJS.Timeout> = new Map();
  private chunks: Map<string, Blob[]> = new Map();

  constructor() {
    super();
  }

  /**
   * 开始录制目标
   */
  async startRecording(
    targetId: string,
    canvas: HTMLCanvasElement,
    options?: RecordingOptions
  ): Promise<string> {
    const recordingId = `${targetId}-${Date.now()}`;

    try {
      // 1. 准备录制配置
      const quality = { ...DEFAULT_QUALITY, ...options?.quality };

      // 2. 从 Canvas 获取流
      const stream = canvas.captureStream(quality.frameRate);

      // 3. 创建 MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        videoBitsPerSecond: quality.videoBitsPerSecond,
        mimeType: this.getSupportedMimeType(),
      });

      // 4. 准备数据存储
      this.chunks.set(recordingId, []);
      this.streams.set(recordingId, stream);

      // 5. 设置事件监听
      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          const chunks = this.chunks.get(recordingId);
          if (chunks) {
            chunks.push(event.data);
          }
        }
      };

      mediaRecorder.onstop = () => {
        this.handleRecordingStop(recordingId);
      };

      mediaRecorder.onerror = (event: Event) => {
        console.error(`MediaRecorder error for ${recordingId}:`, event);
        this.updateRecordingStatus(recordingId, 'error');
      };

      // 6. 创建录制会话
      const session: RecordingSession = {
        id: recordingId,
        targetId,
        status: 'recording',
        startedAt: new Date(),
        options,
      };

      this.recordings.set(recordingId, session);
      this.mediaRecorders.set(recordingId, mediaRecorder);

      // 7. 开始录制
      mediaRecorder.start(100); // 每 100ms 产生一个数据块

      // 8. 启动进度更新
      this.startProgressUpdate(recordingId);

      // 9. 处理自动停止
      if (options?.maxDuration) {
        setTimeout(() => {
          const session = this.recordings.get(recordingId);
          if (session && session.status === 'recording') {
            this.stopRecording(recordingId);
          }
        }, options.maxDuration);
      }

      // 10. 发出事件
      this.emit('recording_started', session);

      console.log(`🔴 Recording started: ${recordingId} for target ${targetId}`);
      return recordingId;

    } catch (error) {
      console.error(`Failed to start recording for ${targetId}:`, error);

      // 更新状态为错误
      const session = this.recordings.get(recordingId);
      if (session) {
        session.status = 'error';
        this.emit('recording_error', {
          recordingId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      throw error;
    }
  }

  /**
   * 停止录制
   */
  async stopRecording(recordingId: string): Promise<RecordingResult | null> {
    const session = this.recordings.get(recordingId);
    const mediaRecorder = this.mediaRecorders.get(recordingId);

    if (!session || !mediaRecorder) {
      console.warn(`Recording ${recordingId} not found`);
      return null;
    }

    if (session.status !== 'recording') {
      console.warn(`Recording ${recordingId} is not active`);
      return null;
    }

    try {
      // 停止 MediaRecorder
      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }

      // 等待 onstop 事件处理完成
      // 等待一小段时间让数据收集完成
      await new Promise((resolve) => setTimeout(resolve, 200));

      const result = await this.getRecordingResult(recordingId);

      // 清理资源
      this.cleanupRecording(recordingId);

      return result;

    } catch (error) {
      console.error(`Failed to stop recording ${recordingId}:`, error);
      this.updateRecordingStatus(recordingId, 'error');
      return null;
    }
  }

  /**
   * 暂停录制
   */
  pauseRecording(recordingId: string): void {
    const mediaRecorder = this.mediaRecorders.get(recordingId);

    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      this.updateRecordingStatus(recordingId, 'paused');
      console.log(`⏸️ Recording paused: ${recordingId}`);
    }
  }

  /**
   * 恢复录制
   */
  resumeRecording(recordingId: string): void {
    const mediaRecorder = this.mediaRecorders.get(recordingId);

    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      this.updateRecordingStatus(recordingId, 'recording');
      console.log(`▶️ Recording resumed: ${recordingId}`);
    }
  }

  /**
   * 获取录制会话
   */
  getRecording(recordingId: string): RecordingSession | null {
    return this.recordings.get(recordingId) || null;
  }

  /**
   * 获取所有录制会话
   */
  getAllRecordings(): RecordingSession[] {
    return Array.from(this.recordings.values());
  }

  /**
   * 获取目标的录制会话
   */
  getTargetRecordings(targetId: string): RecordingSession[] {
    return this.getAllRecordings().filter((r) => r.targetId === targetId);
  }

  /**
   * 获取录制进度
   */
  getProgress(recordingId: string): RecordingProgress | null {
    const session = this.recordings.get(recordingId);

    if (!session) {
      return null;
    }

    const duration = session.endedAt
      ? session.endedAt.getTime() - session.startedAt.getTime()
      : Date.now() - session.startedAt.getTime();

    const size = session.size || 0;

    return {
      sessionId: recordingId,
      targetId: session.targetId,
      duration,
      size,
      status: session.status,
    };
  }

  /**
   * 处理录制停止
   */
  private handleRecordingStop(recordingId: string): void {
    const session = this.recordings.get(recordingId);
    if (!session) return;

    const chunks = this.chunks.get(recordingId);

    if (!chunks || chunks.length === 0) {
      console.warn(`No data chunks for recording ${recordingId}`);
      session.status = 'error';
      this.emit('recording_error', {
        recordingId,
        error: 'No recorded data',
      });
      return;
    }

    // 创建 Blob
    const mimeType = this.getSupportedMimeType();
    const blob = new Blob(chunks, { type: mimeType });

    // 更新会话信息
    session.endedAt = new Date();
    session.duration = session.endedAt.getTime() - session.startedAt.getTime();
    session.size = blob.size;
    session.status = 'stopped';

    // 生成 URL
    const url = URL.createObjectURL(blob);

    this.emit('recording_stopped', {
      sessionId: recordingId,
      targetId: session.targetId,
      blob,
      url,
      duration: session.duration,
      size: blob.size,
    });

    console.log(`⏹️ Recording stopped: ${recordingId}, duration: ${session.duration}ms, size: ${blob.size} bytes`);
  }

  /**
   * 获取录制结果
   */
  private async getRecordingResult(recordingId: string): Promise<RecordingResult> {
    const session = this.recordings.get(recordingId);

    if (!session || session.status !== 'stopped') {
      return {
        sessionId: recordingId,
        success: false,
        error: 'Recording not completed',
      };
    }

    const chunks = this.chunks.get(recordingId);

    if (!chunks || chunks.length === 0) {
      return {
        sessionId: recordingId,
        success: false,
        error: 'No recorded data',
      };
    }

    const blob = new Blob(chunks, { type: this.getSupportedMimeType() });
    const url = URL.createObjectURL(blob);

    return {
      sessionId: recordingId,
      success: true,
      blob,
      url,
      duration: session.duration,
      size: blob.size,
    };
  }

  /**
   * 清理录制资源
   */
  private cleanupRecording(recordingId: string): void {
    // 停止进度更新
    const progressInterval = this.progressIntervals.get(recordingId);
    if (progressInterval) {
      clearInterval(progressInterval);
      this.progressIntervals.delete(recordingId);
    }

    // 清理流
    const stream = this.streams.get(recordingId);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      this.streams.delete(recordingId);
    }

    // 清理 MediaRecorder
    this.mediaRecorders.delete(recordingId);

    // 清理 chunks
    this.chunks.delete(recordingId);

    console.log(`🧹 Cleaned up recording resources: ${recordingId}`);
  }

  /**
   * 启动进度更新
   */
  private startProgressUpdate(recordingId: string): void {
    const interval = setInterval(() => {
      const progress = this.getProgress(recordingId);
      if (progress) {
        this.emit('recording_progress', progress);
      }
    }, 500); // 每 500ms 更新一次

    this.progressIntervals.set(recordingId, interval);
  }

  /**
   * 更新录制状态
   */
  private updateRecordingStatus(
    recordingId: string,
    status: RecordingStatus
  ): void {
    const session = this.recordings.get(recordingId);
    if (session) {
      session.status = status;
      this.emit('recording_status_changed', {
        recordingId,
        status,
      });
    }
  }

  /**
   * 获取支持的 MIME 类型
   */
  private getSupportedMimeType(): string {
    const types = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return ''; // 默认浏览器会选择
  }

  /**
   * 清理所有录制资源
   */
  cleanup(): void {
    // 停止所有录制
    for (const [id, session] of this.recordings.entries()) {
      if (session.status === 'recording' || session.status === 'paused') {
        this.stopRecording(id).catch(console.error);
      }
    }

    // 清理所有资源
    for (const interval of this.progressIntervals.values()) {
      clearInterval(interval);
    }
    this.progressIntervals.clear();

    for (const stream of this.streams.values()) {
      stream.getTracks().forEach((track) => track.stop());
    }
    this.streams.clear();

    this.mediaRecorders.clear();
    this.chunks.clear();
    this.recordings.clear();

    console.log('🧹 VideoRecorder cleaned up');
  }
}

// 单例实例
export const videoRecorder = new VideoRecorder();
