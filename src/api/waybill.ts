import {
  keysToCamel,
  keysToSnake,
  removeStorageObjects,
  request,
  rpc,
  restPath,
  uploadFileToStorage
} from './supabase'
import type {
  CargoOperationCompletePayload,
  CargoOperationContext,
  CargoOperationLocation,
  CargoOperationOcrResponse,
  CargoOperationType,
  ProofFile,
  Waybill,
  WaybillEvent,
  WaybillExecutionContext,
  WaybillProof,
  WaybillStatus
} from './types'

const WAYBILL_SELECT =
  '*,driver:tms_driver(id,tenant_id,carrier_id,driver_name,phone,gender,id_card_no,license_type,driver_license_front_url,driver_license_back_url,enabled)'
const EVENT_SELECT =
  'id,tenant_id,waybill_id,event_type,event_time,operator_name,location_text,longitude,latitude,payload,remark,create_time'
const PROOF_SELECT =
  'id,tenant_id,waybill_id,proof_type,file_url,file_name,mime_type,file_size,uploaded_at,uploader_name,remark,create_time'
const ORDER_ROUTE_SELECT =
  'id,order_no,cargo_no,origin_station,destination_station,shipping_contact_name,shipping_contact_phone,shipping_address_detail,shipping_longitude,shipping_latitude,receiving_contact_name,receiving_contact_phone,receiving_address_detail,receiving_longitude,receiving_latitude,planned_departure_time,planned_arrival_time'

export type WaybillStatusGroup = 'all' | 'pending' | 'active' | 'completed'

interface ListWaybillOptions {
  group?: WaybillStatusGroup
  limit?: number
}

interface OrderRouteSnapshot {
  id: string
  orderNo?: string
  cargoNo?: string
  originStation?: string
  destinationStation?: string
  shippingContactName?: string
  shippingContactPhone?: string
  shippingAddressDetail?: string
  shippingLongitude?: number | string | null
  shippingLatitude?: number | string | null
  receivingContactName?: string
  receivingContactPhone?: string
  receivingAddressDetail?: string
  receivingLongitude?: number | string | null
  receivingLatitude?: number | string | null
  plannedDepartureTime?: string
  plannedArrivalTime?: string
}

const activeStatuses: WaybillStatus[] = [
  'accepted',
  'loading',
  'transporting',
  'unloading',
  'signed'
]
const driverActionEvents = [
  'accepted',
  'loaded',
  'departed',
  'arrived',
  'signed',
  'completed',
  'cancelled'
]
const driverActionPayloads = [
  'accept',
  'upload_pickup',
  'confirm_departure',
  'confirm_arrival',
  'complete_unload',
  'submit_signature',
  'complete_unloading',
  'sign',
  'complete',
  'cancel'
]

interface DriverProgressPatch {
  status: WaybillStatus
  acceptedAt?: string
  loadedAt?: string
  departedAt?: string
  arrivedAt?: string
  unloadedAt?: string
  completedAt?: string
  cancelledAt?: string
}

export function listWaybills(token: string, options: ListWaybillOptions = {}) {
  return rpc<Waybill[]>(token, 'tms_list_driver_mobile_waybills', {
    p_group: options.group || 'all',
    p_limit: options.limit || 1000
  })
}

function unique(values: Array<string | undefined>) {
  return [...new Set(values.filter(Boolean) as string[])]
}

function inFilter(values: string[]) {
  return `in.(${values.map((value) => encodeURIComponent(value)).join(',')})`
}

function toNullableNumber(value?: number | string | null) {
  if (value === undefined || value === null || value === '') return null
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function hasPoint(longitude?: number | string | null, latitude?: number | string | null) {
  const lng = toNullableNumber(longitude)
  const lat = toNullableNumber(latitude)
  return lng !== null && lat !== null && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90
}

function hasRouteCoordinates(waybill: Waybill) {
  const points = waybill.routePoints || []
  const validRoutePoints = points.filter((point) =>
    hasPoint(point.longitude ?? point.lng, point.latitude ?? point.lat)
  )
  return (
    validRoutePoints.length >= 2 ||
    (hasPoint(waybill.shipperLongitude, waybill.shipperLatitude) &&
      hasPoint(waybill.receiverLongitude, waybill.receiverLatitude))
  )
}

async function listRouteOrdersByField(token: string, field: string, values: string[]) {
  if (!values.length) return []
  const rows = await request<unknown[]>(
    restPath('tms_order', `?select=${ORDER_ROUTE_SELECT}&${field}=${inFilter(values)}`),
    { token }
  )
  return keysToCamel<OrderRouteSnapshot[]>(rows)
}

function isRelatedRouteOrder(waybill: Waybill, order: OrderRouteSnapshot) {
  if (waybill.orderNo && order.orderNo === waybill.orderNo) return true
  if (waybill.waybillNo && order.orderNo === waybill.waybillNo) return true
  if (waybill.cargoNo && order.cargoNo === waybill.cargoNo) return true
  if (waybill.goodsNo && order.cargoNo === waybill.goodsNo) return true
  return false
}

async function findRouteOrder(token: string, waybill: Waybill) {
  const [orderResult, cargoResult] = await Promise.allSettled([
    listRouteOrdersByField(token, 'order_no', unique([waybill.orderNo || waybill.waybillNo])),
    listRouteOrdersByField(token, 'cargo_no', unique([waybill.cargoNo, waybill.goodsNo]))
  ])
  const orders = [
    ...(orderResult.status === 'fulfilled' ? orderResult.value : []),
    ...(cargoResult.status === 'fulfilled' ? cargoResult.value : [])
  ]
  return orders.find((order) => isRelatedRouteOrder(waybill, order))
}

function routePointsFromOrder(order: OrderRouteSnapshot) {
  const shipperLongitude = toNullableNumber(order.shippingLongitude)
  const shipperLatitude = toNullableNumber(order.shippingLatitude)
  const receiverLongitude = toNullableNumber(order.receivingLongitude)
  const receiverLatitude = toNullableNumber(order.receivingLatitude)
  return [
    shipperLongitude !== null && shipperLatitude !== null
      ? {
          type: 'shipper',
          name: order.shippingContactName,
          address: order.shippingAddressDetail,
          longitude: shipperLongitude,
          latitude: shipperLatitude,
          lng: shipperLongitude,
          lat: shipperLatitude
        }
      : null,
    receiverLongitude !== null && receiverLatitude !== null
      ? {
          type: 'receiver',
          name: order.receivingContactName,
          address: order.receivingAddressDetail,
          longitude: receiverLongitude,
          latitude: receiverLatitude,
          lng: receiverLongitude,
          lat: receiverLatitude
        }
      : null
  ].filter(Boolean) as Waybill['routePoints']
}

async function enrichWaybillRouteFromOrder(token: string, waybill: Waybill) {
  if (hasRouteCoordinates(waybill)) return waybill
  const order = await findRouteOrder(token, waybill)
  if (!order) return waybill
  const routePoints = routePointsFromOrder(order)
  if (!routePoints?.length) return waybill

  return {
    ...waybill,
    originCity: waybill.originCity || order.originStation || '',
    destinationCity: waybill.destinationCity || order.destinationStation || '',
    shipperName: waybill.shipperName || order.shippingContactName,
    shipperPhone: waybill.shipperPhone || order.shippingContactPhone,
    shipperAddress: waybill.shipperAddress || order.shippingAddressDetail || '',
    shipperLongitude: waybill.shipperLongitude ?? order.shippingLongitude,
    shipperLatitude: waybill.shipperLatitude ?? order.shippingLatitude,
    receiverName: waybill.receiverName || order.receivingContactName,
    receiverPhone: waybill.receiverPhone || order.receivingContactPhone,
    receiverAddress: waybill.receiverAddress || order.receivingAddressDetail || '',
    receiverLongitude: waybill.receiverLongitude ?? order.receivingLongitude,
    receiverLatitude: waybill.receiverLatitude ?? order.receivingLatitude,
    plannedLoadTime: waybill.plannedLoadTime || order.plannedDepartureTime,
    plannedUnloadTime: waybill.plannedUnloadTime || order.plannedArrivalTime,
    routePoints
  }
}

function mergeProgressPatch(
  map: Map<string, DriverProgressPatch>,
  waybillId: string,
  patch: DriverProgressPatch
) {
  const current = map.get(waybillId)
  if (!current || getStatusRank(patch.status) >= getStatusRank(current.status)) {
    map.set(waybillId, { ...current, ...patch })
  }
}

function getStatusRank(status: WaybillStatus) {
  const rank: Record<WaybillStatus, number> = {
    pending: 0,
    accepted: 1,
    loading: 2,
    transporting: 3,
    unloading: 4,
    signed: 5,
    completed: 6,
    cancelled: 7
  }
  return rank[status] ?? 0
}

const forwardStatusFlow: WaybillStatus[] = [
  'pending',
  'accepted',
  'loading',
  'transporting',
  'unloading',
  'signed',
  'completed'
]

async function updateWaybillProgressively(
  token: string,
  waybill: Waybill,
  patch: DriverProgressPatch
) {
  if (patch.status === 'cancelled') return updateWaybill(token, waybill.id, patch)

  const currentIndex = forwardStatusFlow.indexOf(waybill.status)
  const targetIndex = forwardStatusFlow.indexOf(patch.status)
  if (currentIndex < 0 || targetIndex <= currentIndex) return waybill

  let updated: Waybill | null = waybill
  for (const status of forwardStatusFlow.slice(currentIndex + 1, targetIndex + 1)) {
    updated = await updateWaybill(token, waybill.id, status === patch.status ? patch : { status })
    if (!updated) throw new Error('运单状态同步失败')
  }
  return updated
}

async function listDriverProgressPatches(token: string, ids: string[]) {
  const patches = new Map<string, DriverProgressPatch>()
  if (!ids.length) return patches
  const filter = inFilter(ids)
  const eventQuery = request<
    Array<{
      waybill_id: string
      event_type?: string
      event_time?: string
      payload?: Record<string, unknown>
    }>
  >(
    restPath(
      'tms_waybill_event',
      `?select=waybill_id,event_type,event_time,payload&waybill_id=${filter}&event_type=${inFilter(driverActionEvents)}&order=event_time.asc`
    ),
    { token }
  )
  const proofQuery = request<
    Array<{ waybill_id: string; proof_type?: string; uploaded_at?: string }>
  >(
    restPath(
      'tms_waybill_proof',
      `?select=waybill_id,proof_type,uploaded_at&waybill_id=${filter}&limit=1000&order=uploaded_at.asc`
    ),
    { token }
  )
  const [eventResult, proofResult] = await Promise.allSettled([eventQuery, proofQuery])

  if (eventResult.status === 'fulfilled') {
    for (const item of eventResult.value) {
      const action = String(item.payload?.action || '')
      if (!driverActionPayloads.includes(action)) continue
      if (action === 'accept') {
        mergeProgressPatch(patches, item.waybill_id, {
          status: 'accepted',
          acceptedAt: item.event_time
        })
      }
      if (action === 'upload_pickup') {
        mergeProgressPatch(patches, item.waybill_id, {
          status: 'loading',
          loadedAt: item.event_time
        })
      }
      if (action === 'confirm_departure') {
        mergeProgressPatch(patches, item.waybill_id, {
          status: 'transporting',
          departedAt: item.event_time
        })
      }
      if (action === 'confirm_arrival') {
        mergeProgressPatch(patches, item.waybill_id, {
          status: 'unloading',
          arrivedAt: item.event_time
        })
      }
      if (action === 'complete_unloading') {
        mergeProgressPatch(patches, item.waybill_id, {
          status: 'unloading',
          unloadedAt: item.event_time
        })
      }
      if (action === 'complete_unload' || action === 'submit_signature' || action === 'sign') {
        mergeProgressPatch(patches, item.waybill_id, {
          status: 'signed',
          unloadedAt: item.event_time
        })
      }
      if (action === 'complete') {
        mergeProgressPatch(patches, item.waybill_id, {
          status: 'completed',
          unloadedAt: item.event_time,
          completedAt: item.event_time
        })
      }
      if (action === 'cancel') {
        mergeProgressPatch(patches, item.waybill_id, {
          status: 'cancelled',
          cancelledAt: item.event_time
        })
      }
    }
  }

  if (proofResult.status === 'fulfilled') {
    for (const item of proofResult.value) {
      if (item.proof_type === 'pickup_photo') {
        mergeProgressPatch(patches, item.waybill_id, {
          status: 'loading',
          loadedAt: item.uploaded_at
        })
      }
    }
  }

  return patches
}

export async function normalizeAssignedWaybillStatuses(
  token: string,
  options: ListWaybillOptions = {}
) {
  const waybills = await listWaybills(token, {
    ...options,
    group: 'all',
    limit: options.limit || 100
  })
  const candidates = waybills.filter((item) => activeStatuses.includes(item.status))
  if (!candidates.length) return []

  const progressPatches = await listDriverProgressPatches(
    token,
    candidates.map((item) => item.id)
  )
  const progressedCandidates = candidates.filter((item) => {
    const patch = progressPatches.get(item.id)
    return Boolean(patch && getStatusRank(patch.status) > getStatusRank(item.status))
  })
  const updated: Waybill[] = []
  for (const item of progressedCandidates) {
    const patch = progressPatches.get(item.id)
    if (!patch) continue
    const normalized = await updateWaybillProgressively(token, item, {
      ...patch,
      acceptedAt: item.acceptedAt || patch.acceptedAt,
      loadedAt: item.loadedAt || patch.loadedAt,
      departedAt: item.departedAt || patch.departedAt,
      arrivedAt: item.arrivedAt || patch.arrivedAt,
      unloadedAt: item.unloadedAt || patch.unloadedAt,
      completedAt: item.completedAt || patch.completedAt,
      cancelledAt: item.cancelledAt || patch.cancelledAt
    })
    if (normalized) updated.push(normalized)
  }
  return updated
}

export async function getWaybill(token: string, id: string) {
  const waybill = await rpc<Waybill | null>(token, 'tms_get_driver_mobile_waybill', {
    p_waybill_id: id
  })
  if (!waybill) return null
  return enrichWaybillRouteFromOrder(token, waybill)
}

export async function updateWaybill(token: string, id: string, patch: Partial<Waybill>) {
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
  return rpc<WaybillEvent[]>(token, 'tms_list_driver_mobile_waybill_events', {
    p_waybill_id: waybillId
  })
}

export async function createWaybillEvent(
  token: string,
  waybill: Waybill,
  eventType: string,
  operatorName?: string,
  payload?: Record<string, unknown>
) {
  const body = {
    waybill_id: waybill.id,
    event_type: eventType,
    event_time: new Date().toISOString(),
    operator_name: operatorName,
    location_text: `${waybill.originCity} - ${waybill.destinationCity}`,
    payload: payload || {}
  }
  const rows = await request<unknown[]>(restPath('tms_waybill_event', `?select=${EVENT_SELECT}`), {
    method: 'POST',
    token,
    body,
    headers: { Prefer: 'return=representation' }
  })
  return keysToCamel<WaybillEvent[]>(rows)[0] || null
}

export async function listWaybillProofs(token: string, waybillId: string) {
  return rpc<WaybillProof[]>(token, 'tms_list_driver_mobile_waybill_proofs', {
    p_waybill_id: waybillId
  })
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

type DbWaybillProofType = 'pickup_photo' | 'delivery_photo' | 'receipt' | 'other'

const DB_PROOF_TYPE_MAP: Record<string, DbWaybillProofType> = {
  pickup: 'pickup_photo',
  pickup_photo: 'pickup_photo',
  loading_photo: 'pickup_photo',
  departure: 'other',
  delivery: 'delivery_photo',
  delivery_photo: 'delivery_photo',
  unloading_photo: 'delivery_photo',
  return: 'other',
  receipt: 'receipt',
  loading_ticket: 'other',
  unloading_ticket: 'other',
  signature_confirmation: 'receipt',
  other: 'other'
}

function toDbProofType(proofType: string): DbWaybillProofType {
  return DB_PROOF_TYPE_MAP[proofType] || 'other'
}

export async function createWaybillProof(
  token: string,
  waybill: Waybill,
  proofType: string,
  file: ProofFile,
  uploaderName?: string
) {
  return rpc<WaybillProof | null>(token, 'tms_create_driver_mobile_waybill_proof', {
    p_waybill_id: waybill.id,
    p_proof_type: toDbProofType(proofType),
    p_file_url: file.url,
    p_file_name: file.name,
    p_mime_type: file.fileType,
    p_file_size: file.fileSize,
    p_uploaded_at: new Date().toISOString(),
    p_uploader_name: uploaderName
  })
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
    try {
      await createWaybillProof(token, waybill, proofType, file, uploaderName)
      files.push(file)
    } catch (error) {
      try {
        await removeStorageObjects('attachments', [uploaded.path], token)
      } catch (cleanupError) {
        console.warn('failed to clean up untracked waybill proof', cleanupError)
      }
      throw new Error(
        error instanceof Error ? `保存照片记录失败：${error.message}` : '保存照片记录失败'
      )
    }
  }

  return files
}

export async function getCargoOperationContext(
  token: string,
  waybillId: string,
  operationType: CargoOperationType
) {
  return rpc<CargoOperationContext>(token, 'tms_get_waybill_cargo_operation_context', {
    p_waybill_id: waybillId,
    p_operation_type: operationType
  })
}

export async function checkInCargoOperation(
  token: string,
  waybillId: string,
  operationType: CargoOperationType,
  location: CargoOperationLocation,
  outsideReason?: string | null,
  automatic = false
) {
  return rpc<CargoOperationContext>(token, 'tms_check_in_waybill_cargo_operation', {
    p_waybill_id: waybillId,
    p_operation_type: operationType,
    p_longitude: location.longitude,
    p_latitude: location.latitude,
    p_accuracy_m: location.accuracyM ?? null,
    p_location_text: location.locationText || null,
    p_outside_reason: outsideReason || null,
    p_automatic: automatic
  })
}

export async function completeCargoOperation(
  token: string,
  waybillId: string,
  operationType: CargoOperationType,
  payload: CargoOperationCompletePayload
) {
  return rpc<CargoOperationContext>(token, 'tms_complete_waybill_cargo_operation', {
    p_waybill_id: waybillId,
    p_operation_type: operationType,
    p_gross_weight_ton: payload.grossWeightTon ?? null,
    p_tare_weight_ton: payload.tareWeightTon ?? null,
    p_weight_ton: payload.weightTon,
    p_photo_urls: payload.photoUrls,
    p_weighbridge_ticket_urls: payload.weighbridgeTicketUrls,
    p_recognition_info: payload.recognitionInfo || null,
    p_recognition_payload: payload.recognitionPayload || {},
    p_remark: payload.remark || null
  })
}

export async function analyzeCargoWeighbridgeTicket(
  token: string,
  waybillId: string,
  operationType: CargoOperationType,
  imageUrls: string[]
) {
  return request<CargoOperationOcrResponse>('/functions/v1/ai-waybill-cargo-ocr', {
    method: 'POST',
    token,
    body: { waybillId, operationType, imageUrls }
  })
}

export async function getWaybillExecutionContext(token: string, waybillId: string) {
  return rpc<WaybillExecutionContext>(token, 'tms_get_waybill_execution_context', {
    p_waybill_id: waybillId
  })
}

export async function acceptAssignedWaybill(token: string, waybillId: string) {
  return rpc<WaybillExecutionContext>(token, 'tms_accept_assigned_waybill', {
    p_waybill_id: waybillId
  })
}

export async function recordWaybillDeparture(
  token: string,
  waybillId: string,
  departureTime: string,
  odometerKm: number,
  photoUrls: string[],
  remark?: string | null
) {
  return rpc<WaybillExecutionContext>(token, 'tms_record_waybill_departure', {
    p_waybill_id: waybillId,
    p_departure_time: departureTime,
    p_odometer_km: odometerKm,
    p_photo_urls: photoUrls,
    p_remark: remark || null
  })
}

export async function signWaybill(
  token: string,
  waybillId: string,
  signedAt: string,
  signerName: string,
  receiptUrls: string[],
  signatureUrls: string[],
  remark?: string | null
) {
  return rpc<WaybillExecutionContext>(token, 'tms_sign_waybill', {
    p_waybill_id: waybillId,
    p_signed_at: signedAt,
    p_signer_name: signerName,
    p_receipt_urls: receiptUrls,
    p_signature_urls: signatureUrls,
    p_remark: remark || null
  })
}

export async function completeWaybillExecution(
  token: string,
  waybillId: string,
  returnTime: string,
  returnOdometerKm: number,
  photoUrls: string[],
  remark?: string | null
) {
  return rpc<WaybillExecutionContext>(token, 'tms_complete_waybill_execution', {
    p_waybill_id: waybillId,
    p_return_time: returnTime,
    p_return_odometer_km: returnOdometerKm,
    p_photo_urls: photoUrls,
    p_remark: remark || null
  })
}

export async function cancelAssignedWaybill(token: string, waybillId: string, reason: string) {
  return rpc<WaybillExecutionContext>(token, 'tms_cancel_assigned_waybill', {
    p_waybill_id: waybillId,
    p_reason: reason
  })
}
