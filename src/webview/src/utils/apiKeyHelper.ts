/**
 * 88code API Key 辅助工具
 */

import type { Get88CodeApiKeyRequest, Get88CodeApiKeyResponse } from '../../../shared/messages';
import { webviewLogger } from './webviewLogger';

/**
 * 获取 88code API Key
 * @param transport - VSCode 通信传输层
 * @returns API Key 或 null
 */
export async function get88CodeApiKey(transport: any): Promise<string | null> {
  webviewLogger.info('[apiKeyHelper] get88CodeApiKey called');
  webviewLogger.info('[apiKeyHelper] transport available:', !!transport);
  webviewLogger.info('[apiKeyHelper] sendRequest available:', !!(transport && transport.sendRequest));

  if (!transport || !transport.sendRequest) {
    webviewLogger.error('[apiKeyHelper] Transport not available');
    return null;
  }

  try {
    const request: Get88CodeApiKeyRequest = {
      type: 'get_88code_api_key',
    };

    webviewLogger.info('[apiKeyHelper] Sending request to extension:', request);
    const response = (await transport.sendRequest(request)) as Get88CodeApiKeyResponse;

    webviewLogger.info('[apiKeyHelper] Received response:', {
      type: response?.type,
      hasApiKey: !!(response as any)?.apiKey,
    });

    if (response && response.type === 'get_88code_api_key_response') {
      const apiKey = response.apiKey;
      if (apiKey) {
        webviewLogger.info('[apiKeyHelper] API Key received:', `${apiKey.substring(0, 10)}...`);
        webviewLogger.info('[apiKeyHelper] API Key starts with "88_":', apiKey.startsWith('88_'));
      } else {
        webviewLogger.warn('[apiKeyHelper] Response received but API Key is null');
      }
      return apiKey;
    }

    webviewLogger.warn('[apiKeyHelper] Invalid response type:', response?.type);
    return null;
  } catch (error) {
    webviewLogger.error('[apiKeyHelper] Failed to get API key:', error);
    webviewLogger.error('[apiKeyHelper] Error stack:', (error as Error)?.stack);
    return null;
  }
}
