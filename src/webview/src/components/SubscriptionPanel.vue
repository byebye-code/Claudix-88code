<template>
  <div class="subscription-panel">
    <!-- 折叠/展开按钮 -->
    <div class="panel-header" @click="togglePanel">
      <span class="codicon codicon-credit-card"></span>
      <span class="panel-title">88code 额度信息</span>
      <span class="codicon" :class="isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'"></span>
    </div>

    <!-- 面板内容 -->
    <div v-if="isExpanded" class="panel-content">
      <!-- 加载状态 -->
      <div v-if="isLoading" class="loading-state">
        <span class="codicon codicon-loading codicon-modifier-spin"></span>
        <span>正在获取订阅信息...</span>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="error-state">
        <span class="codicon codicon-error"></span>
        <span>{{ error }}</span>
        <button class="retry-btn" @click="handleRefresh">
          <span class="codicon codicon-refresh"></span>
          重试
        </button>
      </div>

      <!-- 无订阅状态 -->
      <div v-else-if="subscriptions.length === 0" class="empty-state">
        <span class="codicon codicon-info"></span>
        <span>未找到活跃订阅</span>
      </div>

      <!-- 订阅信息显示 -->
      <div v-else class="subscription-content">
        <!-- 总额度显示 -->
        <div class="total-credits">
          <span class="label">总剩余额度：</span>
          <span class="value">${{ formatNumber(totalCredits) }}</span>
        </div>

        <!-- 订阅列表 -->
        <div class="subscription-list">
          <div
            v-for="sub in subscriptions"
            :key="sub.id"
            class="subscription-item"
          >
            <div class="sub-header">
              <span class="sub-name">{{ sub.subscriptionPlanName || '(未命名)' }}</span>
              <span class="sub-badge" :class="sub.isActive ? 'active' : 'inactive'">
                {{ sub.isActive ? '激活' : '未激活' }}
              </span>
            </div>
            <div class="sub-details">
              <div class="detail-row">
                <span class="detail-label">当前额度：</span>
                <span class="detail-value">${{ formatNumber(sub.currentCredits) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">额度上限：</span>
                <span class="detail-value">${{ formatNumber(sub.subscriptionPlan.creditLimit) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">剩余重置次数：</span>
                <span class="detail-value">{{ remainingResetTimes(sub) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">总可用额度：</span>
                <span class="detail-value highlight">${{ formatNumber(calcTotalPerSub(sub)) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">计费周期：</span>
                <span class="detail-value">{{ sub.billingCycleDesc || sub.billingCycle }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 额度变化记录 -->
        <div v-if="creditChangeRecords.length > 0" class="change-records">
          <div class="records-header">
            <span class="records-title">
              <span class="codicon codicon-history"></span>
              额度变化记录
            </span>
            <button class="clear-btn" @click="handleClearRecords" title="清空记录">
              <span class="codicon codicon-trash"></span>
            </button>
          </div>
          <div class="records-list">
            <div
              v-for="record in displayRecords"
              :key="record.id"
              class="record-item"
              :class="{ positive: record.change > 0, negative: record.change < 0 }"
            >
              <div class="record-time">{{ formatTime(record.timestamp) }}</div>
              <div class="record-info">
                <span class="record-sub-name">{{ record.subscriptionName }}</span>
                <span class="record-change">
                  <span v-if="record.change > 0" class="change-icon">↑</span>
                  <span v-else class="change-icon">↓</span>
                  <span>{{ formatNumber(Math.abs(record.change)) }}</span>
                </span>
              </div>
              <div class="record-details">
                <span>${{ formatNumber(record.previousCredits) }}</span>
                <span class="arrow">→</span>
                <span>${{ formatNumber(record.currentCredits) }}</span>
              </div>
            </div>
          </div>
          <div v-if="creditChangeRecords.length > maxDisplayRecords" class="show-more">
            <button @click="toggleShowAll">
              {{ showAllRecords ? '收起' : `显示全部 (${creditChangeRecords.length})` }}
            </button>
          </div>
        </div>

        <!-- 刷新按钮 -->
        <div class="actions">
          <button class="refresh-btn" @click="handleRefresh" :disabled="isLoading">
            <span class="codicon codicon-refresh"></span>
            刷新
          </button>
          <span v-if="lastUpdate" class="last-update">
            最后更新: {{ formatTime(lastUpdate) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSubscription, formatNumber, calcTotalPerSub, remainingResetTimes } from '../composables/useSubscription';
import { webviewLogger } from '../utils/webviewLogger';

const props = defineProps<{
  apiKey: string | null;
}>();

const emit = defineEmits<{
  refresh: [];
}>();

// 使用订阅状态管理
const {
  subscriptions,
  isLoading,
  error,
  lastUpdate,
  creditChangeRecords,
  totalCredits,
  refresh,
  clearRecords,
} = useSubscription();

// 面板展开状态
const isExpanded = ref(true);
const showAllRecords = ref(false);
const maxDisplayRecords = 10;

const displayRecords = computed(() => {
  if (showAllRecords.value) {
    return creditChangeRecords.value;
  }
  return creditChangeRecords.value.slice(0, maxDisplayRecords);
});

function togglePanel() {
  isExpanded.value = !isExpanded.value;
}

function toggleShowAll() {
  showAllRecords.value = !showAllRecords.value;
}

async function handleRefresh() {
  webviewLogger.info('[SubscriptionPanel] handleRefresh called');
  if (!props.apiKey) {
    webviewLogger.warn('[SubscriptionPanel] No API key provided');
    return;
  }
  webviewLogger.info('[SubscriptionPanel] Calling refresh with API key...');
  await refresh(props.apiKey);
  webviewLogger.info('[SubscriptionPanel] Refresh completed, emitting refresh event');
  emit('refresh');
}

function handleClearRecords() {
  if (confirm('确定要清空所有额度变化记录吗？')) {
    clearRecords();
  }
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // 小于 1 分钟
  if (diff < 60000) {
    return '刚刚';
  }

  // 小于 1 小时
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} 分钟前`;
  }

  // 小于 1 天
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} 小时前`;
  }

  // 小于 7 天
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days} 天前`;
  }

  // 否则显示完整日期时间
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 初始加载
if (props.apiKey) {
  void handleRefresh();
}
</script>

<style scoped>
.subscription-panel {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
  margin-bottom: 12px;
  background: var(--vscode-editor-background);
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.panel-header:hover {
  background: var(--vscode-list-hoverBackground);
}

.panel-title {
  flex: 1;
  font-weight: 500;
  font-size: 13px;
}

.panel-content {
  padding: 12px;
  border-top: 1px solid var(--vscode-panel-border);
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.error-state {
  color: var(--vscode-errorForeground);
}

.retry-btn,
.refresh-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid var(--vscode-button-border);
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.2s;
}

.retry-btn:hover,
.refresh-btn:hover {
  background: var(--vscode-button-hoverBackground);
}

.retry-btn:disabled,
.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.subscription-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.total-credits {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 10px 12px;
  background: var(--vscode-list-hoverBackground);
  border-radius: 4px;
  font-size: 14px;
}

.total-credits .label {
  font-weight: 500;
  color: var(--vscode-foreground);
}

.total-credits .value {
  font-size: 16px;
  font-weight: 600;
  color: var(--vscode-textLink-foreground);
  font-family: var(--vscode-editor-font-family, monospace);
}

.subscription-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.subscription-item {
  padding: 10px;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  background: var(--vscode-sideBar-background);
}

.sub-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.sub-name {
  font-weight: 500;
  font-size: 13px;
}

.sub-badge {
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 500;
}

.sub-badge.active {
  background: var(--vscode-testing-iconPassed);
  color: var(--vscode-editor-background);
}

.sub-badge.inactive {
  background: var(--vscode-descriptionForeground);
  color: var(--vscode-editor-background);
}

.sub-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding: 2px 0;
}

.detail-label {
  color: var(--vscode-descriptionForeground);
}

.detail-value {
  font-family: var(--vscode-editor-font-family, monospace);
  color: var(--vscode-foreground);
}

.detail-value.highlight {
  font-weight: 600;
  color: var(--vscode-textLink-foreground);
}

.change-records {
  margin-top: 8px;
  border-top: 1px solid var(--vscode-panel-border);
  padding-top: 12px;
}

.records-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.records-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  font-size: 12px;
}

.clear-btn {
  display: flex;
  align-items: center;
  padding: 4px;
  border: none;
  background: transparent;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  border-radius: 3px;
  transition: background-color 0.2s;
}

.clear-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
  color: var(--vscode-errorForeground);
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 300px;
  overflow-y: auto;
}

.record-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border-radius: 4px;
  font-size: 11px;
  border-left: 3px solid var(--vscode-panel-border);
}

.record-item.positive {
  background: rgba(0, 128, 0, 0.1);
  border-left-color: var(--vscode-testing-iconPassed);
}

.record-item.negative {
  background: rgba(255, 0, 0, 0.1);
  border-left-color: var(--vscode-errorForeground);
}

.record-time {
  color: var(--vscode-descriptionForeground);
  font-size: 10px;
}

.record-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.record-sub-name {
  font-weight: 500;
  font-size: 11px;
}

.record-change {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
  font-family: var(--vscode-editor-font-family, monospace);
}

.record-item.positive .record-change {
  color: var(--vscode-testing-iconPassed);
}

.record-item.negative .record-change {
  color: var(--vscode-errorForeground);
}

.change-icon {
  font-size: 14px;
}

.record-details {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
}

.arrow {
  opacity: 0.6;
}

.show-more {
  margin-top: 8px;
  text-align: center;
}

.show-more button {
  padding: 4px 12px;
  border: 1px solid var(--vscode-button-border);
  background: transparent;
  color: var(--vscode-textLink-foreground);
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  transition: background-color 0.2s;
}

.show-more button:hover {
  background: var(--vscode-list-hoverBackground);
}

.actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--vscode-panel-border);
}

.last-update {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.codicon-modifier-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
