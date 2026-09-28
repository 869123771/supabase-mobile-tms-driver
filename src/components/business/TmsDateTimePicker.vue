<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  modelValue: number
  visible: boolean
  title: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
  'update:visible': [value: boolean]
}>()

const dateVisible = ref(false)
const draftDate = ref(Date.now())
const hour = ref('')
const minute = ref('')
const calendarMin = new Date(new Date().getFullYear() - 5, 0, 1).getTime()
const calendarMax = new Date(new Date().getFullYear() + 1, 11, 31, 23, 59, 59).getTime()

const popupVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value)
})
const dateLabel = computed(() => {
  const date = new Date(draftDate.value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
})
const canConfirm = computed(() => {
  if (!/^\d{1,2}$/.test(hour.value) || !/^\d{1,2}$/.test(minute.value)) return false
  return Number(hour.value) <= 23 && Number(minute.value) <= 59
})

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    const date = new Date(props.modelValue)
    draftDate.value = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    hour.value = String(date.getHours()).padStart(2, '0')
    minute.value = String(date.getMinutes()).padStart(2, '0')
  }
)

function confirm() {
  if (!canConfirm.value) return
  const selected = new Date(draftDate.value)
  selected.setHours(Number(hour.value), Number(minute.value), 0, 0)
  emit('update:modelValue', selected.getTime())
  popupVisible.value = false
}
</script>

<template>
  <wd-popup
    v-model="popupVisible"
    position="bottom"
    safe-area-inset-bottom
    custom-style="border-radius: 28rpx 28rpx 0 0; overflow: hidden;"
  >
    <view class="datetime-sheet">
      <view class="datetime-sheet__header">
        <text class="datetime-sheet__title">{{ title }}</text>
        <wd-button
          custom-class="datetime-sheet__close"
          type="text"
          aria-label="关闭时间选择"
          @click="popupVisible = false"
        >
          <wd-icon name="close" size="32rpx" />
        </wd-button>
      </view>
      <view class="datetime-sheet__body">
        <text class="datetime-sheet__label">日期</text>
        <wd-cell
          custom-class="tms-date-trigger datetime-sheet__date"
          :value="dateLabel"
          is-link
          aria-label="选择日期"
          @click="dateVisible = true"
        />
        <wd-calendar
          v-model="draftDate"
          v-model:visible="dateVisible"
          type="date"
          title="选择日期"
          switch-mode="year-month"
          :min-date="calendarMin"
          :max-date="calendarMax"
        />
        <text class="datetime-sheet__label datetime-sheet__time-label">时间 · 24 小时制</text>
        <view class="datetime-sheet__time">
          <view class="datetime-sheet__time-field">
            <wd-input v-model="hour" type="number" inputmode="numeric" :maxlength="2" aria-label="小时" placeholder="时" />
            <text>小时</text>
          </view>
          <text class="datetime-sheet__colon">:</text>
          <view class="datetime-sheet__time-field">
            <wd-input v-model="minute" type="number" inputmode="numeric" :maxlength="2" aria-label="分钟" placeholder="分" />
            <text>分钟</text>
          </view>
        </view>
      </view>
      <view class="datetime-sheet__footer">
        <wd-button custom-class="tms-secondary-action" type="primary" variant="plain" :round="false" @click="popupVisible = false">取消</wd-button>
        <wd-button custom-class="tms-primary-action" type="primary" :round="false" :disabled="!canConfirm" @click="confirm">确定</wd-button>
      </view>
    </view>
  </wd-popup>
</template>

<style scoped lang="scss">
.datetime-sheet {
  background: #fff;
}
.datetime-sheet__header {
  min-height: 104rpx;
  padding: 24rpx 30rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1rpx solid var(--tms-line);
}
.datetime-sheet__title {
  color: var(--tms-text);
  font-size: 30rpx;
  font-weight: 800;
}
.datetime-sheet__header :deep(.datetime-sheet__close) {
  width: 64rpx;
  min-width: 44px;
  height: 64rpx;
  min-height: 44px;
  padding: 0;
  color: var(--tms-muted);
}
.datetime-sheet__body {
  padding: 26rpx 30rpx 32rpx;
}
.datetime-sheet__label {
  display: block;
  color: var(--tms-text);
  font-size: 25rpx;
  font-weight: 700;
}
.datetime-sheet__body :deep(.datetime-sheet__date) {
  margin-top: 14rpx;
}
.datetime-sheet__time-label {
  margin-top: 32rpx;
}
.datetime-sheet__time {
  margin-top: 14rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.datetime-sheet__time-field {
  flex: 1;
  min-width: 0;
  height: var(--tms-control-height);
  padding: 0 18rpx;
  border: 1rpx solid var(--tms-line);
  border-radius: var(--tms-control-radius);
  background: var(--tms-panel);
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.datetime-sheet__time-field :deep(.wd-input) {
  flex: 1;
  min-width: 0;
  padding: 0;
  background: transparent;
}
.datetime-sheet__time-field :deep(.wd-input__inner) {
  height: 100%;
  font-size: 27rpx;
  font-weight: 700;
  text-align: center;
}
.datetime-sheet__time-field text {
  color: var(--tms-muted);
  font-size: 22rpx;
  white-space: nowrap;
}
.datetime-sheet__colon {
  color: var(--tms-text);
  font-size: 30rpx;
  font-weight: 800;
}
.datetime-sheet__footer {
  padding: 20rpx 30rpx calc(20rpx + env(safe-area-inset-bottom));
  display: grid;
  grid-template-columns: 1fr 1.7fr;
  gap: 16rpx;
  border-top: 1rpx solid var(--tms-line);
}
.datetime-sheet__footer :deep(.wd-button) {
  height: var(--tms-control-height);
  border-radius: var(--tms-control-radius);
  font-size: var(--tms-control-font-size);
  font-weight: 800;
}
</style>
