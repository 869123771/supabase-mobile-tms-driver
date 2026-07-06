import type { Session } from './types'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

interface RequestOptions {
  method?: HttpMethod
  body?: unknown
  token?: string
  headers?: Record<string, string>
  raw?: boolean
}

function trimSlash(value: string) {
  return value.replace(/\/$/, '')
}

export function toCamelKey(value: string) {
  return value.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase())
}

export function toSnakeKey(value: string) {
  return value
    .replace(/([A-Z])/g, '_$1')
    .replace(/^_/, '')
    .toLowerCase()
}

export function keysToCamel<T>(input: unknown): T {
  if (Array.isArray(input)) return input.map((item) => keysToCamel(item)) as T
  if (!input || typeof input !== 'object' || input.constructor !== Object) return input as T
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).map(([key, value]) => [
      toCamelKey(key),
      keysToCamel(value)
    ])
  ) as T
}

export function keysToSnake<T>(input: unknown): T {
  if (Array.isArray(input)) return input.map((item) => keysToSnake(item)) as T
  if (!input || typeof input !== 'object' || input.constructor !== Object) return input as T
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).map(([key, value]) => [
      toSnakeKey(key),
      keysToSnake(value)
    ])
  ) as T
}

export function buildQuery(params: Record<string, string | number | boolean | undefined>) {
  const pairs = Object.entries(params).filter(([, value]) => value !== undefined && value !== '')
  if (pairs.length === 0) return ''
  return `?${pairs
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')}`
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method || 'GET'
  const uniMethod = method as unknown as UniApp.RequestOptions['method']
  const url = path.startsWith('http') ? path : `${trimSlash(SUPABASE_URL)}${path}`
  const headers: Record<string, string> = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${options.token || SUPABASE_KEY}`,
    ...options.headers
  }

  if (!options.raw) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }

  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method: uniMethod,
      header: headers,
      data: options.body as UniApp.RequestOptions['data'],
      success(response) {
        const statusCode = response.statusCode || 0
        if (statusCode >= 200 && statusCode < 300) {
          resolve(response.data as T)
          return
        }
        reject(new Error(getErrorMessage(response.data)))
      },
      fail(error) {
        reject(new Error(error.errMsg || '网络请求失败'))
      }
    })
  })
}

function getErrorMessage(data: unknown) {
  if (typeof data === 'string') return data
  if (data && typeof data === 'object') {
    const payload = data as Record<string, unknown>
    return String(payload.message || payload.msg || payload.error || '请求失败')
  }
  return '请求失败'
}

export async function authPasswordLogin(email: string, password: string) {
  const session = await request<Session>('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email, password },
    headers: { Authorization: `Bearer ${SUPABASE_KEY}` }
  })
  return session
}

export async function driverPasswordLogin(account: string, password: string) {
  return request<Session>('/functions/v1/driver-auth', {
    method: 'POST',
    body: { type: 'password', account, password },
    headers: { Authorization: `Bearer ${SUPABASE_KEY}` }
  })
}

export async function driverWechatPhoneLogin(phoneCode: string) {
  return request<Session>('/functions/v1/driver-auth', {
    method: 'POST',
    body: { type: 'wechat-phone', phoneCode },
    headers: { Authorization: `Bearer ${SUPABASE_KEY}` }
  })
}

export async function refreshToken(refreshToken: string) {
  return request<Session>('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    body: { refresh_token: refreshToken },
    headers: { Authorization: `Bearer ${SUPABASE_KEY}` }
  })
}

export async function signOut(token: string) {
  await request('/auth/v1/logout', {
    method: 'POST',
    token
  })
}

export async function syncDriverWaybills(token: string) {
  return request<{ ok: boolean; synced: number; waybillNos: string[] }>(
    '/functions/v1/sync-driver-waybills',
    {
      method: 'POST',
      token,
      body: {}
    }
  )
}

export function restPath(table: string, query = '') {
  return `/rest/v1/${table}${query}`
}

export function getStoragePublicUrl(bucket: string, objectPath: string) {
  const encodedPath = objectPath
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')
  return `${trimSlash(SUPABASE_URL)}/storage/v1/object/public/${bucket}/${encodedPath}`
}

export async function uploadFileToStorage(
  bucket: string,
  objectPath: string,
  filePath: string,
  token: string
) {
  const url = `${trimSlash(SUPABASE_URL)}/storage/v1/object/${bucket}/${objectPath}`

  return new Promise<{ path: string; publicUrl: string }>((resolve, reject) => {
    uni.uploadFile({
      url,
      filePath,
      name: 'file',
      header: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
        'x-upsert': 'true'
      },
      success(response) {
        const statusCode = response.statusCode || 0
        if (statusCode >= 200 && statusCode < 300) {
          resolve({
            path: objectPath,
            publicUrl: getStoragePublicUrl(bucket, objectPath)
          })
          return
        }

        try {
          reject(new Error(getErrorMessage(JSON.parse(response.data))))
        } catch {
          reject(new Error(response.data || '文件上传失败'))
        }
      },
      fail(error) {
        reject(new Error(error.errMsg || '文件上传失败'))
      }
    })
  })
}
