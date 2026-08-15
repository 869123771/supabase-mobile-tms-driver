export type WaybillStatus =
  | "pending"
  | "accepted"
  | "loading"
  | "transporting"
  | "unloading"
  | "signed"
  | "completed"
  | "cancelled";

export interface SessionUser {
  id: string;
  email?: string;
  phone?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
  user: SessionUser;
}

export interface Driver {
  id: string;
  tenantId?: string;
  driverName: string;
  phone?: string;
  email?: string;
  userId?: string;
  authUserId?: string;
  carrierId?: string;
  gender?: string;
  idCardNo?: string;
  licenseType?: string;
  driverLicenseFrontUrl?: string;
  driverLicenseBackUrl?: string;
}

export interface Carrier {
  id: string;
  carrierCode?: string;
  companyName: string;
  contactName?: string;
  contactPhone?: string;
}

export interface Vehicle {
  id: string;
  plateNo: string;
  carrierId?: string;
  primaryDriverId?: string;
  companyName?: string;
  vehicleType?: string;
  brandModel?: string;
  operationStatus?: string;
  vehiclePhotoUrl?: string;
  approvedLoadMass?: number;
  overallLength?: number;
  fuelType?: string;
  auditStatus?: string;
  drivingLicenseFrontUrl?: string;
  drivingLicenseBackUrl?: string;
  operationLicenseUrl?: string;
  licensePlateCode?: string;
}

export interface Waybill {
  id: string;
  tenantId: string;
  waybillNo: string;
  status: WaybillStatus;
  carrierId?: string;
  driverId?: string;
  vehicleId?: string;
  cargoId?: string;
  cargoNo?: string;
  goodsNo?: string;
  orderNo?: string;
  senderName?: string;
  senderPhone?: string;
  senderAddress?: string;
  fromStationName?: string;
  toStationName?: string;
  transferStationName?: string;
  originCity: string;
  destinationCity: string;
  shipperName?: string;
  shipperPhone?: string;
  shipperAddress: string;
  shipperLongitude?: number | string | null;
  shipperLatitude?: number | string | null;
  receiverName?: string;
  receiverPhone?: string;
  receiverAddress: string;
  receiverLongitude?: number | string | null;
  receiverLatitude?: number | string | null;
  plannedLoadTime?: string;
  plannedUnloadTime?: string;
  acceptedAt?: string;
  loadedAt?: string;
  departedAt?: string;
  arrivedAt?: string;
  unloadedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cargoName: string;
  cargoType?: string;
  cargoUnit?: string;
  cargoWeightTon?: number;
  cargoVolumeM3?: number;
  cargoQuantity?: string;
  freightAmount: number;
  estimatedDurationMin?: number;
  remainingDistanceKm?: number;
  routePoints?: Array<{
    longitude?: number | string | null;
    latitude?: number | string | null;
    lng?: number | string | null;
    lat?: number | string | null;
    type?: string;
    name?: string;
    address?: string;
  }>;
  pickupPhotos?: ProofFile[];
  deliveryPhotos?: ProofFile[];
  receiptAttachments?: ProofFile[];
  remark?: string;
  createTime?: string;
  driver?: Driver | null;
  carrier?: Carrier | null;
  vehicle?: Vehicle | null;
}

export interface WaybillEvent {
  id: string;
  tenantId?: string;
  waybillId: string;
  eventType: string;
  eventTime: string;
  operatorName?: string;
  locationText?: string;
  payload?: Record<string, unknown>;
  remark?: string;
  longitude?: number | null;
  latitude?: number | null;
  createTime?: string;
}

export interface ProofFile {
  name?: string;
  url: string;
  fileType?: string;
  fileSize?: number;
}

export interface WaybillProof {
  id: string;
  tenantId?: string;
  waybillId: string;
  proofType: "pickup_photo" | "delivery_photo" | "receipt" | "other" | string;
  fileUrl: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  uploadedAt?: string;
  uploaderName?: string;
  remark?: string;
}

export type CargoOperationType = "loading" | "unloading";
export type CargoOperationStatus = "checked_in" | "completed";
export type CargoOperationCheckinMode = "manual" | "automatic" | "admin";

export interface CargoOperationRecord {
  id: string;
  tenantId: string;
  waybillId: string;
  operationType: CargoOperationType;
  operationStatus: CargoOperationStatus;
  checkinTime: string;
  checkinMode: CargoOperationCheckinMode;
  operatorName?: string | null;
  longitude: number;
  latitude: number;
  locationAccuracyM?: number | null;
  locationText?: string | null;
  geofenceCenterLongitude: number;
  geofenceCenterLatitude: number;
  geofenceRadiusM: number;
  distanceM: number;
  insideGeofence: boolean;
  outsideReason?: string | null;
  grossWeightTon?: number | null;
  tareWeightTon?: number | null;
  weightTon?: number | null;
  recognitionInfo?: string | null;
  recognitionPayload?: CargoOperationRecognitionPayload | null;
  photoUrls: string[];
  weighbridgeTicketUrls: string[];
  completedAt?: string | null;
  remark?: string | null;
}

export interface CargoOperationContext {
  waybillId: string;
  operationType: CargoOperationType;
  waybillStatus: WaybillStatus;
  centerLongitude?: number | null;
  centerLatitude?: number | null;
  radiusM: number;
  allowOutsideCheckIn: boolean;
  autoCheckIn: boolean;
  geofenceEnabled: boolean;
  canManage: boolean;
  operation?: CargoOperationRecord | null;
}

export type ExecutionAction = "departure" | "signature" | "completion";

export interface WaybillExecutionRecord {
  id: string;
  tenantId: string;
  waybillId: string;
  departureTime?: string | null;
  departureOdometerKm?: number | null;
  departurePhotoUrls: string[];
  departureRemark?: string | null;
  departureOperatorName?: string | null;
  departureRecordedAt?: string | null;
  signedAt?: string | null;
  signerName?: string | null;
  receiptUrls: string[];
  signatureUrls: string[];
  signatureRemark?: string | null;
  signatureOperatorName?: string | null;
  signatureRecordedAt?: string | null;
  returnTime?: string | null;
  returnOdometerKm?: number | null;
  returnPhotoUrls: string[];
  completionRemark?: string | null;
  completionOperatorName?: string | null;
  completionRecordedAt?: string | null;
}

export interface WaybillExecutionContext {
  waybillId: string;
  waybillStatus: WaybillStatus;
  loadingStatus?: CargoOperationStatus | null;
  unloadingStatus?: CargoOperationStatus | null;
  arrivalTime?: string | null;
  arrivalAddress?: string | null;
  arrivalLongitude?: number | null;
  arrivalLatitude?: number | null;
  canAccept: boolean;
  canDepart: boolean;
  canArrive: boolean;
  canUnload: boolean;
  canSign: boolean;
  canComplete: boolean;
  canCancel: boolean;
  needsReturnCompletion: boolean;
  record?: WaybillExecutionRecord | null;
}

export type DriverExpenseAuditStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "voided";

export type DriverExpenseSettlementStatus =
  | "unsettled"
  | "pending_payment"
  | "paid";

export interface DriverExpenseItem {
  id: string;
  itemCode: string;
  itemName: string;
  parentName?: string | null;
  businessCategory?: string | null;
}

export interface DriverExpenseRecord {
  id: string;
  costNo: string;
  expenseItemId: string;
  expenseItemName: string;
  expenseParentName?: string | null;
  amount: number;
  occurredOn: string;
  attachments: string[];
  auditStatus: DriverExpenseAuditStatus;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  reviewRemark?: string | null;
  settlementStatus: DriverExpenseSettlementStatus;
  paidAt?: string | null;
  providerName?: string | null;
  payeeName?: string | null;
  paymentChannel?: string | null;
  invoiceNo?: string | null;
  expenseLocation?: string | null;
  expenseLongitude?: number | null;
  expenseLatitude?: number | null;
  expenseCoordinateSystem?: "gcj02" | "wgs84" | "bd09" | null;
  remark?: string | null;
  sourceId?: string | null;
  createTime: string;
  updateTime: string;
}

export interface DriverExpenseStats {
  reportCount: number;
  totalAmount: number;
  pendingCount: number;
  approvedAmount: number;
}

export interface DriverExpenseWaybill {
  id: string;
  waybillNo: string;
  status: WaybillStatus;
  originCity: string;
  destinationCity: string;
  shipperAddress: string;
  receiverAddress: string;
}

export interface DriverExpenseContext {
  waybill: DriverExpenseWaybill;
  canReport: boolean;
  expenseItems: DriverExpenseItem[];
  records: DriverExpenseRecord[];
  stats: DriverExpenseStats;
}

export interface DriverExpenseSubmitPayload {
  waybillId: string;
  expenseItemId: string;
  amount: number;
  occurredOn: string;
  attachments: string[];
  idempotencyKey: string;
  costId?: string | null;
  providerName?: string | null;
  payeeName?: string | null;
  paymentChannel?: string | null;
  invoiceNo?: string | null;
  expenseLocation?: string | null;
  expenseLongitude?: number | null;
  expenseLatitude?: number | null;
  expenseCoordinateSystem?: "gcj02" | "wgs84" | "bd09" | null;
  remark?: string | null;
}

export type DriverExpenseOcrField =
  | "amount"
  | "occurredOn"
  | "quantity"
  | "unitPrice"
  | "providerName"
  | "payeeName"
  | "paymentChannel"
  | "invoiceNo"
  | "meterNo"
  | "expenseLocation"
  | "remark";

export interface DriverExpenseOcrDraft {
  amount: number | null;
  occurredOn: string | null;
  quantity: number | null;
  unitPrice: number | null;
  providerName: string | null;
  payeeName: string | null;
  paymentChannel: string | null;
  invoiceNo: string | null;
  meterNo: string | null;
  expenseLocation: string | null;
  remark: string | null;
}

export interface DriverExpenseOcrAnalyzeResponse {
  artifactId: string;
  runId: string;
  generatedAt: string;
  summary: string;
  confidence: number;
  fieldConfidence: Partial<Record<DriverExpenseOcrField, number>>;
  missingFields: string[];
  warnings: string[];
  expense: DriverExpenseOcrDraft;
  reviewConfidenceThreshold: number;
}

export interface DriverExpenseAiFeatureConfig {
  feature: string;
  enabled: boolean;
}

export interface CargoOperationLocation {
  longitude: number;
  latitude: number;
  accuracyM?: number | null;
  locationText?: string | null;
}

export interface CargoOperationCompletePayload {
  grossWeightTon?: number | null;
  tareWeightTon?: number | null;
  weightTon: number;
  photoUrls: string[];
  weighbridgeTicketUrls: string[];
  recognitionInfo?: string | null;
  recognitionPayload?: CargoOperationRecognitionPayload | null;
  remark?: string | null;
}

export interface CargoOperationRecognitionWeights {
  grossWeightTon: number | null;
  tareWeightTon: number | null;
  netWeightTon: number | null;
}

export interface CargoOperationRecognitionPayload {
  summary?: string;
  confidence?: number;
  rawText?: string;
  weights?: CargoOperationRecognitionWeights;
  warnings?: string[];
  generatedAt?: string;
  source?: "ai_ocr" | string;
  ticketUrls?: string[];
}

export interface CargoOperationOcrResponse {
  summary: string;
  confidence: number;
  rawText: string;
  weights: CargoOperationRecognitionWeights;
  warnings: string[];
  generatedAt: string;
}

export interface SysUser {
  id: string;
  authUserId?: string;
  tenantId?: string;
  userName?: string;
  nickName?: string;
  userPhone?: string;
  userEmail: string;
  userType?: string;
  avatar?: string;
  status?: string;
}

export interface ProfileSummary {
  user?: SysUser | null;
  driver?: Driver | null;
  carrier?: Carrier | null;
  vehicle?: Vehicle | null;
  completedCount: number;
  totalMileageKm: number;
  rating: number;
}
