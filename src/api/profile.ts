import { keysToCamel, request, restPath } from './supabase'
import { getRoutePointsDistanceKm } from '@/utils/route'
import type { Carrier, Driver, ProfileSummary, SessionUser, SysUser, Vehicle, Waybill } from './types'

const USER_SELECT =
  'id,auth_user_id,tenant_id,user_name,nick_name,user_phone,user_email,user_type,status,avatar'
const DRIVER_SELECT =
  'id,tenant_id,carrier_id,driver_name,phone,gender,id_card_no,license_type,driver_license_front_url,driver_license_back_url,enabled'
const CARRIER_SELECT = 'id,carrier_code,company_name,contact_name,contact_phone'
const VEHICLE_SELECT =
  'id,plate_no,carrier_id,primary_driver_id,vehicle_type,brand_model,operation_status,vehicle_photo_url,approved_load_mass,overall_length,fuel_type,audit_status,driving_license_front_url,driving_license_back_url,operation_license_url,license_plate_code'

function singleQuery(table: string, query: string) {
  return restPath(table, query)
}

function getStringMeta(source: Record<string, unknown> | undefined, keys: string[]) {
  if (!source) return ''
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function getAuthPhone(authUser?: SessionUser | null) {
  return (
    authUser?.phone ||
    getStringMeta(authUser?.user_metadata, ['phone', 'user_phone', 'mobile', 'tel']) ||
    getStringMeta(authUser?.app_metadata, ['phone', 'user_phone', 'mobile', 'tel'])
  )
}

async function findDriverByFilter(token: string, filter: string) {
  try {
    const rows = await request<unknown[]>(
      singleQuery('tms_driver', `?select=${DRIVER_SELECT}&${filter}&enabled=eq.true&limit=1`),
      { token }
    )
    return keysToCamel<Driver[]>(rows)[0] || null
  } catch {
    return null
  }
}

export async function getCurrentSysUser(token: string, authUser?: SessionUser | null) {
  const authPhone = getAuthPhone(authUser)
  const filters = [
    authUser?.id ? `auth_user_id=eq.${encodeURIComponent(authUser.id)}` : '',
    authUser?.email ? `user_email=eq.${encodeURIComponent(authUser.email)}` : '',
    authPhone ? `user_phone=eq.${encodeURIComponent(authPhone)}` : ''
  ].filter(Boolean)

  for (const filter of filters) {
    const rows = await request<unknown[]>(
      singleQuery('sys_user', `?select=${USER_SELECT}&${filter}&limit=1`),
      { token }
    )
    const user = keysToCamel<SysUser[]>(rows)[0]
    if (user) return user
  }

  return null
}

export async function getDriverByProfile(token: string, user?: SysUser | null, authUser?: SessionUser | null) {
  const phone = user?.userPhone || getAuthPhone(authUser)

  if (phone) {
    const driver = await findDriverByFilter(token, `phone=eq.${encodeURIComponent(phone)}`)
    if (driver) return driver
  }

  const name = user?.nickName || user?.userName
  if (name) {
    const driver = await findDriverByFilter(token, `driver_name=eq.${encodeURIComponent(name)}`)
    if (driver) return driver
  }

  return null
}

export async function getCarrier(token: string, carrierId?: string) {
  if (!carrierId) return null
  const rows = await request<unknown[]>(
    singleQuery('tms_carrier', `?select=${CARRIER_SELECT}&id=eq.${carrierId}&limit=1`),
    { token }
  )
  return keysToCamel<Carrier[]>(rows)[0] || null
}

export async function getDriverVehicle(token: string, driver?: Driver | null) {
  if (!driver) return null

  const byDriver = await request<unknown[]>(
    singleQuery(
      'vehicle_archive',
      `?select=${VEHICLE_SELECT}&primary_driver_id=eq.${driver.id}&order=create_time.desc&limit=1`
    ),
    { token }
  )
  const driverVehicle = keysToCamel<Vehicle[]>(byDriver)[0]
  if (driverVehicle) return driverVehicle

  const recentWaybills = await request<Array<{ vehicle_id?: string }>>(
    singleQuery(
      'tms_waybill',
      `?select=vehicle_id&driver_id=eq.${driver.id}&vehicle_id=not.is.null&order=create_time.desc&limit=1`
    ),
    { token }
  )
  const vehicleId = recentWaybills[0]?.vehicle_id
  if (vehicleId) {
    const rows = await request<unknown[]>(
      singleQuery('vehicle_archive', `?select=${VEHICLE_SELECT}&id=eq.${vehicleId}&limit=1`),
      { token }
    )
    const vehicle = keysToCamel<Vehicle[]>(rows)[0]
    if (vehicle) return vehicle
  }

  if (!driver.carrierId) return null
  const rows = await request<unknown[]>(
    singleQuery(
      'vehicle_archive',
      `?select=${VEHICLE_SELECT}&carrier_id=eq.${driver.carrierId}&order=create_time.desc&limit=1`
    ),
    { token }
  )
  return keysToCamel<Vehicle[]>(rows)[0] || null
}

export async function getProfileSummary(token: string, authUser?: SessionUser | null) {
  const user = await getCurrentSysUser(token, authUser)
  const driver = await getDriverByProfile(token, user, authUser)
  const carrier = await getCarrier(token, driver?.carrierId)
  const vehicle = await getDriverVehicle(token, driver)

  let completedCount = 0
  let totalMileageKm = 0
  if (driver?.id) {
    const completedRows = await request<unknown[]>(
      singleQuery(
        'tms_waybill',
        `?select=remaining_distance_km,route_points&driver_id=eq.${driver.id}&status=eq.completed`
      ),
      { token }
    )
    const waybills = keysToCamel<Array<Pick<Waybill, 'remainingDistanceKm' | 'routePoints'>>>(
      completedRows
    )
    completedCount = waybills.length
    totalMileageKm = Number(
      waybills
        .reduce((total, item) => {
          const routeDistance = getRoutePointsDistanceKm(item.routePoints)
          return total + (routeDistance ?? item.remainingDistanceKm ?? 0)
        }, 0)
        .toFixed(1)
    )
  }

  return {
    user,
    driver,
    carrier,
    vehicle,
    completedCount,
    totalMileageKm,
    rating: 0
  } satisfies ProfileSummary
}
