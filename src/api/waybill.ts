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
const ORDER_DISPATCH_SELECT =
  'id,order_no,cargo_no,dispatch_status,dispatch_driver_id,dispatch_vehicle_id,order_status'
const ORDER_ROUTE_SELECT =
  'id,order_no,cargo_no,origin_station,destination_station,shipping_contact_name,shipping_contact_phone,shipping_address_detail,shipping_longitude,shipping_latitude,receiving_contact_name,receiving_contact_phone,receiving_address_detail,receiving_longitude,receiving_latitude,planned_departure_time,planned_arrival_time'

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

interface OrderDispatchSnapshot {
  id: string
  orderNo?: string
  cargoNo?: string
  dispatchStatus?: string
  dispatchDriverId?: string
  dispatchVehicleId?: string
  orderStatus?: string
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

const activeStatuses: WaybillStatus[] = ['accepted', 'loading', 'transporting', 'unloading']
const driverActionEvents = ['accepted', 'loaded', 'arrived', 'completed', 'cancelled']
const driverActionPayloads = ['accept', 'upload_pickup', 'confirm_arrival', 'complete']

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

async function listOrdersByField(token: string, field: string, values: string[]) {
  if (!values.length) return []
  const rows = await request<unknown[]>(
    restPath('tms_order', `?select=${ORDER_DISPATCH_SELECT}&${field}=${inFilter(values)}`),
    { token }
  )
  return keysToCamel<OrderDispatchSnapshot[]>(rows)
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

async function listRelatedOrders(token: string, waybills: Waybill[]) {
  const queries = [
    listOrdersByField(token, 'order_no', unique(waybills.map((item) => item.orderNo || item.waybillNo))),
    listOrdersByField(token, 'cargo_no', unique(waybills.flatMap((item) => [item.cargoNo, item.goodsNo])))
  ]
  const results = await Promise.allSettled(queries)
  const orders = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
  return Array.from(new Map(orders.map((order) => [order.id, order])).values())
}

function findRelatedOrder(waybill: Waybill, orders: OrderDispatchSnapshot[]) {
  return orders.find((order) => {
    if (waybill.orderNo && order.orderNo === waybill.orderNo) return true
    if (waybill.waybillNo && order.orderNo === waybill.waybillNo) return true
    if (waybill.cargoNo && order.cargoNo === waybill.cargoNo) return true
    if (waybill.goodsNo && order.cargoNo === waybill.goodsNo) return true
    return false
  })
}

async function listActionWaybillIds(token: string, ids: string[]) {
  if (!ids.length) return new Set<string>()
  const filter = inFilter(ids)
  const eventQuery = request<Array<{ waybill_id: string; payload?: Record<string, unknown> }>>(
    restPath(
      'tms_waybill_event',
      `?select=waybill_id,payload&waybill_id=${filter}&event_type=${inFilter(driverActionEvents)}`
    ),
    { token }
  )
  const proofQuery = request<Array<{ waybill_id: string }>>(
    restPath('tms_waybill_proof', `?select=waybill_id&waybill_id=${filter}&limit=1000`),
    { token }
  )
  const [eventResult, proofResult] = await Promise.allSettled([eventQuery, proofQuery])
  const driverEventIds =
    eventResult.status === 'fulfilled'
      ? eventResult.value
          .filter((item) => driverActionPayloads.includes(String(item.payload?.action || '')))
          .map((item) => item.waybill_id)
      : []
  return new Set([
    ...driverEventIds,
    ...(proofResult.status === 'fulfilled' ? proofResult.value.map((item) => item.waybill_id) : [])
  ])
}

function shouldResetToPending(waybill: Waybill, order: OrderDispatchSnapshot | undefined, actionWaybillIds: Set<string>) {
  if (!activeStatuses.includes(waybill.status)) return false
  if (actionWaybillIds.has(waybill.id)) return false
  if (!order) return true
  return order.dispatchStatus === 'loaded' && order.orderStatus !== 'cancelled'
}

export async function normalizeAssignedWaybillStatuses(
  token: string,
  options: ListWaybillOptions = {}
) {
  const waybills = await listWaybills(token, { ...options, group: 'all', limit: options.limit || 100 })
  const candidates = waybills.filter((item) => activeStatuses.includes(item.status))
  if (!candidates.length) return []

  const [orders, actionWaybillIds] = await Promise.all([
    listRelatedOrders(token, candidates),
    listActionWaybillIds(token, candidates.map((item) => item.id))
  ])
  const pendingCandidates = candidates.filter((item) =>
    shouldResetToPending(item, findRelatedOrder(item, orders), actionWaybillIds)
  )

  const updated: Waybill[] = []
  for (const item of pendingCandidates) {
    const normalized = await updateWaybill(token, item.id, { status: 'pending' })
    if (normalized) updated.push(normalized)
  }
  return updated
}

export async function getWaybill(token: string, id: string) {
  const rows = await request<unknown[]>(
    restPath('tms_waybill', `?select=${WAYBILL_SELECT}&id=eq.${id}&limit=1`),
    { token }
  )
  const waybill = keysToCamel<Waybill[]>(rows)[0] || null
  if (!waybill) return null
  return enrichWaybillRouteFromOrder(token, waybill)
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
