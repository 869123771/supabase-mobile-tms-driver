<script setup lang="ts">
import type { WaybillStatus } from '@/api/types'
import { STATUS_LABEL, STATUS_TONE } from '@/utils/format'

const props = defineProps<{
  status: WaybillStatus
}>()
</script>

<template>
  <view class="status-tag" :class="`status-tag--${STATUS_TONE[props.status] || 'gray'}`">
    {{ STATUS_LABEL[props.status] || props.status }}
  </view>
</template>

<style scoped lang="scss">
.status-tag {
  min-width: 112rpx;
  height: 52rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.status-tag--blue {
  color: var(--tms-primary);
  background: #edf2ff;
}

.status-tag--green {
  color: var(--tms-green);
  background: #e9f9f1;
}

.status-tag--orange {
  color: var(--tms-orange);
  background: #fff4ea;
}

.status-tag--red {
  color: var(--tms-red);
  background: #fff0f0;
}

.status-tag--gray {
  color: var(--tms-muted);
  background: #f1f3f8;
}
</style>
