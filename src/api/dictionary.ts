import { keysToCamel, request, restPath } from './supabase'

export interface DictionaryType {
  id: string
  code: string
  name: string
  status?: string
  nodeType?: string
  sort?: number
}

export interface DictionaryEntry {
  id: string
  typeId: string
  code?: string
  value: string
  label: string
  status?: string
  sort?: number
  color?: string
  tagType?: string
}

const TYPE_SELECT = 'id,code,name,status,node_type,sort'
const ENTRY_SELECT = 'id,type_id,code,value,label,status,sort,color,tag_type'
const PAGE_SIZE = 1000

async function listAll<T>(token: string, table: string, query: string) {
  const rows: T[] = []
  let offset = 0

  while (true) {
    const page = await request<unknown[]>(
      restPath(table, `${query}&limit=${PAGE_SIZE}&offset=${offset}`),
      { token }
    )
    const data = keysToCamel<T[]>(page)
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return rows
}

export async function listDictionaryTypes(token: string) {
  return listAll<DictionaryType>(
    token,
    'sys_dict_type',
    `?select=${TYPE_SELECT}&status=eq.1&node_type=eq.dictionary&order=sort.asc`
  )
}

export async function listDictionaryEntries(token: string) {
  return listAll<DictionaryEntry>(
    token,
    'sys_dictionary',
    `?select=${ENTRY_SELECT}&status=eq.1&order=sort.asc`
  )
}

export async function listDictionaries(token: string) {
  const [types, entries] = await Promise.all([
    listDictionaryTypes(token),
    listDictionaryEntries(token)
  ])
  return { types, entries }
}
