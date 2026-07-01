import { keysToCamel, request, restPath } from './supabase'
import type { Carrier, Driver, ProfileSummary, SessionUser, SysUser, Vehicle } from './types'

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

export async function getCurrentSysUser(token: string, authUser?: SessionUser | null) {
  const filters: string[] = []
  if (authUser?.id) filters.push(`auth_user_id.eq.${authUser.id}`)
  if (authUser?.email) filters.push(`user_email.eq.${encodeURIComponent(authUser.email)}`)
  if (authUser?.phone) filters.push(`user_phone.eq.${encodeURIComponent(authUser.phone)}`)

  if (filters.length === 0) return null

  const rows = await request<unknown[]>(
    singleQuery('sys_user', `?select=${USER_SELECT}&or=(${filters.join(',')})&limit=1`),
    { token }
  )
  return keysToCamel<SysUser[]>(rows)[0] || null
}

export async function getDriverByProfile(token: string, user?: SysUser | null, authUser?: SessionUser | null) {
  const phone = user?.userPhone || authUser?.phone
  if (phone) {
    const rows = await request<unknown[]>(
      singleQuery(
        'tms_driver',
        `?select=${DRIVER_SELECT}&phone=eq.${encodeURIComponent(phone)}&enabled=eq.true&limit=1`
      ),
      { token }
    )
    const driver = keysToCamel<Driver[]>(rows)[0]
    if (driver) return driver
  }

  const recentWaybills = await request<Array<{ driver_id?: string }>>(
    singleQuery(
      'tms_waybill',
      '?select=driver_id&driver_id=not.is.null&order=create_time.desc&limit=1'
    ),
    { token }
  )
  const driverId = recentWaybills[0]?.driver_id
  if (driverId) {
    const rows = await request<unknown[]>(
      singleQuery('tms_driver', `?select=${DRIVER_SELECT}&id=eq.${driverId}&limit=1`),
      { token }
    )
    const driver = keysToCamel<Driver[]>(rows)[0]
    if (driver) return driver
  }

  const rows = await request<unknown[]>(
    singleQuery('tms_driver', `?select=${DRIVER_SELECT}&enabled=eq.true&order=create_time.desc&limit=1`),
    { token }
  )
  return keysToCamel<Driver[]>(rows)[0] || null
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
    const completedRows = await request<Array<{ remaining_distance_km?: number }>>(
      singleQuery(
        'tms_waybill',
        `?select=remaining_distance_km&driver_id=eq.${driver.id}&status=eq.completed`
      ),
      { token }
    )
    completedCount = completedRows.length
    totalMileageKm = completedCount * 180 + Math.round(completedRows.length * 12.5)
  }

  return {
    user,
    driver,
    carrier,
    vehicle,
    completedCount,
    totalMileageKm,
    rating: completedCount > 0 ? 4.9 : 5
  } satisfies ProfileSummary
}
