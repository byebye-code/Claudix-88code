/**
 * 订阅信息管理 Composable
 */

import { ref, computed, watch } from 'vue';
import type { Ref } from 'vue';
import type { Subscription, CreditChangeRecord } from '../types/subscription';
import { fetchActiveSubscriptions } from '../utils/88code-api';
import { webviewLogger } from '../utils/webviewLogger';

// 计算单个订阅的总余额（包含重置次数）
export function calcTotalPerSub(s: Subscription): number {
  const credits = Number.isFinite(s.currentCredits) ? Math.max(s.currentCredits, 0) : 0;
  const limit = Number.isFinite(s.subscriptionPlan.creditLimit)
    ? Math.max(s.subscriptionPlan.creditLimit, 0)
    : 0;
  const resets = remainingResetTimes(s);
  const times = Number.isFinite(resets) ? Math.max(resets, 0) : 0;
  return credits + times * limit;
}

export function remainingResetTimes(s: Subscription): number {
  if (s.subscriptionPlan.planType === 'PAY_PER_USE') {
    return 0;
  }
  return s.resetTimes;
}

export function calcTotalSum(subs: Subscription[]): number {
  return subs.map((sub) => calcTotalPerSub(sub)).reduce((sum, s) => sum + s, 0);
}

/**
 * 格式化数字，不进行四舍五入，保持完整精度
 */
export function formatNumber(num: number): string {
  if (!Number.isFinite(num)) return '0';
  // 直接转换为字符串，不进行四舍五入
  return num.toString();
}

export interface SubscriptionState {
  subscriptions: Ref<Subscription[]>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;
  lastUpdate: Ref<number | null>;
  creditChangeRecords: Ref<CreditChangeRecord[]>;
  totalCredits: Ref<number>;
  refresh: (apiKey: string) => Promise<void>;
  clearRecords: () => void;
}

// 存储额度变化记录的最大数量
const MAX_RECORDS = 50;

// 单例状态 - 所有组件共享同一个订阅状态
let subscriptionStateInstance: SubscriptionState | null = null;

export function useSubscription(): SubscriptionState {
  // 如果已经存在实例，直接返回
  if (subscriptionStateInstance) {
    return subscriptionStateInstance;
  }

  // 创建新的单例实例
  const subscriptions = ref<Subscription[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const lastUpdate = ref<number | null>(null);
  const creditChangeRecords = ref<CreditChangeRecord[]>([]);

  // 计算总额度
  const totalCredits = computed(() => calcTotalSum(subscriptions.value));

  // 加载本地存储的额度变化记录
  function loadRecordsFromStorage() {
    try {
      const stored = localStorage.getItem('88code_credit_records');
      if (stored) {
        creditChangeRecords.value = JSON.parse(stored);
      }
    } catch (e) {
      webviewLogger.error('[useSubscription] Failed to load records from storage:', e);
    }
  }

  // 保存额度变化记录到本地存储
  function saveRecordsToStorage() {
    try {
      localStorage.setItem('88code_credit_records', JSON.stringify(creditChangeRecords.value));
    } catch (e) {
      webviewLogger.error('[useSubscription] Failed to save records to storage:', e);
    }
  }

  // 添加额度变化记录
  function addCreditChangeRecord(
    subscriptionId: number,
    subscriptionName: string,
    previousCredits: number,
    currentCredits: number
  ) {
    const change = currentCredits - previousCredits;

    // 只有当额度发生变化时才记录
    if (Math.abs(change) < 0.000001) return;

    const record: CreditChangeRecord = {
      id: `${subscriptionId}_${Date.now()}`,
      timestamp: Date.now(),
      previousCredits,
      currentCredits,
      change,
      subscriptionId,
      subscriptionName,
    };

    creditChangeRecords.value.unshift(record);

    // 限制记录数量
    if (creditChangeRecords.value.length > MAX_RECORDS) {
      creditChangeRecords.value = creditChangeRecords.value.slice(0, MAX_RECORDS);
    }

    saveRecordsToStorage();
  }

  // 刷新订阅信息
  async function refresh(apiKey: string) {
    webviewLogger.info('[useSubscription] refresh called');
    webviewLogger.info('[useSubscription] apiKey:', apiKey ? `${apiKey.substring(0, 10)}...` : 'null');

    if (!apiKey) {
      const errMsg = 'API Key 未配置';
      webviewLogger.error('[useSubscription]', errMsg);
      error.value = errMsg;
      return;
    }

    webviewLogger.info('[useSubscription] Starting refresh, setting isLoading to true');
    isLoading.value = true;
    error.value = null;

    try {
      webviewLogger.info('[useSubscription] Calling fetchActiveSubscriptions...');
      const activeSubs = await fetchActiveSubscriptions(apiKey);
      webviewLogger.info('[useSubscription] fetchActiveSubscriptions returned:', activeSubs.length, 'subscriptions');

      // 检测额度变化
      if (subscriptions.value.length > 0) {
        webviewLogger.info('[useSubscription] Checking for credit changes...');
        activeSubs.forEach((newSub) => {
          const oldSub = subscriptions.value.find((s) => s.id === newSub.id);
          if (oldSub && oldSub.currentCredits !== newSub.currentCredits) {
            webviewLogger.info('[useSubscription] Credit changed for subscription:', newSub.id);
            webviewLogger.info('[useSubscription] Old credits:', oldSub.currentCredits);
            webviewLogger.info('[useSubscription] New credits:', newSub.currentCredits);
            addCreditChangeRecord(
              newSub.id,
              newSub.subscriptionPlanName,
              oldSub.currentCredits,
              newSub.currentCredits
            );
          }
        });
      } else {
        webviewLogger.info('[useSubscription] No previous subscriptions to compare');
      }

      webviewLogger.info('[useSubscription] Updating subscriptions.value with', activeSubs.length, 'items');
      subscriptions.value = activeSubs;
      lastUpdate.value = Date.now();
      webviewLogger.info('[useSubscription] Refresh completed successfully');
    } catch (e) {
      const errMsg = (e as Error)?.message ?? '未知错误';
      error.value = errMsg;
      webviewLogger.error('[useSubscription] Failed to refresh:', errMsg);
      webviewLogger.error('[useSubscription] Error details:', e);
      webviewLogger.error('[useSubscription] Error stack:', (e as Error)?.stack);
    } finally {
      webviewLogger.info('[useSubscription] Setting isLoading to false');
      isLoading.value = false;
    }
  }

  // 清空额度变化记录
  function clearRecords() {
    creditChangeRecords.value = [];
    saveRecordsToStorage();
  }

  // 初始化时加载本地记录
  loadRecordsFromStorage();

  // 创建并缓存单例实例
  subscriptionStateInstance = {
    subscriptions,
    isLoading,
    error,
    lastUpdate,
    creditChangeRecords,
    totalCredits,
    refresh,
    clearRecords,
  };

  return subscriptionStateInstance;
}
