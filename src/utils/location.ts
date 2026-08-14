import type { CargoOperationLocation } from '@/api/types'

export function getCurrentGcj02Location(locationText?: string): Promise<CargoOperationLocation> {
  // #ifdef H5
  return getBrowserGcj02Location(locationText)
  // #endif

  // #ifndef H5
  return getUniGcj02Location(locationText)
  // #endif
}

function getUniGcj02Location(locationText?: string): Promise<CargoOperationLocation> {
  return new Promise((resolve, reject) => {
    const locate = () => {
      uni.getLocation({
        type: 'gcj02',
        geocode: true,
        isHighAccuracy: true,
        highAccuracyExpireTime: 12000,
        success(result) {
          resolve({
            longitude: result.longitude,
            latitude: result.latitude,
            accuracyM: result.accuracy,
            locationText: locationText?.trim() || formatLocationAddress(result.address)
          })
        },
        fail(error) {
          const message = error.errMsg || '定位失败，请检查定位权限和系统定位服务'
          if (/auth deny|authorize|permission|denied/i.test(message)) {
            reject(new Error('定位权限未开启，请在应用设置中允许访问位置后重试'))
            return
          }
          reject(new Error(message))
        }
      })
    }

    // #ifdef MP-WEIXIN
    uni.authorize({
      scope: 'scope.userLocation',
      success: locate,
      fail: () => reject(new Error('定位权限未开启，请在小程序设置中允许位置信息'))
    })
    // #endif

    // #ifndef MP-WEIXIN
    locate()
    // #endif
  })
}

function getBrowserGcj02Location(locationText?: string): Promise<CargoOperationLocation> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('当前浏览器不支持定位，请使用手机系统浏览器打开'))
      return
    }

    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      reject(new Error('手机网页定位需要 HTTPS，请使用安全链接重新打开'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const [longitude, latitude] = wgs84ToGcj02(
          position.coords.longitude,
          position.coords.latitude
        )
        const resolvedText = locationText?.trim() || (await reverseGeocodeAmap(longitude, latitude))
        resolve({
          longitude,
          latitude,
          accuracyM: position.coords.accuracy,
          locationText: resolvedText
        })
      },
      (error) => {
        const messages: Record<number, string> = {
          1: '定位权限未开启，请在浏览器设置中允许访问位置',
          2: '暂时无法获取位置，请开启手机定位服务后重试',
          3: '定位超时，请移至开阔区域后重试'
        }
        reject(new Error(messages[error.code] || '定位失败，请稍后重试'))
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000
      }
    )
  })
}

function formatLocationAddress(address: unknown) {
  if (typeof address === 'string') return address.trim() || undefined
  if (!address || typeof address !== 'object') return undefined
  const value = address as Record<string, unknown>
  const formatted = [value.formattedAddress, value.formatted_address, value.address]
    .find((item): item is string => typeof item === 'string' && Boolean(item.trim()))
  if (formatted) return formatted.trim()
  const parts = [
    value.province,
    value.city,
    value.district,
    value.street,
    value.streetNum,
    value.poiName
  ].filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
  return parts.join('') || undefined
}

async function reverseGeocodeAmap(longitude: number, latitude: number) {
  const key = import.meta.env.VITE_AMAP_KEY
  if (!key) return undefined
  try {
    const params = new URLSearchParams({
      key,
      location: `${longitude},${latitude}`,
      extensions: 'base',
      roadlevel: '0'
    })
    const response = await fetch(`https://restapi.amap.com/v3/geocode/regeo?${params}`)
    if (!response.ok) return undefined
    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object') return undefined
    const data = payload as Record<string, unknown>
    if (data.status !== '1' || !data.regeocode || typeof data.regeocode !== 'object') {
      return undefined
    }
    return formatLocationAddress(data.regeocode)
  } catch (error) {
    console.warn('reverse geocoding failed', error)
    return undefined
  }
}

function wgs84ToGcj02(longitude: number, latitude: number): [number, number] {
  if (isOutsideChina(longitude, latitude)) return [longitude, latitude]

  const a = 6378245
  const eccentricity = 0.006693421622965943
  let latitudeOffset = transformLatitude(longitude - 105, latitude - 35)
  let longitudeOffset = transformLongitude(longitude - 105, latitude - 35)
  const radians = (latitude / 180) * Math.PI
  const magic = 1 - eccentricity * Math.sin(radians) ** 2
  const sqrtMagic = Math.sqrt(magic)
  latitudeOffset =
    (latitudeOffset * 180) / (((a * (1 - eccentricity)) / (magic * sqrtMagic)) * Math.PI)
  longitudeOffset = (longitudeOffset * 180) / ((a / sqrtMagic) * Math.cos(radians) * Math.PI)
  return [longitude + longitudeOffset, latitude + latitudeOffset]
}

function isOutsideChina(longitude: number, latitude: number) {
  return longitude < 72.004 || longitude > 137.8347 || latitude < 0.8293 || latitude > 55.8271
}

function transformLatitude(longitude: number, latitude: number) {
  let value =
    -100 +
    2 * longitude +
    3 * latitude +
    0.2 * latitude ** 2 +
    0.1 * longitude * latitude +
    0.2 * Math.sqrt(Math.abs(longitude))
  value +=
    ((20 * Math.sin(6 * longitude * Math.PI) + 20 * Math.sin(2 * longitude * Math.PI)) * 2) /
    3
  value +=
    ((20 * Math.sin(latitude * Math.PI) + 40 * Math.sin((latitude / 3) * Math.PI)) * 2) / 3
  value +=
    ((160 * Math.sin((latitude / 12) * Math.PI) + 320 * Math.sin((latitude * Math.PI) / 30)) *
      2) /
    3
  return value
}

function transformLongitude(longitude: number, latitude: number) {
  let value =
    300 +
    longitude +
    2 * latitude +
    0.1 * longitude ** 2 +
    0.1 * longitude * latitude +
    0.1 * Math.sqrt(Math.abs(longitude))
  value +=
    ((20 * Math.sin(6 * longitude * Math.PI) + 20 * Math.sin(2 * longitude * Math.PI)) * 2) /
    3
  value +=
    ((20 * Math.sin(longitude * Math.PI) + 40 * Math.sin((longitude / 3) * Math.PI)) * 2) / 3
  value +=
    ((150 * Math.sin((longitude / 12) * Math.PI) +
      300 * Math.sin((longitude / 30) * Math.PI)) *
      2) /
    3
  return value
}

export function calculateDistanceMeters(
  location: Pick<CargoOperationLocation, 'longitude' | 'latitude'>,
  centerLongitude?: number | null,
  centerLatitude?: number | null
): number | null {
  if (centerLongitude == null || centerLatitude == null) return null

  const radians = (value: number) => (value * Math.PI) / 180
  const latitudeDelta = radians(centerLatitude - location.latitude)
  const longitudeDelta = radians(centerLongitude - location.longitude)
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(location.latitude)) *
      Math.cos(radians(centerLatitude)) *
      Math.sin(longitudeDelta / 2) ** 2

  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
