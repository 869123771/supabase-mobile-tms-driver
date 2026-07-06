import {
  keysToCamel,
  keysToSnake,
  request,
  restPath,
  uploadFileToStorage
} from './supabase'
import type { ProofFile, Waybill, WaybillEvent, WaybillProof, WaybillStatus } from './types'

const WAYBILL_SELECT =
  '*,driver:tms_driver(id,tenant_id,carrier_id,driver_name,phone,gender,id_card_no,license_type,driver_license_front_url,driver_license_back_url,enabled)'
const WAYBILL_DRIVER_INNER_SELECT =
  '*,driver:tms_driver!inner(id,tenant_id,carrier_id,driver_name,phone,gender,id_card_no,license_type,driver_license_front_url,driver_license_back_url,enabled)'
const EVENT_SELECT =
  'id,tenant_id,waybill_id,event_type,event_time,operator_name,location_text,payload,remark,create_time'
const PROOF_SELECT =
  'id,tenant_id,waybill_id,proof_type,file_url,file_name,mime_type,file_size,uploaded_at,uploader_name,remark,create_time'

export type WaybillStatusGroup = 'all' | 'pending' | 'active' | 'completed'

const GROUP_STATUS: Record<WaybillStatusGroup, WaybillStatus[]> = {
  all: [],
  pending: ['pending'],
  active: ['accepted', 'loading', 'transporting', 'unloading'],
  completed: ['completed']
}

interface ListWaybillOptions {
  group?: WaybillStatusGroup
  driverId?: string
  driverPhone?: string
  driverName?: string
  vehicleId?: string
  limit?: number
}

function addFilter(parts: string[], name: string, value?: string) {
  if (!value) return
  parts.push(`${name}=eq.${encodeURIComponent(value)}`)
}

function addStatusFilter(parts: string[], group: WaybillStatusGroup = 'all') {
  const statuses = GROUP_STATUS[group]
  if (statuses.length === 1) parts.push(`status=eq.${statuses[0]}`)
  if (statuses.length > 1) parts.push(`status=in.(${statuses.join(',')})`)
}

function buildWaybillQuery(options: ListWaybillOptions = {}) {
  const parts = [`select=${WAYBILL_SELECT}`, 'order=create_time.desc']
  addStatusFilter(parts, options.group || 'all')
  addFilter(parts, 'driver_id', options.driverId)
  if (options.limit) parts.push(`limit=${options.limit}`)
  return `?${parts.join('&')}`
}

function buildWaybillDriverQuery(options: ListWaybillOptions = {}, filter: string) {
  const parts = [`select=${WAYBILL_DRIVER_INNER_SELECT}`, 'order=create_time.desc']
  addStatusFilter(parts, options.group || 'all')
  parts.push(filter)
  if (options.limit) parts.push(`limit=${options.limit}`)
  return `?${parts.join('&')}`
}

async function listWaybillsByDriverProfile(token: string, options: ListWaybillOptions) {
  if (options.driverPhone) {
    const rows = await request<unknown[]>(
      restPath(
        'tms_waybill',
        buildWaybillDriverQuery(options, `driver.phone=eq.${encodeURIComponent(options.driverPhone)}`)
      ),
      { token }
    )
    const waybills = keysToCamel<Waybill[]>(rows)
    if (waybills.length > 0) return waybills
  }

  if (options.driverName) {
    const rows = await request<unknown[]>(
      restPath(
        'tms_waybill',
        buildWaybillDriverQuery(
          options,
          `driver.driver_name=eq.${encodeURIComponent(options.driverName)}`
        )
      ),
      { token }
    )
    const waybills = keysToCamel<Waybill[]>(rows)
    if (waybills.length > 0) return waybills
  }

  return []
}

function hasDriverIdentity(options: ListWaybillOptions) {
  return Boolean(options.driverId || options.driverPhone || options.driverName || options.vehicleId)
}

async function listWaybillsByVehicle(token: string, options: ListWaybillOptions) {
  if (!options.vehicleId) return []
  const parts = [`select=${WAYBILL_SELECT}`, 'order=create_time.desc']
  addStatusFilter(parts, options.group || 'all')
  addFilter(parts, 'vehicle_id', options.vehicleId)
  if (options.limit) parts.push(`limit=${options.limit}`)
  const rows = await request<unknown[]>(restPath('tms_waybill', `?${parts.join('&')}`), {
    token
  })
  return keysToCamel<Waybill[]>(rows)
}

export async function listWaybills(token: string, options: ListWaybillOptions = {}) {
  if (!hasDriverIdentity(options)) return []

  if (!options.driverId) {
    const vehicleWaybills = await listWaybillsByVehicle(token, options)
    if (vehicleWaybills.length > 0) return vehicleWaybills
    return listWaybillsByDriverProfile(token, options)
  }

  const rows = await request<unknown[]>(restPath('tms_waybill', buildWaybillQuery(options)), {
    token
  })
  const waybills = keysToCamel<Waybill[]>(rows)
  if (waybills.length > 0) return waybills

  const vehicleWaybills = await listWaybillsByVehicle(token, options)
  if (vehicleWaybills.length > 0) return vehicleWaybills

  return listWaybillsByDriverProfile(token, options)
}

export async function getWaybill(token: string, id: string) {
  const rows = await request<unknown[]>(
    restPath('tms_waybill', `?select=${WAYBILL_SELECT}&id=eq.${id}&limit=1`),
    { token }
  )
  return keysToCamel<Waybill[]>(rows)[0] || null
}

export async function updateWaybill(
  token: string,
  id: string,
  patch: Partial<Waybill>
) {
  const rows = await request<unknown[]>(
    restPath('tms_waybill', `?id=eq.${id}&select=${WAYBILL_SELECT}`),
    {
      method: 'PATCH',
      token,
      body: keysToSnake(patch),
      headers: { Prefer: 'return=representation' }
    }
  )
  return keysToCamel<Waybill[]>(rows)[0] || null
}

export async function listWaybillEvents(token: string, waybillId: string) {
  const rows = await request<unknown[]>(
    restPath(
      'tms_waybill_event',
      `?select=${EVENT_SELECT}&waybill_id=eq.${waybillId}&order=event_time.asc`
    ),
    { token }
  )
  return keysToCamel<WaybillEvent[]>(rows)
}

export async function createWaybillEvent(
  token: string,
  waybill: Waybill,
  eventType: string,
  operatorName?: string,
  payload?: Record<string, unknown>
) {
  const body = {
    tenant_id: waybill.tenantId,
    waybill_id: waybill.id,
    event_type: eventType,
    event_time: new Date().toISOString(),
    operator_name: operatorName,
    location_text: `${waybill.originCity} - ${waybill.destinationCity}`,
    payload: payload || {}
  }
  const rows = await request<unknown[]>(
    restPath('tms_waybill_event', `?select=${EVENT_SELECT}`),
    {
      method: 'POST',
      token,
      body,
      headers: { Prefer: 'return=representation' }
    }
  )
  return keysToCamel<WaybillEvent[]>(rows)[0] || null
}

export async function listWaybillProofs(token: string, waybillId: string) {
  const rows = await request<unknown[]>(
    restPath(
      'tms_waybill_proof',
      `?select=${PROOF_SELECT}&waybill_id=eq.${waybillId}&order=uploaded_at.desc`
    ),
    { token }
  )
  return keysToCamel<WaybillProof[]>(rows)
}

function getExt(filePath: string) {
  const clean = filePath.split('?')[0] || filePath
  const ext = clean.includes('.') ? clean.slice(clean.lastIndexOf('.') + 1) : 'jpg'
  return ext.length > 6 ? 'jpg' : ext
}

function getFileName(filePath: string, proofType: string) {
  const raw = filePath.split(/[\\/]/).pop()?.split('?')[0]
  return raw || `${proofType}-${Date.now()}.jpg`
}

function createObjectPath(waybillId: string, proofType: string, filePath: string) {
  const ext = getExt(filePath)
  const nonce = Math.random().toString(36).slice(2, 8)
  return `waybill-proofs/${waybillId}/${proofType}-${Date.now()}-${nonce}.${ext}`
}

function toDbProofType(proofType: string) {
  if (proofType === 'pickup') return 'pickup_photo'
  if (proofType === 'delivery') return 'delivery_photo'
  return proofType
}

export async function createWaybillProof(
  token: string,
  waybill: Waybill,
  proofType: string,
  file: ProofFile,
  uploaderName?: string
) {
  const body = {
    tenant_id: waybill.tenantId,
    waybill_id: waybill.id,
    proof_type: toDbProofType(proofType),
    file_url: file.url,
    file_name: file.name,
    mime_type: file.fileType,
    file_size: file.fileSize,
    uploaded_at: new Date().toISOString(),
    uploader_name: uploaderName
  }
  const rows = await request<unknown[]>(
    restPath('tms_waybill_proof', `?select=${PROOF_SELECT}`),
    {
      method: 'POST',
      token,
      body,
      headers: { Prefer: 'return=representation' }
    }
  )
  return keysToCamel<WaybillProof[]>(rows)[0] || null
}

export async function uploadWaybillProofFiles(
  token: string,
  waybill: Waybill,
  proofType: string,
  filePaths: string[],
  uploaderName?: string
) {
  const files: ProofFile[] = []

  for (const filePath of filePaths) {
    const objectPath = createObjectPath(waybill.id, proofType, filePath)
    let uploaded: Awaited<ReturnType<typeof uploadFileToStorage>>
    try {
      uploaded = await uploadFileToStorage('attachments', objectPath, filePath, token)
    } catch (error) {
      throw new Error(error instanceof Error ? `上传照片失败：${error.message}` : '上传照片失败')
    }
    const file: ProofFile = {
      name: getFileName(filePath, proofType),
      url: uploaded.publicUrl,
      fileType: `image/${getExt(filePath).replace('jpg', 'jpeg')}`
    }
    files.push(file)
    try {
      await createWaybillProof(token, waybill, proofType, file, uploaderName)
    } catch (error) {
      throw new Error(
        error instanceof Error ? `保存照片记录失败：${error.message}` : '保存照片记录失败'
      )
    }
  }

  return files
}
