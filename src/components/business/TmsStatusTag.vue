<script setup lang="ts">
import { computed } from 'vue'
import type { WaybillStatus } from '@/api/types'
import { STATUS_LABEL, STATUS_TONE } from '@/utils/format'
import { useDictionaryStore } from '@/stores/dictionary'

const props = defineProps<{
  status: WaybillStatus
}>()

const dictionary = useDictionaryStore()
const label = computed(
  () => STATUS_LABEL[props.status] || dictionary.findLabel('tmsWaybillStatus', props.status) || props.status
)
</script>

<template>
  <view class="status-tag" :class="`status-tag--${STATUS_TONE[props.status] || 'gray'}`">
    <text class="status-tag__dot" />
    {{ label }}
  </view>
</template>

<style scoped lang="scss">
.status-tag {
  min-width: 96rpx;
  height: 46rpx;
  padding: 0 16rpx;
  border-radius: 999rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9rpx;
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.status-tag__dot {
  box-sizing: border-box;
  flex: 0 0 auto;
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.88;
}

.status-tag--blue {
  color: #4f46e5;
  background: #eef2ff;
}

.status-tag--green {
  color: #059669;
  background: #ecfdf5;
}

.status-tag--orange {
  color: #d97706;
  background: #fffbeb;
}

.status-tag--red {
  color: #dc2626;
  background: #fef2f2;
}

.status-tag--gray {
  color: #748096;
  background: #f7f9fc;
}
</style>
