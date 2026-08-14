import type {
  DriverExpenseAiFeatureConfig,
  DriverExpenseContext,
  DriverExpenseOcrAnalyzeResponse,
  DriverExpenseSubmitPayload,
} from "./types";
import {
  removeStorageObjects,
  request,
  rpc,
  uploadFileToStorage,
} from "./supabase";

const EXPENSE_BUCKET = "attachments";
const EXPENSE_ROOT = "waybill-expenses";

export interface UploadedDriverExpenseFile {
  url: string;
  objectPath: string;
}

function getImageExtension(filePath: string) {
  const clean = filePath.split("?")[0] || filePath;
  const raw = clean.includes(".")
    ? clean.slice(clean.lastIndexOf(".") + 1).toLowerCase()
    : "jpg";
  return ["jpg", "jpeg", "png", "webp", "heic"].includes(raw)
    ? raw
    : "jpg";
}

function createExpenseObjectPath(
  authUserId: string,
  waybillId: string,
  filePath: string,
) {
  const nonce = Math.random().toString(36).slice(2, 10);
  const extension = getImageExtension(filePath);
  return `${EXPENSE_ROOT}/${authUserId}/${waybillId}/${Date.now()}-${nonce}.${extension}`;
}

export function getDriverExpenseContext(token: string, waybillId: string) {
  return rpc<DriverExpenseContext>(
    token,
    "tms_get_driver_waybill_expense_context",
    { p_waybill_id: waybillId },
  );
}

export async function getDriverExpenseOcrEnabled(token: string) {
  const configs = await rpc<DriverExpenseAiFeatureConfig[]>(
    token,
    "get_effective_ai_feature_configs",
    {},
  );
  return configs.find((item) => item.feature === "waybill_expense_ocr")?.enabled ?? true;
}

export function analyzeDriverExpenseByAi(token: string, imageUrls: string[]) {
  return request<DriverExpenseOcrAnalyzeResponse>(
    "/functions/v1/ai-waybill-expense-ocr",
    {
      method: "POST",
      token,
      body: { action: "analyze", imageUrls },
    },
  );
}

export function reviewDriverExpenseOcrArtifact(
  token: string,
  params: {
    artifactId: string;
    costId: string;
    finalPayload: Record<string, unknown>;
  },
) {
  return request<{ success?: boolean }>(
    "/functions/v1/ai-waybill-expense-ocr",
    {
      method: "POST",
      token,
      body: {
        action: "review",
        artifactId: params.artifactId,
        entityId: params.costId,
        outcome: "applied",
        finalPayload: params.finalPayload,
      },
    },
  );
}

export async function uploadDriverExpenseFiles(
  token: string,
  authUserId: string,
  waybillId: string,
  filePaths: string[],
) {
  const uploaded: UploadedDriverExpenseFile[] = [];

  try {
    for (const filePath of filePaths) {
      const objectPath = createExpenseObjectPath(
        authUserId,
        waybillId,
        filePath,
      );
      const result = await uploadFileToStorage(
        EXPENSE_BUCKET,
        objectPath,
        filePath,
        token,
      );
      uploaded.push({ url: result.publicUrl, objectPath: result.path });
    }
    return uploaded;
  } catch (error) {
    try {
      await removeDriverExpenseFiles(
        token,
        uploaded.map((item) => item.objectPath),
      );
    } catch (cleanupError) {
      console.warn("failed to clean up incomplete expense uploads", cleanupError);
    }
    throw error;
  }
}

export function getDriverExpenseObjectPath(url: string) {
  const marker = `/storage/v1/object/public/${EXPENSE_BUCKET}/`;
  const markerIndex = url.indexOf(marker);
  if (markerIndex < 0) return null;
  const objectPath = decodeURIComponent(
    url.slice(markerIndex + marker.length).split("?")[0] || "",
  );
  return objectPath.startsWith(`${EXPENSE_ROOT}/`) ? objectPath : null;
}

export function removeDriverExpenseFiles(
  token: string,
  objectPaths: string[],
) {
  return removeStorageObjects(
    EXPENSE_BUCKET,
    [...new Set(objectPaths.filter(Boolean))],
    token,
  );
}

export function submitDriverExpense(
  token: string,
  payload: DriverExpenseSubmitPayload,
) {
  return rpc<string>(token, "tms_submit_driver_waybill_expense", {
    p_waybill_id: payload.waybillId,
    p_expense_item_id: payload.expenseItemId,
    p_amount: payload.amount,
    p_occurred_on: payload.occurredOn,
    p_attachments: payload.attachments,
    p_idempotency_key: payload.idempotencyKey,
    p_cost_id: payload.costId || null,
    p_provider_name: payload.providerName || null,
    p_payee_name: payload.payeeName || null,
    p_payment_channel: payload.paymentChannel || null,
    p_invoice_no: payload.invoiceNo || null,
    p_expense_location: payload.expenseLocation || null,
    p_expense_longitude: payload.expenseLongitude ?? null,
    p_expense_latitude: payload.expenseLatitude ?? null,
    p_expense_coordinate_system: payload.expenseCoordinateSystem || null,
    p_remark: payload.remark || null,
  });
}
