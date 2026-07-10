import { defineStore } from 'pinia'
import { getProfileSummary } from '@/api/profile'
import type { ProfileSummary } from '@/api/types'
import { useAuthStore } from './auth'
import { useDictionaryStore } from './dictionary'

interface ProfileState {
  summary: ProfileSummary | null
  loading: boolean
}

export const useProfileStore = defineStore('profile', {
  state: (): ProfileState => ({
    summary: null,
    loading: false
  }),
  getters: {
    user: (state) => state.summary?.user || null,
    driver: (state) => state.summary?.driver || null,
    carrier: (state) => state.summary?.carrier || null,
    vehicle: (state) => state.summary?.vehicle || null
  },
  actions: {
    async load(force = false) {
      const auth = useAuthStore()
      auth.hydrate()
      if (!auth.token) return null
      if (this.summary && !force) return this.summary

      this.loading = true
      try {
        if (auth.isTokenExpired) {
          try {
            await auth.refreshSession()
          } catch (error) {
            uni.reLaunch({ url: '/pages/login/index' })
            throw error
          }
        }
        await useDictionaryStore().load(auth.token)
        this.summary = await getProfileSummary(auth.token, auth.user)
        return this.summary
      } finally {
        this.loading = false
      }
    },
    clear() {
      this.summary = null
    }
  }
})
