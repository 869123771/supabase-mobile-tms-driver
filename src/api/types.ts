export type WaybillStatus =
  | 'pending'
  | 'accepted'
  | 'loading'
  | 'transporting'
  | 'unloading'
  | 'signed'
  | 'completed'
  | 'cancelled'

export interface SessionUser {
  id: string
  email?: string
  phone?: string
  user_metadata?: Record<string, unknown>
  app_metadata?: Record<string, unknown>
}

export interface Session {
  access_token: string
  refresh_token: string
  expires_at?: number
  expires_in?: number
  token_type?: string
  user: SessionUser
}

export interface Driver {
  id: string
  tenantId?: string
  driverName: string
  phone?: string
  email?: string
  userId?: string
  authUserId?: string
  carrierId?: string
  gender?: string
  idCardNo?: string
  licenseType?: string
  driverLicenseFrontUrl?: string
  driverLicenseBackUrl?: string
}

export interface Carrier {
  id: string
  carrierCode?: string
  companyName: string
  contactName?: string
  contactPhone?: string
}

export interface Vehicle {
  id: string
  plateNo: string
  carrierId?: string
  primaryDriverId?: string
  companyName?: string
  vehicleType?: string
  brandModel?: string
  operationStatus?: string
  vehiclePhotoUrl?: string
  approvedLoadMass?: number
  overallLength?: number
  fuelType?: string
  auditStatus?: string
  drivingLicenseFrontUrl?: string
  drivingLicenseBackUrl?: string
  operationLicenseUrl?: string
  licensePlateCode?: string
}

export interface Waybill {
  id: string
  tenantId: string
  waybillNo: string
  status: WaybillStatus
  carrierId?: string
  driverId?: string
  vehicleId?: string
  cargoId?: string
  cargoNo?: string
  goodsNo?: string
  orderNo?: string
  senderName?: string
  senderPhone?: string
  senderAddress?: string
  fromStationName?: string
  toStationName?: string
  transferStationName?: string
  originCity: string
  destinationCity: string
  shipperName?: string
  shipperPhone?: string
  shipperAddress: string
  shipperLongitude?: number | string | null
  shipperLatitude?: number | string | null
  receiverName?: string
  receiverPhone?: string
  receiverAddress: string
  receiverLongitude?: number | string | null
  receiverLatitude?: number | string | null
  plannedLoadTime?: string
  plannedUnloadTime?: string
  acceptedAt?: string
  loadedAt?: string
  departedAt?: string
  arrivedAt?: string
  unloadedAt?: string
  completedAt?: string
  cancelledAt?: string
  cargoName: string
  cargoType?: string
  cargoUnit?: string
  cargoWeightTon?: number
  cargoVolumeM3?: number
  cargoQuantity?: string
  freightAmount: number
  estimatedDurationMin?: number
  remainingDistanceKm?: number
  routePoints?: Array<{
    longitude?: number | string | null
    latitude?: number | string | null
    lng?: number | string | null
    lat?: number | string | null
    type?: string
    name?: string
    address?: string
  }>
  pickupPhotos?: ProofFile[]
  deliveryPhotos?: ProofFile[]
  receiptAttachments?: ProofFile[]
  remark?: string
  createTime?: string
  driver?: Driver | null
  carrier?: Carrier | null
  vehicle?: Vehicle | null
}

export interface WaybillEvent {
  id: string
  tenantId?: string
  waybillId: string
  eventType: string
  eventTime: string
  operatorName?: string
  locationText?: string
  payload?: Record<string, unknown>
}

export interface ProofFile {
  name?: string
  url: string
  fileType?: string
  fileSize?: number
}

export interface WaybillProof {
  id: string
  tenantId?: string
  waybillId: string
  proofType: 'pickup_photo' | 'delivery_photo' | 'receipt' | 'other' | string
  fileUrl: string
  fileName?: string
  mimeType?: string
  fileSize?: number
  uploadedAt?: string
  uploaderName?: string
  remark?: string
}

export type CargoOperationType = 'loading' | 'unloading'
export type CargoOperationStatus = 'checked_in' | 'completed'
export type CargoOperationCheckinMode = 'manual' | 'automatic' | 'admin'

export interface CargoOperationRecord {
  id: string
  tenantId: string
  waybillId: string
  operationType: CargoOperationType
  operationStatus: CargoOperationStatus
  checkinTime: string
  checkinMode: CargoOperationCheckinMode
  operatorName?: string | null
  longitude: number
  latitude: number
  locationAccuracyM?: number | null
  locationText?: string | null
  geofenceCenterLongitude: number
  geofenceCenterLatitude: number
  geofenceRadiusM: number
  distanceM: number
  insideGeofence: boolean
  outsideReason?: string | null
  weightTon?: number | null
  photoUrls: string[]
  weighbridgeTicketUrls: string[]
  completedAt?: string | null
  remark?: string | null
}

export interface CargoOperationContext {
  waybillId: string
  operationType: CargoOperationType
  waybillStatus: WaybillStatus
  centerLongitude?: number | null
  centerLatitude?: number | null
  radiusM: number
  allowOutsideCheckIn: boolean
  autoCheckIn: boolean
  geofenceEnabled: boolean
  canManage: boolean
  operation?: CargoOperationRecord | null
}

export type ExecutionAction = 'departure' | 'signature' | 'completion'

export interface WaybillExecutionRecord {
  id: string
  tenantId: string
  waybillId: string
  departureTime?: string | null
  departureOdometerKm?: number | null
  departurePhotoUrls: string[]
  departureRemark?: string | null
  departureOperatorName?: string | null
  departureRecordedAt?: string | null
  signedAt?: string | null
  signerName?: string | null
  receiptUrls: string[]
  signatureUrls: string[]
  signatureRemark?: string | null
  signatureOperatorName?: string | null
  signatureRecordedAt?: string | null
  returnTime?: string | null
  returnOdometerKm?: number | null
  returnPhotoUrls: string[]
  completionRemark?: string | null
  completionOperatorName?: string | null
  completionRecordedAt?: string | null
}

export interface WaybillExecutionContext {
  waybillId: string
  waybillStatus: WaybillStatus
  loadingStatus?: CargoOperationStatus | null
  unloadingStatus?: CargoOperationStatus | null
  arrivalTime?: string | null
  arrivalAddress?: string | null
  arrivalLongitude?: number | null
  arrivalLatitude?: number | null
  canAccept: boolean
  canDepart: boolean
  canArrive: boolean
  canUnload: boolean
  canSign: boolean
  canComplete: boolean
  canCancel: boolean
  needsReturnCompletion: boolean
  record?: WaybillExecutionRecord | null
}

export interface CargoOperationLocation {
  longitude: number
  latitude: number
  accuracyM?: number | null
  locationText?: string | null
}

export interface CargoOperationCompletePayload {
  weightTon: number
  photoUrls: string[]
  weighbridgeTicketUrls: string[]
  remark?: string | null
}

export interface SysUser {
  id: string
  authUserId?: string
  tenantId?: string
  userName?: string
  nickName?: string
  userPhone?: string
  userEmail: string
  userType?: string
  avatar?: string
  status?: string
}

export interface ProfileSummary {
  user?: SysUser | null
  driver?: Driver | null
  carrier?: Carrier | null
  vehicle?: Vehicle | null
  completedCount: number
  totalMileageKm: number
  rating: number
}
