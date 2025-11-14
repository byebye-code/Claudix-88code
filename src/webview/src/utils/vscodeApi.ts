/**
 * VSCode API 单例管理
 * 
 * VS Code 规定 acquireVsCodeApi() 只能被调用一次，
 * 所以我们需要创建一个单例来管理这个 API 实例。
 */

interface VsCodeApi {
  postMessage(message: any): void;
  getState(): any;
  setState(data: any): void;
}

let vscodeApiInstance: VsCodeApi | null = null;

/**
 * 获取 VSCode API 实例（单例）
 */
export function getVsCodeApi(): VsCodeApi | null {
  if (vscodeApiInstance) {
    return vscodeApiInstance;
  }

  if (typeof window !== 'undefined' && (window as any).acquireVsCodeApi) {
    try {
      vscodeApiInstance = (window as any).acquireVsCodeApi();
      console.log('[vscodeApi] VSCode API acquired successfully');
      return vscodeApiInstance;
    } catch (error) {
      console.error('[vscodeApi] Failed to acquire VSCode API:', error);
      return null;
    }
  }

  return null;
}

/**
 * 发送消息到扩展端
 */
export function postMessageToExtension(message: any): void {
  const api = getVsCodeApi();
  if (api) {
    api.postMessage(message);
  } else {
    console.error('[vscodeApi] VSCode API not available, cannot send message');
  }
}
