import { defineStore } from 'pinia'
import { listDictionaries, type DictionaryEntry, type DictionaryType } from '@/api/dictionary'

interface DictionaryState {
  types: DictionaryType[]
  entries: DictionaryEntry[]
  loading: boolean
  loaded: boolean
}

function normalize(value?: string) {
  return value?.trim()
}

export const useDictionaryStore = defineStore('dictionary', {
  state: (): DictionaryState => ({
    types: [],
    entries: [],
    loading: false,
    loaded: false
  }),
  getters: {
    typeIdByCode: (state) =>
      state.types.reduce<Record<string, string>>((map, item) => {
        if (item.code) map[item.code] = item.id
        return map
      }, {}),
    entriesByTypeCode(): Record<string, Record<string, DictionaryEntry>> {
      return this.entries.reduce<Record<string, Record<string, DictionaryEntry>>>((map, item) => {
        const typeCode = Object.entries(this.typeIdByCode).find(([, id]) => id === item.typeId)?.[0]
        if (!typeCode || !item.value) return map
        map[typeCode] = map[typeCode] || {}
        map[typeCode][item.value] = item
        return map
      }, {})
    }
  },
  actions: {
    async load(token: string, force = false) {
      if (!token || this.loading) return
      if (this.loaded && !force) return

      this.loading = true
      try {
        const { types, entries } = await listDictionaries(token)
        this.types = types
        this.entries = entries
        this.loaded = true
      } finally {
        this.loading = false
      }
    },
    findLabel(typeCode: string, value?: string) {
      const code = normalize(value)
      if (!code) return undefined
      return this.entriesByTypeCode[typeCode]?.[code]?.label
    },
    label(typeCode: string, value?: string, fallback = '--') {
      const code = normalize(value)
      if (!code) return fallback
      return this.findLabel(typeCode, code) || value || fallback
    },
    labelAny(typeCodes: string[], value?: string, fallback = '--') {
      const code = normalize(value)
      if (!code) return fallback
      for (const typeCode of typeCodes) {
        const label = this.findLabel(typeCode, code)
        if (label) return label
      }
      return value || fallback
    },
    clear() {
      this.types = []
      this.entries = []
      this.loaded = false
      this.loading = false
    }
  }
})
