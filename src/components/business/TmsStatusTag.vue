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
  () => dictionary.findLabel('tmsWaybillStatus', props.status) || STATUS_LABEL[props.status] || props.status
)
</script>

<template>
  <view class="status-tag" :class="`status-tag--${STATUS_TONE[props.status] || 'gray'}`">
    {{ label }}
  </view>
</template>

<style scoped lang="scss">
.status-tag {
  min-width: 96rpx;
  height: 48rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
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
