/**
 * 视频流捕获器
 * 从页面捕获视频流并同步到 Canvas 元素
 */

export interface VideoCaptureConfig {
  selector?: string;      // 视频/媒体元素选择器
  canvasId?: string;      // 目标 canvas ID
  fps?: number;          // 捕获帧率
  quality?: number;       // 捕获质量 (0-1)
}

export interface CaptureResult {
  success: boolean;
  videoCount: number;
  canvasReady: boolean;
  errors: string[];
}

/**
 * 视频流捕获器
 * 使用 CDP 命令捕获页面视频并渲染到 Canvas
 */
export class VideoCapture {
  private config: VideoCaptureConfig;
  private capturing = false;
  private captureInterval?: NodeJS.Timeout;

  constructor(config: VideoCaptureConfig = {}) {
    this.config = {
      selector: config.selector || 'video, canvas[source], object[type="video"]',
      canvasId: config.canvasId || 'video-preview',
      fps: config.fps || 30,
      quality: config.quality || 0.8,
    };
  }

  /**
   * 在指定页面开始捕获视频
   */
  async startCapture(page: any): Promise<CaptureResult> {
    const result: CaptureResult = {
      success: false,
      videoCount: 0,
      canvasReady: false,
      errors: [],
    };

    try {
      // 1. 查找视频元素
      const videos = await page.sendCDP('DOM.getDocument', {});

      // 2. 搜索所有视频/媒体元素
      const { root } = videos;
      const videoElements = await this.findVideoElements(page, root.nodeId);

      result.videoCount = videoElements.length;
      console.log(`[VideoCapture] 找到 ${videoElements.length} 个视频元素`);

      if (videoElements.length === 0) {
        result.errors.push('未找到视频元素');
        return result;
      }

      // 3. 为每个视频元素设置捕获
      for (const videoInfo of videoElements) {
        await this.setupVideoCapture(page, videoInfo);
      }

      // 4. 确认 canvas 已创建
      const canvasExists = await this.checkCanvasExists(page);
      result.canvasReady = canvasExists;

      if (!canvasExists) {
        result.errors.push('Canvas 元素未创建');
        return result;
      }

      this.capturing = true;
      result.success = true;

      console.log('[VideoCapture] 视频捕获已启动');
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    return result;
  }

  /**
   * 查找页面中的视频元素
   */
  private async findVideoElements(page: any, rootNodeId: number): Promise<any[]> {
    const videos: any[] = [];

    try {
      // 使用 querySelectorAll 查找视频元素
      const result = await page.sendCDP('DOM.querySelectorAll', {
        nodeId: rootNodeId,
        selector: this.config.selector!,
      });

      if (result.nodeIds && result.nodeIds.length > 0) {
        for (const nodeId of result.nodeIds) {
          const nodeInfo = await page.sendCDP('DOM.describeNode', { nodeId });
          const attributes = nodeInfo.node.attributes || [];

          videos.push({
            nodeId,
            tagName: nodeInfo.node.nodeName,
            src: this.findAttribute(attributes, 'src'),
            type: this.findAttribute(attributes, 'type'),
          });
        }
      }
    } catch (error) {
      console.error('[VideoCapture] 查找视频元素失败:', error);
    }

    return videos;
  }

  /**
   * 为视频元素设置捕获
   */
  private async setupVideoCapture(page: any, videoInfo: any): Promise<void> {
    const script = `
      (function() {
        return new Promise((resolve, reject) => {
          try {
            // 创建或获取 canvas
            let canvas = document.getElementById('${this.config.canvasId}');
            if (!canvas) {
              canvas = document.createElement('canvas');
              canvas.id = '${this.config.canvasId}';
              canvas.style.cssText = 'position:fixed;top:10px;right:10px;width:320px;height:240px;background:#000;z-index:9999;border:2px solid #fff;';
              document.body.appendChild(canvas);
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('无法获取 canvas context'));
              return;
            }

            // 查找视频元素
            const video = document.querySelector('${this.config.selector}');
            if (!video) {
              reject(new Error('未找到视频元素'));
              return;
            }

            // 设置视频播放并捕获到 canvas
            video.play().then(() => {
              function captureFrame() {
                if (video.paused || video.ended) {
                  return;
                }
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                requestAnimationFrame(captureFrame);
              }

              canvas.width = video.videoWidth || 320;
              canvas.height = video.videoHeight || 240;
              captureFrame();
              resolve({ success: true, canvasId: '${this.config.canvasId}' });
            }).catch(reject);

          } catch (error) {
            reject(error);
          }
        });
      })();
    `;

    await page.sendCDP('Runtime.evaluate', {
      expression: script,
      awaitPromise: true,
    });
  }

  /**
   * 检查 canvas 是否存在
   */
  private async checkCanvasExists(page: any): Promise<boolean> {
    try {
      const result = await page.sendCDP('Runtime.evaluate', {
        expression: `document.getElementById('${this.config.canvasId}') !== null`,
        returnByValue: true,
      });
      return result.result?.value || false;
    } catch {
      return false;
    }
  }

  /**
   * 从属性列表中查找指定属性
   */
  private findAttribute(attributes: any[], name: string): string | undefined {
    return attributes.find((attr: any) => attr.name === name)?.value;
  }

  /**
   * 停止捕获
   */
  async stopCapture(page: any): Promise<void> {
    if (!this.capturing) return;

    try {
      // 移除 canvas
      await page.sendCDP('Runtime.evaluate', {
        expression: `
          (function() {
            const canvas = document.getElementById('${this.config.canvasId}');
            if (canvas) {
              canvas.remove();
            }
          })();
        `,
      });
    } catch (error) {
      console.error('[VideoCapture] 停止捕获失败:', error);
    }

    this.capturing = false;
  }
}
