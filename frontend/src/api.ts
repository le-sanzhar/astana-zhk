import type {
  ComplexListResponse,
  ComplexDetail,
  CompareResponse,
} from './types'

const BASE = ((import.meta as any).env?.VITE_API_BASE ?? '').replace(/\/$/, '')

async function get(path: string, params: Record<string, any> = {}) {
  const q = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)])
  ).toString()
  const url = `${BASE}${path}${q ? '?' + q : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

// Map scraper API item → ComplexListItem
function toListItem(raw: any) {
  return {
    id: raw.id,
    name: raw.name,
    developer: raw.developer ?? null,
    district: raw.district ?? null,
    construction_stage: raw.construction_stage ?? null,
    completion_date: raw.move_in ?? null,
    price_avg: raw.price_avg ?? null,
    price_min: raw.price_avg ?? null,
    listings_count: null,
    investor_score: raw.investor_score ?? null,
    family_score: raw.family_score ?? null,
    student_score: raw.student_score ?? null,
    image: raw.image ?? null,
  }
}

// Map scraper API item → ComplexDetail
function toDetail(raw: any): ComplexDetail {
  return {
    id: raw.id,
    name: raw.name,
    developer: raw.developer ?? null,
    address: raw.address ?? null,
    district: raw.district ?? null,
    latitude: raw.coordinates?.lat ?? null,
    longitude: raw.coordinates?.lng ?? null,
    construction_stage: raw.construction_stage ?? null,
    completion_date: raw.move_in ?? null,
    total_floors: null,
    total_apartments: null,
    krisha_url: raw.krisha_url ?? null,
    image: raw.image ?? null,
    gallery: raw.gallery ?? [],
    price_avg: raw.price_avg ?? null,
    price_snapshots: (raw.price_snapshots ?? []).map((s: any) => ({
      id: s.recorded_at,
      price_min: s.price_avg,
      price_max: s.price_avg,
      price_avg: s.price_avg,
      listings_count: null,
      recorded_at: s.recorded_at,
    })),
    infrastructure: raw.infrastructure ?? [],
    scores: raw.scores ?? [],
    ai_summary: raw.ai_summary ?? null,
  }
}

export async function fetchComplexes(params: {
  district?: string
  stage?: string
  profile?: string
  min_price?: number
  max_price?: number
  limit?: number
  offset?: number
} = {}): Promise<ComplexListResponse> {
  const data = await get('/api/v1/complexes', {
    district: params.district,
    stage: params.stage,
    min_price: params.min_price,
    max_price: params.max_price,
    limit: params.limit ?? 200,
    offset: params.offset ?? 0,
  })
  return { total: data.total, items: data.items.map(toListItem) }
}

export async function fetchComplex(id: string): Promise<ComplexDetail> {
  const data = await get(`/api/v1/complexes/${id}`)
  return toDetail(data)
}

export async function fetchCompare(ids: string[]): Promise<CompareResponse> {
  const results = await Promise.all(ids.map(id => fetchComplex(id)))
  return { complexes: results }
}
