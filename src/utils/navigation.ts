import type { Waybill } from '@/api/types'
import { getWaybillRoutePoints, type ValidRoutePoint } from './route'

export function openWaybillNavigation(waybill?: Waybill | null) {
  const points = getWaybillRoutePoints(waybill)
  const destination = points?.[points.length - 1]
  const address = waybill?.receiverAddress || waybill?.destinationCity || waybill?.toStationName || ''
  const name = waybill?.destinationCity || waybill?.toStationName || '目的地'

  if (!destination) {
    openAddressFallback(name, address)
    return
  }
  const target = destination as ValidRoutePoint

  // #ifdef H5
  openWebMapLocation(name, address, target)
  return
  // #endif

  uni.openLocation({
    latitude: target.latitude,
    longitude: target.longitude,
    name,
    address,
    scale: 15,
    fail() {
      uni.showToast({ title: '打开导航失败', icon: 'none' })
    }
  })
}

function openWebMapLocation(name: string, address: string, destination?: ValidRoutePoint) {
  const title = encodeURIComponent(name || address || '目的地')
  const keyword = encodeURIComponent(address || name || '目的地')
  const url = destination
    ? `https://apis.map.qq.com/uri/v1/routeplan?type=drive&to=${title}&tocoord=${destination.latitude},${destination.longitude}&policy=1&referer=tms-driver`
    : `https://apis.map.qq.com/uri/v1/search?keyword=${keyword}&referer=tms-driver`

  const opened = window.open(url, '_blank')
  if (!opened) window.location.href = url
}

function openAddressFallback(name: string, address: string) {
  if (!address) {
    uni.showToast({ title: '暂无导航地址', icon: 'none' })
    return
  }

  // #ifdef H5
  openWebMapLocation(name, address)
  return
  // #endif

  uni.setClipboardData({
    data: address,
    success() {
      uni.showToast({ title: '已复制目的地地址', icon: 'none' })
    },
    fail() {
      uni.showModal({
        title: name,
        content: address,
        showCancel: false,
        confirmText: '知道了'
      })
    }
  })
}
