import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import '@vscode/codicons/dist/codicon.css';
import '@mdi/font/css/materialdesignicons.min.css';
import 'virtual:svg-icons-register';
import { webviewLogger } from './utils/webviewLogger';

declare global {
  interface Window {
    acquireVsCodeApi?: <T = unknown>() => {
      postMessage(data: T): void;
      getState(): any;
      setState(data: any): void;
    };
  }
}

// 初始化日志 - 测试 webviewLogger 是否正常工作
webviewLogger.info('=== WebView 初始化开始 ===');
webviewLogger.info('[main.ts] Claudix WebView starting...');

const pinia = createPinia();
const app = createApp(App);

app.use(pinia);
app.mount('#app');

webviewLogger.info('[main.ts] Claudix WebView mounted successfully');
