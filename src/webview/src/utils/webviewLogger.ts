/**
 * WebView 日志转发工具
 * 将 console.log 等日志转发到扩展端的 Output 面板
 */

import { postMessageToExtension } from './vscodeApi';

class WebViewLogger {
  private sendLog(level: 'log' | 'info' | 'warn' | 'error' | 'debug', message: string, ...args: any[]) {
    postMessageToExtension({
      type: 'webview_log',
      level,
      message,
      args: args.length > 0 ? args : undefined,
    });
  }

  log(message: string, ...args: any[]) {
    console.log(message, ...args);
    this.sendLog('log', message, ...args);
  }

  info(message: string, ...args: any[]) {
    console.info(message, ...args);
    this.sendLog('info', message, ...args);
  }

  warn(message: string, ...args: any[]) {
    console.warn(message, ...args);
    this.sendLog('warn', message, ...args);
  }

  error(message: string, ...args: any[]) {
    console.error(message, ...args);
    this.sendLog('error', message, ...args);
  }

  debug(message: string, ...args: any[]) {
    console.debug(message, ...args);
    this.sendLog('debug', message, ...args);
  }
}

// 导出单例
export const webviewLogger = new WebViewLogger();
