<script setup lang="ts">
import type { WaybillStatus } from '@/api/types'
import { getStatusStep } from '@/utils/format'

const props = defineProps<{
  status: WaybillStatus
}>()

const steps = ['接单', '装货', '运输中', '卸货', '待签收', '完成']
</script>

<template>
  <view class="progress">
    <view class="progress__labels">
      <text
        v-for="(item, index) in steps"
        :key="item"
        class="progress__label"
        :class="{ 'progress__label--active': index <= getStatusStep(props.status) }"
      >
        {{ item }}
      </text>
    </view>
    <view class="progress__track">
      <view
        class="progress__bar"
        :style="{ width: `${(getStatusStep(props.status) / (steps.length - 1)) * 100}%` }"
      />
    </view>
  </view>
</template>

<style scoped lang="scss">
.progress {
  width: 100%;
}

.progress__labels {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  margin-bottom: 14rpx;
}

.progress__label {
  color: var(--tms-muted);
  font-size: 25rpx;
  text-align: center;
  line-height: 1.2;
}

.progress__label:first-child {
  text-align: left;
}

.progress__label:last-child {
  text-align: right;
}

.progress__label--active {
  color: var(--tms-primary);
  font-weight: 700;
}

.progress__track {
  height: 16rpx;
  border-radius: 999rpx;
  background: #eef1f7;
  overflow: hidden;
}

.progress__bar {
  height: 100%;
  border-radius: inherit;
  background: var(--tms-primary);
}
</style>
