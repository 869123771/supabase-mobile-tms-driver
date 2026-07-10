import type { Waybill } from '@/api/types'

const AVERAGE_TRUCK_SPEED_KMH = 60

interface RoutePoint {
  longitude?: number | string | null
  latitude?: number | string | null
  lng?: number | string | null
  lat?: number | string | null
  type?: string
  name?: string
  address?: string
}

export interface ValidRoutePoint {
  longitude: number
  latitude: number
  type?: string
  name?: string
  address?: string
}

function toValidPoint(point?: RoutePoint) {
  if (!point) return null
  const longitude = Number(point.longitude ?? point.lng)
  const latitude = Number(point.latitude ?? point.lat)
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) return null
  return {
    longitude,
    latitude,
    type: point.type,
    name: point.name,
    address: point.address
  }
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function distanceBetweenKm(start: ValidRoutePoint, end: ValidRoutePoint) {
  const earthRadiusKm = 6371
  const latDelta = toRadians(end.latitude - start.latitude)
  const lonDelta = toRadians(end.longitude - start.longitude)
  const startLat = toRadians(start.latitude)
  const endLat = toRadians(end.latitude)

  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(lonDelta / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function getRouteDistanceKm(waybill?: Waybill | null) {
  if (!waybill) return undefined
  if (Number.isFinite(waybill.remainingDistanceKm)) return Number(waybill.remainingDistanceKm)

  return getRoutePointsDistanceKm(getWaybillRoutePoints(waybill))
}

export function getRoutePointsDistanceKm(routePoints?: RoutePoint[]) {
  const points = routePoints?.map(toValidPoint).filter(Boolean) as ValidRoutePoint[] | undefined
  if (!points || points.length < 2) return undefined

  let total = 0
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    if (previous && current) total += distanceBetweenKm(previous, current)
  }
  return total
}

export function getWaybillRoutePoints(waybill?: Waybill | null) {
  if (!waybill) return []
  const points = (waybill.routePoints || []).map(toValidPoint).filter(Boolean) as ValidRoutePoint[]
  if (points.length >= 2) return points

  const start = toValidPoint({
    longitude: waybill.shipperLongitude,
    latitude: waybill.shipperLatitude,
    type: 'shipper',
    name: waybill.shipperName || waybill.senderName,
    address: waybill.shipperAddress || waybill.senderAddress
  })
  const end = toValidPoint({
    longitude: waybill.receiverLongitude,
    latitude: waybill.receiverLatitude,
    type: 'receiver',
    name: waybill.receiverName,
    address: waybill.receiverAddress
  })
  return [start, end].filter(Boolean) as ValidRoutePoint[]
}

export function getEstimatedDurationMin(waybill?: Waybill | null) {
  if (!waybill) return undefined
  if (Number.isFinite(waybill.estimatedDurationMin)) return Number(waybill.estimatedDurationMin)

  const distanceKm = getRouteDistanceKm(waybill)
  if (distanceKm === undefined) return undefined
  return Math.max(1, Math.round((distanceKm / AVERAGE_TRUCK_SPEED_KMH) * 60))
}
