/**
 * 88code API 调用模块
 * 参考来源：88code-status-vscode-extension
 */

import type { Subscription } from '../types/subscription';
import { webviewLogger } from './webviewLogger';

const BASE_URL = 'https://www.88code.org';
const SUB_ENDPOINT = '/api/subscription';
const RESET_ENDPOINT = '/api/reset-credits';

function createAbortController(): AbortController | undefined {
  if (typeof globalThis.AbortController === 'function') {
    const Ctor = globalThis.AbortController as typeof AbortController;
    return new Ctor();
  }
  return undefined;
}

async function postJson(url: string, apiKey: string): Promise<Response> {
  webviewLogger.info('[88code-api] postJson called');
  webviewLogger.info('[88code-api] URL:', url);
  webviewLogger.info('[88code-api] API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'null');

  const ctrl = createAbortController();
  const timeout = setTimeout(() => {
    webviewLogger.warn('[88code-api] Request timeout (8s), aborting...');
    try {
      ctrl?.abort();
    } catch {}
  }, 8000);

  const init: RequestInit = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  };
  if (ctrl) {
    init.signal = ctrl.signal;
  }

  webviewLogger.info('[88code-api] Sending POST request...');
  const startTime = Date.now();

  try {
    const res = await fetch(url, init);
    const duration = Date.now() - startTime;
    webviewLogger.info(`[88code-api] Response received in ${duration}ms`);
    webviewLogger.info('[88code-api] Response status:', res.status);
    webviewLogger.info('[88code-api] Response ok:', res.ok);

    if (!res || typeof res.ok !== 'boolean') {
      webviewLogger.error('[88code-api] Invalid response object');
      throw new Error('Invalid response');
    }
    return res;
  } catch (error) {
    const duration = Date.now() - startTime;
    webviewLogger.error(`[88code-api] Request failed after ${duration}ms:`, error);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchSubscriptions(apiKey: string): Promise<Subscription[]> {
  webviewLogger.info('[88code-api] fetchSubscriptions called');

  if (!apiKey) {
    webviewLogger.error('[88code-api] API key missing');
    throw new Error('API key missing');
  }

  const url = `${BASE_URL}${SUB_ENDPOINT}`;
  webviewLogger.info('[88code-api] Fetching subscriptions from:', url);

  const res = await postJson(url, apiKey);

  if (!res.ok) {
    const status = res.status ?? 'unknown';
    webviewLogger.error(`[88code-api] HTTP error: ${status}`);
    // 尝试读取错误响应体
    try {
      const errorText = await res.text();
      webviewLogger.error('[88code-api] Error response body:', errorText);
    } catch (e) {
      webviewLogger.error('[88code-api] Could not read error response body');
    }
    throw new Error(`HTTP ${status}`);
  }

  webviewLogger.info('[88code-api] Parsing response JSON...');
  const body = (await res.json()) as unknown;
  webviewLogger.info('[88code-api] Response body type:', typeof body);
  webviewLogger.info('[88code-api] Is array:', Array.isArray(body));

  if (!Array.isArray(body)) {
    webviewLogger.error('[88code-api] Invalid response body - not an array:', body);
    throw new Error('Invalid response body');
  }

  webviewLogger.info('[88code-api] Received', body.length, 'subscriptions');
  webviewLogger.info('[88code-api] Subscriptions:', JSON.stringify(body, null, 2));

  return body as Subscription[];
}

export async function fetchActiveSubscriptions(apiKey: string): Promise<Subscription[]> {
  webviewLogger.info('[88code-api] fetchActiveSubscriptions called');

  const subs = await fetchSubscriptions(apiKey);
  const activeSubs = subs.filter((sub) => sub.isActive);

  webviewLogger.info('[88code-api] Total subscriptions:', subs.length);
  webviewLogger.info('[88code-api] Active subscriptions:', activeSubs.length);

  activeSubs.forEach((sub, index) => {
    webviewLogger.info(`[88code-api] Active subscription ${index + 1}:`, {
      id: sub.id,
      name: sub.subscriptionPlanName,
      credits: sub.currentCredits,
      isActive: sub.isActive,
    });
  });

  return activeSubs;
}

export async function resetCredits(apiKey: string, subscriptionId: number): Promise<string> {
  if (!apiKey) {
    throw new Error('API key missing');
  }
  if (!Number.isFinite(subscriptionId)) {
    throw new Error('Invalid subscription id');
  }

  const res = await postJson(`${BASE_URL}${RESET_ENDPOINT}/${subscriptionId}`, apiKey);
  if (!res.ok) {
    const status = res.status ?? 'unknown';
    let message = `HTTP ${status}`;
    try {
      const text = await res.text();
      if (text) {
        message += `: ${text}`;
      }
    } catch {}
    throw new Error(message);
  }

  const textBody = await res.text();
  const message = typeof textBody === 'string' ? textBody.trim() : '';
  return message || '重置成功';
}

/**
 * 从环境变量或配置中读取 API Key
 * 注意：在 webview 环境中，我们需要通过 VSCode API 传递配置
 */
export function getApiKeyFromEnv(): string | null {
  // 在 webview 中，API Key 应该通过消息传递获取
  // 这里只是一个占位符，实际实现需要通过 VSCode 扩展 API 获取
  return null;
}
