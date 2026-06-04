import axios from 'axios'
import type {
  ComplexListResponse,
  ComplexDetail,
  ScoringResponse,
  CompareResponse,
} from './types'

const api = axios.create({ baseURL: '/api' })

export async function fetchComplexes(params: {
  district?: string
  stage?: string
  profile?: string
  min_price?: number
  max_price?: number
  sort_by?: string
  limit?: number
  offset?: number
}): Promise<ComplexListResponse> {
  const { data } = await api.get<ComplexListResponse>('/complexes', { params })
  return data
}

export async function fetchComplex(id: string): Promise<ComplexDetail> {
  const { data } = await api.get<ComplexDetail>(`/complexes/${id}`)
  return data
}

export async function fetchScoring(id: string, refresh = false): Promise<ScoringResponse> {
  const { data } = await api.get<ScoringResponse>(`/scoring/${id}`, {
    params: { refresh },
  })
  return data
}

export async function fetchCompare(ids: string[]): Promise<CompareResponse> {
  const { data } = await api.get<CompareResponse>('/complexes/compare', {
    params: { ids: ids.join(',') },
  })
  return data
}
