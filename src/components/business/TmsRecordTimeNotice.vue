<script setup lang="ts">
withDefaults(
  defineProps<{
    subject?: string;
  }>(),
  {
    subject: "记录时间",
  },
);
</script>

<template>
  <view class="record-time-notice">
    <wd-icon name="info-circle" size="30rpx" />
    <text>
      支持实时填报与事后补录，{{ subject }}不受当前时间或前后节点限制；系统仅提示，请按实际发生时间填写。
    </text>
  </view>
</template>

<style scoped lang="scss">
.record-time-notice {
  min-width: 0;
  margin-top: 16rpx;
  padding: 18rpx 20rpx;
  border: 1rpx solid #dbe6ff;
  border-radius: 16rpx;
  color: #315ea8;
  background: #eef5ff;
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  font-size: 23rpx;
  font-weight: 600;
  line-height: 1.55;
}

.record-time-notice text {
  min-width: 0;
  flex: 1;
}
</style>
