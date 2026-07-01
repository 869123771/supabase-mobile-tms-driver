export type WaybillStatus =
  | 'pending'
  | 'accepted'
  | 'loading'
  | 'transporting'
  | 'unloading'
  | 'completed'
  | 'cancelled'

export interface SessionUser {
  id: string
  email?: string
  phone?: string
  user_metadata?: Record<string, unknown>
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
  originCity: string
  destinationCity: string
  shipperName?: string
  shipperPhone?: string
  shipperAddress: string
  receiverName?: string
  receiverPhone?: string
  receiverAddress: string
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
  cargoWeightTon?: number
  cargoVolumeM3?: number
  cargoQuantity?: string
  freightAmount: number
  estimatedDurationMin?: number
  remainingDistanceKm?: number
  routePoints?: Array<{ longitude: number; latitude: number }>
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
  proofType: 'pickup' | 'delivery' | 'receipt' | string
  fileUrl: string
  fileName?: string
  mimeType?: string
  fileSize?: number
  uploadedAt?: string
  uploaderName?: string
  remark?: string
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
