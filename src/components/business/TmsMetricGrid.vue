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
  gap: 14rpx;
}

.metric-grid__item {
  position: relative;
  min-width: 0;
  min-height: 132rpx;
  padding: 22rpx 14rpx;
  overflow: hidden;
  border: 1rpx solid #e5eaf2;
  border-radius: 20rpx;
  background: linear-gradient(150deg, #ffffff 0%, #f6f8ff 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 13rpx;
}

.metric-grid__item::before {
  position: absolute;
  top: 0;
  left: 22rpx;
  right: 22rpx;
  height: 5rpx;
  content: '';
  border-radius: 0 0 999rpx 999rpx;
  background: linear-gradient(90deg, #6366f1, #3b82f6);
  opacity: 0.72;
}

.metric-grid__label {
  color: #6c7890;
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
}

.metric-grid__value {
  color: #172033;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  font-size: 32rpx;
  font-weight: 800;
  display: flex;
  align-items: flex-end;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-grid__unit {
  margin-left: 4rpx;
  font-size: 21rpx;
  font-weight: 600;
  line-height: 1.1;
}
</style>
