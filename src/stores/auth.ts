import { defineStore } from 'pinia'
import { authPasswordLogin, refreshToken, request, restPath, signOut } from '@/api/supabase'
import type { Session } from '@/api/types'

const STORAGE_KEY = 'tms-driver-session'

interface AuthState {
  session: Session | null
  booted: boolean
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
      const expiresAt = state.session?.expires_at
      if (!expiresAt) return false
      return expiresAt * 1000 - Date.now() < 90_000
    }
  },
  actions: {
    hydrate() {
      if (this.booted) return
      const cached = uni.getStorageSync(STORAGE_KEY)
      if (cached) {
        try {
          this.session = typeof cached === 'string' ? JSON.parse(cached) : cached
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
      const email = await this.resolveEmail(account)
      this.session = await authPasswordLogin(email, password)
      this.persist()
      return this.session
    },
    async resolveEmail(account: string) {
      const normalized = account.trim()
      if (normalized.includes('@')) return normalized

      try {
        const query = `?user_phone=eq.${encodeURIComponent(normalized)}&select=user_email&limit=1`
        const rows = await request<Array<{ user_email: string }>>(restPath('sys_user', query), {
          headers: { Prefer: 'return=representation' }
        })
        return rows[0]?.user_email || normalized
      } catch {
        return normalized
      }
    },
    async refreshSession() {
      if (!this.session?.refresh_token) return
      this.session = await refreshToken(this.session.refresh_token)
      this.persist()
    },
    async logout() {
      if (this.session?.access_token) {
        try {
          await signOut(this.session.access_token)
        } catch {
          // Local logout still clears stale credentials if remote logout is unavailable.
        }
      }
      this.session = null
      this.persist()
      uni.reLaunch({ url: '/pages/login/index' })
    }
  }
})
