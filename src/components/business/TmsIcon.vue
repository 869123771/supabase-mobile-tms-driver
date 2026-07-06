<script setup lang="ts">
import { computed } from 'vue'
import UniIcons from '@dcloudio/uni-ui/lib/uni-icons/uni-icons.vue'

type IconName =
  | 'home'
  | 'waybill'
  | 'vehicle'
  | 'user'
  | 'arrow-right'
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
  const filled = props.active ? '-filled' : ''
  const map: Record<IconName, string> = {
    home: `home${filled}`,
    waybill: props.active ? 'checkbox-filled' : 'list',
    vehicle: '',
    user: `person${filled}`,
    'arrow-right': 'arrow-right',
    nav: props.active ? 'paperplane-filled' : 'paperplane',
    location: 'location',
    time: 'calendar',
    box: 'gift',
    flag: props.active ? 'flag-filled' : 'flag',
    menu: 'bars',
    refresh: 'refreshempty',
    back: 'left',
    document: 'compose',
    check: 'checkbox-filled',
    phone: 'phone-filled',
    settings: 'gear'
  }
  return map[props.name]
})

const svgSrc = computed(() => {
  // Icons missing from uni-icons should be added under /static/icons and routed here.
  if (props.name !== 'vehicle') return ''
  return props.active ? '/static/icons/vehicle-active.svg' : '/static/icons/vehicle.svg'
})

const imageSize = computed(() => {
  if (typeof props.size === 'number') return `${props.size}px`
  return props.size
})
</script>

<template>
  <image
    v-if="svgSrc"
    class="tms-icon__svg"
    :src="svgSrc"
    :style="{ width: imageSize, height: imageSize }"
    mode="aspectFit"
  />
  <UniIcons v-else :type="iconType" :size="props.size" :color="props.color || 'currentColor'" />
</template>

<style scoped lang="scss">
.tms-icon__svg {
  display: block;
  flex: 0 0 auto;
}
</style>
