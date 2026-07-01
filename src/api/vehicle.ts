import { keysToCamel, request, restPath } from './supabase'
import type { Vehicle } from './types'

const VEHICLE_SELECT =
  'id,plate_no,carrier_id,primary_driver_id,vehicle_type,brand_model,operation_status,vehicle_photo_url,approved_load_mass,overall_length,fuel_type,audit_status,driving_license_front_url,driving_license_back_url,operation_license_url,license_plate_code'

export async function getVehicleById(token: string, id?: string) {
  if (!id) return null
  const rows = await request<unknown[]>(
    restPath('vehicle_archive', `?select=${VEHICLE_SELECT}&id=eq.${id}&limit=1`),
    { token }
  )
  return keysToCamel<Vehicle[]>(rows)[0] || null
}

export async function listVehicles(token: string, carrierId?: string) {
  const query = carrierId
    ? `?select=${VEHICLE_SELECT}&carrier_id=eq.${carrierId}&order=create_time.desc`
    : `?select=${VEHICLE_SELECT}&order=create_time.desc&limit=20`
  const rows = await request<unknown[]>(restPath('vehicle_archive', query), { token })
  return keysToCamel<Vehicle[]>(rows)
}
