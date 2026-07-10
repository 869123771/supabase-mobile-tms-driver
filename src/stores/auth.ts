import { defineStore } from 'pinia'
import { driverPasswordLogin, driverWechatPhoneLogin, refreshToken, signOut } from '@/api/supabase'
import type { Session } from '@/api/types'
import { useDictionaryStore } from './dictionary'

const STORAGE_KEY = 'tms-driver-session'

interface AuthState {
  session: Session | null
  booted: boolean
}

function normalizeSession(session: Session | null) {
  if (!session) return null
  if (!session.expires_at && session.expires_in) {
    session.expires_at = Math.floor(Date.now() / 1000) + session.expires_in
  }
  return session
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    session: null,
    booted: false
  }),
  getters: {
    token: (state) => state.session?.access_token || '',
    user: (state) => state.session?.user || null,
    isLoggedIn: (state) => Boolean(state.session?.access_token),
    isTokenExpired: (state) => {
      if (!state.session?.access_token) return false
      const expiresAt = state.session?.expires_at
      if (!expiresAt) return true
      return expiresAt * 1000 - Date.now() < 180_000
    }
  },
  actions: {
    hydrate() {
      if (this.booted) return
      const cached = uni.getStorageSync(STORAGE_KEY)
      if (cached) {
        try {
          this.session = normalizeSession(typeof cached === 'string' ? JSON.parse(cached) : cached)
        } catch {
          this.session = null
        }
      }
      this.booted = true
    },
    persist() {
      if (this.session) {
        uni.setStorageSync(STORAGE_KEY, JSON.stringify(this.session))
      } else {
        uni.removeStorageSync(STORAGE_KEY)
      }
    },
    async login(account: string, password: string) {
      this.session = normalizeSession(await driverPasswordLogin(account.trim(), password))
      this.persist()
      await useDictionaryStore().load(this.token, true)
      return this.session
    },
    async loginWithWechatPhone(phoneCode: string) {
      this.session = normalizeSession(await driverWechatPhoneLogin(phoneCode))
      this.persist()
      await useDictionaryStore().load(this.token, true)
      return this.session
    },
    async refreshSession() {
      if (!this.session?.refresh_token) {
        this.session = null
        this.persist()
        throw new Error('登录已过期，请重新登录')
      }
      this.session = normalizeSession(await refreshToken(this.session.refresh_token))
      this.persist()
      await useDictionaryStore().load(this.token, true)
    },
    async logout() {
      if (this.session?.access_token) {
        try {
          await signOut(this.session.access_token)
        } catch {
          // Local logout still clears stale credentials if remote logout is unavailable.
        }
      }
      useDictionaryStore().clear()
      this.session = null
      this.persist()
      uni.reLaunch({ url: '/pages/login/index' })
    }
  }
})
