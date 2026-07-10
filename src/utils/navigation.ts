import type { Waybill } from '@/api/types'
import { getWaybillRoutePoints } from './route'

export function openWaybillNavigation(waybill?: Waybill | null) {
  const points = getWaybillRoutePoints(waybill)
  const destination = points?.[points.length - 1]
  const address = waybill?.receiverAddress || waybill?.destinationCity || waybill?.toStationName || ''
  const name = waybill?.destinationCity || waybill?.toStationName || '目的地'

  if (!destination) {
    openAddressFallback(name, address)
    return
  }

  uni.openLocation({
    latitude: destination.latitude,
    longitude: destination.longitude,
    name,
    address,
    scale: 15,
    fail() {
      uni.showToast({ title: '打开导航失败', icon: 'none' })
    }
  })
}

function openAddressFallback(name: string, address: string) {
  if (!address) {
    uni.showToast({ title: '暂无导航地址', icon: 'none' })
    return
  }

  // #ifdef H5
  const keyword = encodeURIComponent(address)
  window.open(`https://apis.map.qq.com/uri/v1/search?keyword=${keyword}&referer=tms-driver`, '_blank')
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
