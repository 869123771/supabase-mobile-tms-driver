<script setup lang="ts">
import { computed, ref } from 'vue'
import TmsIcon from './TmsIcon.vue'

const props = defineProps<{ photoUrl?: string | null }>()
const failedUrl = ref('')
const photoSrc = computed(() =>
  props.photoUrl && props.photoUrl !== failedUrl.value ? props.photoUrl : ''
)

function handlePhotoError() {
  failedUrl.value = props.photoUrl || ''
}
</script>

<template>
  <view class="vehicle-visual">
    <image
      v-if="photoSrc"
      class="vehicle-visual__photo"
      :src="photoSrc"
      mode="aspectFill"
      aria-label="当前绑定车辆照片"
      @error="handlePhotoError"
    />
    <TmsIcon v-else name="vehicle" size="52rpx" />
  </view>
</template>

<style scoped lang="scss">
.vehicle-visual {
  flex: 0 0 auto;
  overflow: hidden;
  color: var(--tms-primary);
  background: linear-gradient(145deg, #f1f4ff, #eaf0ff);
  display: flex;
  align-items: center;
  justify-content: center;
}

.vehicle-visual__photo {
  width: 100%;
  height: 100%;
}
</style>
