<script setup lang="ts">
import { computed } from 'vue'

type IconName =
  | 'home'
  | 'waybill'
  | 'vehicle'
  | 'user'
  | 'arrow-right'
  | 'route-arrow'
  | 'nav'
  | 'location'
  | 'time'
  | 'box'
  | 'flag'
  | 'menu'
  | 'refresh'
  | 'back'
  | 'document'
  | 'check'
  | 'phone'
  | 'settings'

const props = withDefaults(
  defineProps<{
    name: IconName
    size?: string | number
    active?: boolean
    color?: string
  }>(),
  {
    size: 36,
    active: false,
    color: ''
  }
)

const iconType = computed(() => {
  const map: Record<IconName, string> = {
    home: props.active ? 'home-fill' : 'home',
    waybill: 'list',
    vehicle: '',
    user: 'user',
    'arrow-right': 'right',
    'route-arrow': '',
    nav: 'nav',
    location: 'location',
    time: 'time-line',
    box: 'gift',
    flag: 'pushpin',
    menu: 'menu',
    refresh: 'refresh',
    back: 'left',
    document: 'file',
    check: 'check-circle-fill',
    phone: 'phone',
    settings: 'settings'
  }
  return map[props.name]
})

const svgSrc = computed(() => {
  // 业务车辆及路线箭头沿用项目 SVG，其余图标统一使用 Wot UI。
  if (props.name === 'route-arrow') return '/static/icons/route-arrow.svg'
  if (props.name !== 'vehicle') return ''
  return props.active ? '/static/icons/vehicle-active.svg' : '/static/icons/vehicle.svg'
})

const imageSize = computed(() => {
  if (typeof props.size === 'number') return `${props.size}px`
  return props.size
})
</script>

<template>
  <view
    class="tms-icon"
    :style="{ width: imageSize, height: imageSize }"
    aria-hidden="true"
  >
    <image
      v-if="svgSrc"
      class="tms-icon__svg"
      :src="svgSrc"
      mode="aspectFit"
    />
    <wd-icon
      v-else
      class="tms-icon__font"
      :name="iconType"
      :size="props.size"
      :color="props.color || 'currentColor'"
    />
  </view>
</template>

<style scoped lang="scss">
.tms-icon {
  flex: 0 0 auto;
  min-width: 0;
  min-height: 0;
  aspect-ratio: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  vertical-align: middle;
}

.tms-icon__svg {
  width: 100%;
  height: 100%;
  display: block;
  flex: 0 0 auto;
}

:deep(.wd-icon) {
  width: 100%;
  height: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1 !important;
}
</style>
