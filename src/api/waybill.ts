import {
  keysToCamel,
  keysToSnake,
  request,
  restPath,
  uploadFileToStorage
} from './supabase'
import type { ProofFile, Waybill, WaybillEvent, WaybillProof, WaybillStatus } from './types'

const WAYBILL_SELECT = '*'
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
  limit?: number
}

function addFilter(parts: string[], name: string, value?: string) {
  if (!value) return
  parts.push(`${name}=eq.${encodeURIComponent(value)}`)
}

function buildWaybillQuery(options: ListWaybillOptions = {}) {
  const parts = [`select=${WAYBILL_SELECT}`, 'order=create_time.desc']
  const statuses = GROUP_STATUS[options.group || 'all']
  if (statuses.length === 1) parts.push(`status=eq.${statuses[0]}`)
  if (statuses.length > 1) parts.push(`status=in.(${statuses.join(',')})`)
  addFilter(parts, 'driver_id', options.driverId)
  if (options.limit) parts.push(`limit=${options.limit}`)
  return `?${parts.join('&')}`
}

export async function listWaybills(token: string, options: ListWaybillOptions = {}) {
  const rows = await request<unknown[]>(restPath('tms_waybill', buildWaybillQuery(options)), {
    token
  })
  return keysToCamel<Waybill[]>(rows)
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
    proof_type: proofType,
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
    const uploaded = await uploadFileToStorage('attachments', objectPath, filePath, token)
    const file: ProofFile = {
      name: getFileName(filePath, proofType),
      url: uploaded.publicUrl,
      fileType: `image/${getExt(filePath).replace('jpg', 'jpeg')}`
    }
    files.push(file)
    await createWaybillProof(token, waybill, proofType, file, uploaderName)
  }

  return files
}
