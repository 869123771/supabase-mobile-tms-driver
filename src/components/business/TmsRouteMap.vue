<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Waybill } from '@/api/types'
import { getWaybillRoutePoints } from '@/utils/route'
import TmsIcon from './TmsIcon.vue'

interface RoutePoint {
  longitude: number
  latitude: number
}

const props = defineProps<{
  waybill?: Waybill | null
}>()

const emit = defineEmits<{
  back: []
}>()

interface MapTile {
  id: string
  url: string
  style: Record<string, string>
}

const amapRef = ref<HTMLElement | null>(null)
const fallbackRef = ref<HTMLElement | null>(null)
const mapSize = ref({ width: 375, height: 260 })
const manualZoom = ref<number | null>(null)
const panOffset = ref({ x: 0, y: 0 })
const isPanning = ref(false)
const panStart = ref({ x: 0, y: 0 })
const tileSize = 256
const amapMapId = `route-amap-${Math.random().toString(36).slice(2)}`
const routeReady = ref(false)
const routeError = ref('')
let amap: any
let driving: any
let renderSeq = 0

const points = computed(() => getWaybillRoutePoints(props.waybill))

const center = computed(() => points.value[0] || { longitude: 120.1551, latitude: 30.2741 })
const h5Zoom = computed(() => manualZoom.value ?? getFitZoom())

const markers = computed(() => {
  const first = points.value[0]
  const last = points.value[points.value.length - 1]
  return [first, last]
    .filter((point): point is RoutePoint => Boolean(point))
    .map((point, index) => ({
      id: index + 1,
      longitude: point.longitude,
      latitude: point.latitude,
      width: 24,
      height: 24,
      callout: {
        content: index === 0 ? '起' : '终',
        color: '#ffffff',
        fontSize: 12,
        borderRadius: 14,
        bgColor: index === 0 ? '#24bf78' : '#ff944d',
        padding: 6,
        display: 'ALWAYS'
      }
    }))
})

const polyline = computed(() => [
  {
    points: points.value,
    color: '#20c7a7',
    width: 8,
    dottedLine: false,
    arrowLine: true,
    borderColor: '#dff8f3',
    borderWidth: 2
  }
])

function project(longitude: number, latitude: number, zoom: number) {
  const scale = tileSize * 2 ** zoom
  const sinLat = Math.sin((latitude * Math.PI) / 180)
  return {
    x: ((longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale
  }
}

function getProjectedPoints(zoom = h5Zoom.value) {
  return points.value.map((point) => ({
    ...point,
    world: project(point.longitude, point.latitude, zoom)
  }))
}

function getWorldBounds(zoom: number) {
  const projected = getProjectedPoints(zoom)
  if (!projected.length) {
    const world = project(center.value.longitude, center.value.latitude, zoom)
    return { minX: world.x, maxX: world.x, minY: world.y, maxY: world.y }
  }
  return projected.reduce(
    (bounds, item) => ({
      minX: Math.min(bounds.minX, item.world.x),
      maxX: Math.max(bounds.maxX, item.world.x),
      minY: Math.min(bounds.minY, item.world.y),
      maxY: Math.max(bounds.maxY, item.world.y)
    }),
    {
      minX: projected[0]?.world.x || 0,
      maxX: projected[0]?.world.x || 0,
      minY: projected[0]?.world.y || 0,
      maxY: projected[0]?.world.y || 0
    }
  )
}

function getFitZoom() {
  if (points.value.length < 2) return 12
  const padding = 76
  const availableWidth = Math.max(120, mapSize.value.width - padding * 2)
  const availableHeight = Math.max(120, mapSize.value.height - padding * 2)

  for (let zoom = 14; zoom >= 4; zoom -= 1) {
    const bounds = getWorldBounds(zoom)
    if (bounds.maxX - bounds.minX <= availableWidth && bounds.maxY - bounds.minY <= availableHeight) {
      return zoom
    }
  }
  return 4
}

const h5CenterWorld = computed(() => {
  const bounds = getWorldBounds(h5Zoom.value)
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2
  }
})

const h5PointPositions = computed(() =>
  getProjectedPoints(h5Zoom.value).map((point) => ({
    ...point,
    x: point.world.x - h5CenterWorld.value.x + mapSize.value.width / 2 + panOffset.value.x,
    y: point.world.y - h5CenterWorld.value.y + mapSize.value.height / 2 + panOffset.value.y
  }))
)

const h5Tiles = computed<MapTile[]>(() => {
  const centerTileX = Math.floor(h5CenterWorld.value.x / tileSize)
  const centerTileY = Math.floor(h5CenterWorld.value.y / tileSize)
  const radiusX = Math.ceil(mapSize.value.width / tileSize / 2) + 1
  const radiusY = Math.ceil(mapSize.value.height / tileSize / 2) + 1
  const maxTile = 2 ** h5Zoom.value
  const tiles: MapTile[] = []

  for (let x = centerTileX - radiusX; x <= centerTileX + radiusX; x += 1) {
    for (let y = centerTileY - radiusY; y <= centerTileY + radiusY; y += 1) {
      if (y < 0 || y >= maxTile) continue
      const wrappedX = ((x % maxTile) + maxTile) % maxTile
      const server = ((Math.abs(wrappedX + y) % 4) + 1).toString()
      tiles.push({
        id: `${h5Zoom.value}-${wrappedX}-${y}`,
        url: `https://webrd0${server}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x=${wrappedX}&y=${y}&z=${h5Zoom.value}`,
        style: {
          left: `${x * tileSize - h5CenterWorld.value.x + mapSize.value.width / 2 + panOffset.value.x}px`,
          top: `${y * tileSize - h5CenterWorld.value.y + mapSize.value.height / 2 + panOffset.value.y}px`
        }
      })
    }
  }

  return tiles
})

const h5Path = computed(() =>
  h5PointPositions.value.map((point) => `${point.x},${point.y}`).join(' ')
)

const h5Markers = computed(() => {
  const first = h5PointPositions.value[0]
  const last = h5PointPositions.value[h5PointPositions.value.length - 1]
  return [first, last]
    .filter((point): point is NonNullable<typeof point> => Boolean(point))
    .map((point, index) => ({
      id: index + 1,
      label: index === 0 ? '起' : '终',
      type: index === 0 ? 'start' : 'end',
      style: {
        left: `${point.x}px`,
        top: `${point.y}px`
      }
    }))
})

function back() {
  emit('back')
}

function clampZoom(value: number) {
  return Math.min(16, Math.max(4, value))
}

function resetFallbackView() {
  manualZoom.value = null
  panOffset.value = { x: 0, y: 0 }
  isPanning.value = false
}

function onFallbackWheel(event: WheelEvent) {
  event.preventDefault()
  manualZoom.value = clampZoom((manualZoom.value ?? getFitZoom()) + (event.deltaY > 0 ? -1 : 1))
}

function onFallbackPointerDown(event: PointerEvent) {
  isPanning.value = true
  panStart.value = { x: event.clientX, y: event.clientY }
  ;(event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId)
}

function onFallbackPointerMove(event: PointerEvent) {
  if (!isPanning.value) return
  const dx = event.clientX - panStart.value.x
  const dy = event.clientY - panStart.value.y
  panOffset.value = {
    x: panOffset.value.x + dx,
    y: panOffset.value.y + dy
  }
  panStart.value = { x: event.clientX, y: event.clientY }
}

function onFallbackPointerUp(event: PointerEvent) {
  isPanning.value = false
  ;(event.currentTarget as HTMLElement | null)?.releasePointerCapture?.(event.pointerId)
}

// #ifdef H5
function withTimeout<T>(task: Promise<T>, message: string, timeout = 6000) {
  return Promise.race([
    task,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), timeout)
    })
  ])
}

function loadAmap() {
  if (window.AMap) return Promise.resolve(window.AMap)
  const key = import.meta.env.VITE_AMAP_KEY
  const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE
  if (!key) return Promise.reject(new Error('请先配置 VITE_AMAP_KEY'))
  if (securityJsCode) {
    window._AMapSecurityConfig = { securityJsCode }
  }

  const existingScript = document.querySelector<HTMLScriptElement>('script[data-tms-amap-driving]')
  if (existingScript) {
    return new Promise((resolve, reject) => {
      if (window.AMap) {
        resolve(window.AMap)
        return
      }
      existingScript.addEventListener('load', () => resolve(window.AMap), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('高德地图加载失败')), {
        once: true
      })
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.dataset.tmsAmapDriving = 'true'
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}&plugin=AMap.Driving`
    script.async = true
    script.onload = () => resolve(window.AMap)
    script.onerror = () => reject(new Error('高德地图加载失败'))
    document.head.appendChild(script)
  })
}

function ensureDrivingPlugin(AMap: any) {
  if (AMap?.Driving) return Promise.resolve(true)
  if (!AMap?.plugin) return Promise.resolve(false)
  return new Promise<boolean>((resolve) => {
    AMap.plugin(['AMap.Driving'], () => resolve(Boolean(AMap.Driving)))
  })
}

function parsePolyline(polyline?: string) {
  if (!polyline) return []
  return polyline
    .split(';')
    .map((item) => item.split(',').map(Number))
    .filter(([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude))
}

async function fetchDrivingPath(start: RoutePoint, end: RoutePoint) {
  const key = import.meta.env.VITE_AMAP_KEY
  if (!key) throw new Error('请先配置 VITE_AMAP_KEY')
  const params = [
    `origin=${start.longitude},${start.latitude}`,
    `destination=${end.longitude},${end.latitude}`,
    `key=${key}`,
    'extensions=base',
    'strategy=0'
  ].join('&')
  const response = await fetch(`https://restapi.amap.com/v3/direction/driving?${params}`)
  const data = await response.json()
  const steps = data?.route?.paths?.[0]?.steps || []
  const path = steps.flatMap((step: { polyline?: string }) => parsePolyline(step.polyline))
  if (data?.status !== '1' || path.length < 2) {
    throw new Error(data?.info || '路线规划失败')
  }
  return path
}

function extractDrivingPath(result: any) {
  const steps = result?.routes?.[0]?.steps || []
  return steps.flatMap((step: any) => step.path || [])
}

async function waitForMapContainer() {
  for (let index = 0; index < 30; index += 1) {
    const container = document.getElementById(amapMapId)
    const rect = container?.getBoundingClientRect?.()
    if (container instanceof HTMLDivElement && rect?.width && rect.height) return container
    await new Promise((resolve) => window.requestAnimationFrame(resolve))
  }
  throw new Error('地图容器未就绪')
}

function createRouteMarker(AMap: any, point: RoutePoint, label: string, type: 'start' | 'end') {
  const color = type === 'start' ? '#20c7a7' : '#ff944d'
  return new AMap.Marker({
    position: [point.longitude, point.latitude],
    offset: new AMap.Pixel(-15, -15),
    content: `<div style="width:27px;height:27px;border:2px solid #fff;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;box-shadow:0 4px 11px rgba(31,41,55,.18);">${label}</div>`
  })
}

function drawDrivingPath(AMap: any, path: any[], start: RoutePoint, end: RoutePoint) {
  amap.clearMap?.()
  const shadow = new AMap.Polyline({
    path,
    strokeColor: '#ffffff',
    strokeWeight: 14,
    strokeOpacity: 0.95,
    lineJoin: 'round',
    lineCap: 'round',
    zIndex: 10
  })
  const routeLine = new AMap.Polyline({
    path,
    strokeColor: '#18c7a8',
    strokeWeight: 9,
    strokeOpacity: 0.95,
    lineJoin: 'round',
    lineCap: 'round',
    showDir: true,
    zIndex: 11
  })
  const startMarker = createRouteMarker(AMap, start, '起', 'start')
  const endMarker = createRouteMarker(AMap, end, '终', 'end')
  amap.add([shadow, routeLine, startMarker, endMarker])
  amap.setFitView([routeLine, startMarker, endMarker], false, [54, 34, 38, 34], 10)
  setTimeout(() => {
    if (!amap || amap.getZoom?.() >= 6) return
    amap.setZoom(6)
  }, 0)
}

function searchDrivingPath(AMap: any, start: RoutePoint, end: RoutePoint) {
  driving = new AMap.Driving({
    policy: AMap.DrivingPolicy.LEAST_TIME,
    showTraffic: false
  })
  return new Promise<any[]>((resolve, reject) => {
    driving.search(
      [start.longitude, start.latitude],
      [end.longitude, end.latitude],
      (status: string, result: any) => {
        const path = extractDrivingPath(result)
        if (status === 'complete' && path.length >= 2) {
          resolve(path)
          return
        }
        reject(new Error(result?.info || '路线规划失败'))
      }
    )
  })
}

async function renderDrivingRoute() {
  const seq = (renderSeq += 1)
  await nextTick()
  updateMapSize()
  if (points.value.length < 2) return
  routeReady.value = false
  routeError.value = ''

  try {
    const container = await waitForMapContainer()
    const AMap = await withTimeout(loadAmap(), '高德地图加载超时')
    if (seq !== renderSeq) return
    amap?.destroy?.()

    const start = points.value[0]
    const end = points.value[points.value.length - 1]
    if (!start || !end) return

    amap = new AMap.Map(container, {
      zoom: 8,
      center: [center.value.longitude, center.value.latitude],
      resizeEnable: true,
      dragEnable: true,
      zoomEnable: true,
      scrollWheel: true,
      doubleClickZoom: true,
      viewMode: '2D',
      features: ['bg', 'road', 'point'],
      mapStyle: 'amap://styles/normal'
    })
    amap.setStatus?.({
      dragEnable: true,
      zoomEnable: true,
      scrollWheel: true,
      doubleClickZoom: true
    })

    const hasDriving = await withTimeout(ensureDrivingPlugin(AMap), '驾车规划插件加载超时', 2500).catch(
      () => false
    )
    const path = hasDriving
      ? await withTimeout(searchDrivingPath(AMap, start, end), '驾车路线规划超时', 6000).catch(() =>
          fetchDrivingPath(start, end)
        )
      : await fetchDrivingPath(start, end)
    if (seq !== renderSeq) return
    drawDrivingPath(AMap, path, start, end)
    routeReady.value = true
  } catch (error) {
    console.warn('render driving route failed', error)
    routeError.value = error instanceof Error ? error.message : '地图加载失败'
  }
}
// #endif

function updateMapSize() {
  if (typeof document === 'undefined') return
  const element =
    document.getElementById(amapMapId) ||
    ((amapRef.value as unknown as { $el?: HTMLElement })?.$el ?? null) ||
    ((fallbackRef.value as unknown as { $el?: HTMLElement })?.$el ?? null)
  const rect = element?.getBoundingClientRect?.()
  if (!rect?.width || !rect?.height) return
  mapSize.value = { width: rect.width, height: rect.height }
}

onMounted(() => {
  // #ifdef H5
  updateMapSize()
  window.addEventListener('resize', updateMapSize)
  void renderDrivingRoute()
  // #endif
})

// #ifdef H5
watch(points, () => {
  resetFallbackView()
  routeReady.value = false
  routeError.value = ''
  void renderDrivingRoute()
})
// #endif

onBeforeUnmount(() => {
  // #ifdef H5
  window.removeEventListener('resize', updateMapSize)
  renderSeq += 1
  driving?.clear?.()
  driving = undefined
  amap?.destroy?.()
  amap = undefined
  // #endif
})
</script>

<template>
  <view class="route-map">
    <button class="route-map__back" hover-class="none" @tap="back">
      <TmsIcon name="back" size="38rpx" />
    </button>

    <!-- #ifdef H5 -->
    <div
      :id="amapMapId"
      ref="amapRef"
      class="route-map__canvas route-map__amap"
    />
    <view v-if="!routeReady" class="route-map__planning">
      {{ routeError || '正在规划车行路线' }}
    </view>
    <!-- #endif -->

    <!-- #ifndef H5 -->
    <map
      class="route-map__canvas"
      :latitude="center.latitude"
      :longitude="center.longitude"
      :markers="markers"
      :polyline="polyline"
      :scale="8"
      enable-scroll
      enable-zoom
      enable-rotate
      show-location
    />
    <!-- #endif -->

    <view v-if="points.length < 2" class="route-map__empty">暂无路线坐标</view>
  </view>
</template>

<style scoped lang="scss">
.route-map {
  position: relative;
  height: 520rpx;
  overflow: hidden;
  background: #dfe8f2;
}

.route-map__canvas {
  width: 100%;
  height: 100%;
}

.route-map__amap {
  position: relative;
}

.route-map__planning {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 2;
  transform: translate(-50%, -50%);
  padding: 12rpx 22rpx;
  border-radius: 999rpx;
  color: #667085;
  background: rgba(255, 255, 255, 0.94);
  font-size: 24rpx;
  font-weight: 700;
  box-shadow: 0 8rpx 22rpx rgba(31, 41, 55, 0.08);
}

:deep(.route-map-amap-marker) {
  width: 54rpx;
  height: 54rpx;
  border: 4rpx solid #fff;
  border-radius: 50%;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 900;
  box-shadow: 0 8rpx 22rpx rgba(31, 41, 55, 0.18);
}

:deep(.route-map-amap-marker--start) {
  background: #20c7a7;
}

:deep(.route-map-amap-marker--end) {
  background: #ff944d;
}

.route-map__tile-map {
  position: relative;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.route-map__tile {
  position: absolute;
  width: 256px;
  height: 256px;
}

.route-map__overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.route-map__marker {
  position: absolute;
  z-index: 2;
  width: 44rpx;
  height: 44rpx;
  border: 4rpx solid #fff;
  border-radius: 50%;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: 800;
  transform: translate(-50%, -50%);
  box-shadow: 0 8rpx 20rpx rgba(31, 41, 55, 0.16);
}

.route-map__marker--start {
  background: var(--tms-green);
}

.route-map__marker--end {
  background: var(--tms-orange);
}

.route-map__back {
  position: absolute;
  left: 28rpx;
  top: calc(34rpx + env(safe-area-inset-top));
  z-index: 3;
  width: 68rpx;
  height: 68rpx;
  padding: 0;
  border-radius: 50%;
  color: #344054;
  background: rgba(255, 255, 255, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(31, 41, 55, 0.12);
}

.route-map__back::after {
  border: 0;
}

.route-map__empty {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 2;
  transform: translate(-50%, -50%);
  padding: 12rpx 20rpx;
  border-radius: 999rpx;
  color: #667085;
  background: rgba(255, 255, 255, 0.9);
  font-size: 24rpx;
}
</style>

<script lang="ts">
declare global {
  interface Window {
    AMap?: any
    _AMapSecurityConfig?: {
      securityJsCode?: string
    }
  }
}
</script>
