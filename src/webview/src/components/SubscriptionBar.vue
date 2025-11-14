<template>
  <div class="subscription-bar">
    <div v-if="subscriptions.length === 0" class="no-subscription">
      未配置订阅
    </div>
    <div v-else class="subscription-list">
      <div 
        v-for="sub in changedSubscriptions" 
        :key="sub.id" 
        class="subscription-item"
      >
        <span class="plan-name">{{ sub.subscriptionPlanName }}</span>
        <span class="separator">|</span>
        <span class="balance-with-change">
          <span class="current-balance">${{ formatNumber(sub.currentCredits) }}</span>
          <span 
            v-if="getSubscriptionChange(sub.id) !== 0"
            class="change-indicator" 
            :class="{ positive: getSubscriptionChange(sub.id)! > 0, negative: getSubscriptionChange(sub.id)! < 0 }"
          >
            {{ getSubscriptionChange(sub.id)! > 0 ? '+' : '' }}${{ Math.abs(getSubscriptionChange(sub.id)!) }}
          </span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useSubscription, formatNumber } from '../composables/useSubscription';
import { webviewLogger } from '../utils/webviewLogger';

const props = defineProps<{
  apiKey: string | null;
}>();

const {
  subscriptions,
  refresh,
} = useSubscription();

// 存储每个订阅的历史余额和变化
interface SubscriptionHistory {
  previousBalance: number;
  changeAmount: number;
  changeTimestamp: number;
}

const subscriptionHistory = ref<Map<number, SubscriptionHistory>>(new Map());

// 获取指定订阅的变化金额（1 秒后隐藏徽章）
function getSubscriptionChange(subscriptionId: number): number | null {
  const history = subscriptionHistory.value.get(subscriptionId);
  if (!history) return null;
  
  // 如果有历史记录
  if (history.changeTimestamp > 0) {
    const now = Date.now();
    const elapsed = now - history.changeTimestamp;
    
    // 变化发生后 1 秒内，显示变化金额
    if (elapsed < 1000) {
      return history.changeAmount;
    }
    
    // 超过 1 秒，返回 0（订阅仍显示，但不显示徽章）
    return 0;
  }
  return null;
}

// 计算有变化记录的订阅列表（持久显示）
const changedSubscriptions = computed(() => {
  return subscriptions.value.filter(sub => {
    const change = getSubscriptionChange(sub.id);
    // 只要有记录就显示（包括变化为 0 的情况）
    return change !== null;
  });
});

// 监听所有订阅的变化（记录变化，徽章显示 1 秒）
watch(subscriptions, (newSubs, oldSubs) => {
  if (!newSubs || newSubs.length === 0) return;

  let hasAnyChange = false;

  newSubs.forEach(newSub => {
    const history = subscriptionHistory.value.get(newSub.id);
    
    if (!history) {
      // 第一次记录，不显示变化
      subscriptionHistory.value.set(newSub.id, {
        previousBalance: newSub.currentCredits,
        changeAmount: 0,
        changeTimestamp: 0
      });
      webviewLogger.debug(`[SubscriptionBar] Initial record for ${newSub.subscriptionPlanName}: $${newSub.currentCredits}`);
    } else {
      // 检查余额是否变化
      const change = newSub.currentCredits - history.previousBalance;
      
      if (Math.abs(change) > 0.000001) {
        hasAnyChange = true;
        
        webviewLogger.info(`[SubscriptionBar] 💰 Subscription ${newSub.subscriptionPlanName} balance changed!`, {
          id: newSub.id,
          previous: history.previousBalance,
          current: newSub.currentCredits,
          change: change,
          changeFormatted: change > 0 ? `+$${Math.abs(change)}` : `-$${Math.abs(change)}`
        });

        // 更新历史记录（记录变化和时间戳）
        subscriptionHistory.value.set(newSub.id, {
          previousBalance: newSub.currentCredits,
          changeAmount: change,  // 记录变化金额
          changeTimestamp: Date.now()  // 记录时间戳，用于 1 秒后隐藏徽章
        });
      }
    }
  });

  if (!hasAnyChange) {
    webviewLogger.debug('[SubscriptionBar] No subscription changes detected in this refresh');
  }
}, { deep: true });

// 初始刷新
async function doInitialRefresh(apiKey: string) {
  webviewLogger.info('[SubscriptionBar] Starting initial refresh...');
  try {
    await refresh(apiKey);
    webviewLogger.info('[SubscriptionBar] Initial refresh completed');
    webviewLogger.info('[SubscriptionBar] subscriptions after refresh:', subscriptions.value);

    // 设置初始余额
    if (mainSubscription.value) {
      previousBalance = mainSubscription.value.currentCredits;
      webviewLogger.info('[SubscriptionBar] Initial balance set:', previousBalance);
    } else {
      webviewLogger.warn('[SubscriptionBar] No subscription found after refresh!');
    }
  } catch (error) {
    webviewLogger.error('[SubscriptionBar] Initial refresh failed:', error);
  }
}

onMounted(() => {
  webviewLogger.info('[SubscriptionBar] Component mounted');
  webviewLogger.info('[SubscriptionBar] props.apiKey:', props.apiKey ? `${props.apiKey.substring(0, 10)}...` : 'null');

  if (props.apiKey) {
    void doInitialRefresh(props.apiKey);
  } else {
    webviewLogger.warn('[SubscriptionBar] No API key provided yet, waiting...');
  }
});

// 监听 API Key 变化 - 当 ChatPage 异步获取到 API Key 后触发刷新
watch(() => props.apiKey, (newKey, oldKey) => {
  webviewLogger.info('[SubscriptionBar] 🔑 API Key changed:', {
    old: oldKey ? `${oldKey.substring(0, 10)}...` : 'null',
    new: newKey ? `${newKey.substring(0, 10)}...` : 'null'
  });
  
  if (newKey && !oldKey) {
    // 首次获取到 API Key
    webviewLogger.info('[SubscriptionBar] 🚀 First time getting API Key, triggering initial refresh');
    void doInitialRefresh(newKey);
  }
});

// 监听 subscriptions 变化 - 添加额外的调试日志
watch(subscriptions, (newSubs) => {
  webviewLogger.info('[SubscriptionBar] 📊 Subscriptions updated:', {
    count: newSubs.length,
    firstSub: newSubs.length > 0 ? {
      name: newSubs[0].subscriptionPlanName,
      credits: newSubs[0].currentCredits
    } : null
  });
}, { deep: true });

// 定时刷新（每 1 秒 - 实时更新）
let refreshInterval: NodeJS.Timeout | undefined;
onMounted(() => {
  refreshInterval = setInterval(() => {
    webviewLogger.info('[SubscriptionBar] Auto refresh triggered (every 1s)');
    if (props.apiKey) {
      webviewLogger.info('[SubscriptionBar] Refreshing with API key...');
      void refresh(props.apiKey);
    } else {
      webviewLogger.warn('[SubscriptionBar] No API key for auto refresh');
    }
  }, 1000); // 改为每秒刷新
  webviewLogger.info('[SubscriptionBar] Auto refresh interval set (1s for real-time updates)');
});

import { onUnmounted } from 'vue';
onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
</script>

<style scoped>
.subscription-bar {
  padding: 6px 12px 0 12px;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  font-family: var(--vscode-editor-font-family, monospace);
}

.no-subscription {
  color: var(--vscode-descriptionForeground);
  opacity: 0.7;
  font-size: 11px;
}

.subscription-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.subscription-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  transition: all 0.3s ease;
  background: rgba(78, 201, 176, 0.1);
  border-radius: 4px;
  margin: -2px -8px;
}

.plan-name {
  font-weight: 500;
  color: var(--vscode-foreground);
  min-width: 60px;
}

.separator {
  opacity: 0.5;
}

.balance {
  color: var(--vscode-foreground);
}

.balance-with-change {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.current-balance {
  color: var(--vscode-foreground);
}

.change-indicator {
  font-weight: 600;
  animation: pulse 0.5s ease-in-out;
  font-size: 11px;
}

.change-indicator.positive {
  color: #4ec9b0;
}

.change-indicator.negative {
  color: #f48771;
}

@keyframes pulse {
  0% {
    transform: scale(0.95);
    opacity: 0;
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
