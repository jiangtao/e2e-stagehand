import { OperationEvent } from '@/types';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface PlaybackRecord {
  id: string;
  instanceId: string;
  taskName: string;
  startTime: Date;
  endTime?: Date;
  operations: OperationEvent[];
  screenshots: string[];
  metadata: {
    userAgent?: string;
    viewport?: { width: number; height: number };
    url?: string;
  };
}

export class TaskRecorder {
  private recordings: Map<string, PlaybackRecord> = new Map();
  private recordingsDir = './task-recordings';

  constructor() {
    // 确保录制目录存在
    if (!existsSync(this.recordingsDir)) {
      mkdirSync(this.recordingsDir, { recursive: true });
    }
  }

  /**
   * 开始录制任务
   */
  startRecording(instanceId: string, taskName: string): string {
    const recordId = `${instanceId}-${Date.now()}`;
    
    const record: PlaybackRecord = {
      id: recordId,
      instanceId,
      taskName,
      startTime: new Date(),
      operations: [],
      screenshots: [],
      metadata: {}
    };

    this.recordings.set(recordId, record);
    console.log(`📹 Started recording task: ${taskName} (${recordId})`);
    
    return recordId;
  }

  /**
   * 记录操作事件
   */
  recordOperation(recordId: string, operation: OperationEvent): void {
    const record = this.recordings.get(recordId);
    if (!record) {
      console.warn(`Recording ${recordId} not found`);
      return;
    }

    record.operations.push({
      ...operation,
      timestamp: new Date()
    });

    console.log(`📝 Recorded operation: ${operation.type} for ${recordId}`);
  }

  /**
   * 记录截图
   */
  recordScreenshot(recordId: string, screenshotPath: string): void {
    const record = this.recordings.get(recordId);
    if (!record) {
      console.warn(`Recording ${recordId} not found`);
      return;
    }

    record.screenshots.push(screenshotPath);
    console.log(`📸 Recorded screenshot for ${recordId}`);
  }

  /**
   * 停止录制并保存
   */
  stopRecording(recordId: string): PlaybackRecord | null {
    const record = this.recordings.get(recordId);
    if (!record) {
      console.warn(`Recording ${recordId} not found`);
      return null;
    }

    record.endTime = new Date();
    
    // 保存到文件
    const filePath = join(this.recordingsDir, `${recordId}.json`);
    try {
      writeFileSync(filePath, JSON.stringify(record, null, 2));
      console.log(`💾 Saved recording to: ${filePath}`);
    } catch (error) {
      console.error(`Failed to save recording: ${error}`);
    }

    this.recordings.delete(recordId);
    return record;
  }

  /**
   * 加载录制文件
   */
  loadRecording(recordId: string): PlaybackRecord | null {
    const filePath = join(this.recordingsDir, `${recordId}.json`);
    
    if (!existsSync(filePath)) {
      console.warn(`Recording file not found: ${filePath}`);
      return null;
    }

    try {
      const data = readFileSync(filePath, 'utf-8');
      const record = JSON.parse(data) as PlaybackRecord;
      
      // 转换日期字符串为 Date 对象
      record.startTime = new Date(record.startTime);
      if (record.endTime) {
        record.endTime = new Date(record.endTime);
      }
      record.operations = record.operations.map(op => ({
        ...op,
        timestamp: new Date(op.timestamp)
      }));

      return record;
    } catch (error) {
      console.error(`Failed to load recording: ${error}`);
      return null;
    }
  }

  /**
   * 获取所有录制文件列表
   */
  listRecordings(): string[] {
    if (!existsSync(this.recordingsDir)) {
      return [];
    }

    try {
      const fs = require('fs');
      return fs.readdirSync(this.recordingsDir)
        .filter((file: string) => file.endsWith('.json'))
        .map((file: string) => file.replace('.json', ''));
    } catch (error) {
      console.error(`Failed to list recordings: ${error}`);
      return [];
    }
  }

  /**
   * 删除录制文件
   */
  deleteRecording(recordId: string): boolean {
    const filePath = join(this.recordingsDir, `${recordId}.json`);
    
    try {
      if (existsSync(filePath)) {
        const fs = require('fs');
        fs.unlinkSync(filePath);
        console.log(`🗑️ Deleted recording: ${recordId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to delete recording: ${error}`);
      return false;
    }
  }
}

// 全局录制器实例
export const taskRecorder = new TaskRecorder();
