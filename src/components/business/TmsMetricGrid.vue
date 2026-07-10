<script setup lang="ts">
interface MetricItem {
  label: string
  value: string | number
  unit?: string
}

defineProps<{
  items: MetricItem[]
}>()
</script>

<template>
  <view class="metric-grid">
    <view v-for="item in items" :key="item.label" class="metric-grid__item">
      <text class="metric-grid__label">{{ item.label }}</text>
      <view class="metric-grid__value">
        <text>{{ item.value }}</text>
        <text v-if="item.unit" class="metric-grid__unit">{{ item.unit }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 22rpx;
}

.metric-grid__item {
  min-height: 144rpx;
  border-radius: 8rpx;
  background: var(--tms-panel);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
}

.metric-grid__label {
  color: var(--tms-muted);
  font-size: 24rpx;
  line-height: 1.2;
}

.metric-grid__value {
  color: var(--tms-text);
  font-size: 34rpx;
  font-weight: 600;
  display: flex;
  align-items: flex-end;
  line-height: 1;
}

.metric-grid__unit {
  margin-left: 4rpx;
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.1;
}
</style>
