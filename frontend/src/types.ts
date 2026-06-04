export type Stage = 'commissioned' | 'under_construction' | 'foundation' | 'planned'
export type ScoreColor = 'green' | 'yellow' | 'red'
export type Profile = 'investor' | 'family' | 'student'

export interface PriceSnapshot {
  id: string
  price_min: number | null
  price_max: number | null
  price_avg: number | null
  listings_count: number | null
  recorded_at: string
}

export interface InfraItem {
  type: string
  name: string | null
  distance_meters: number | null
}

export interface ScoreItem {
  profile: Profile
  score: ScoreColor
  score_value: number | null
  explanation: string | null
}

export interface ComplexListItem {
  id: string
  name: string
  developer: string | null
  district: string | null
  construction_stage: Stage | null
  completion_date: string | null
  price_avg: number | null
  price_min: number | null
  listings_count: number | null
  investor_score: ScoreColor | null
  family_score: ScoreColor | null
  student_score: ScoreColor | null
  image: string | null
}

export interface ComplexDetail {
  id: string
  name: string
  developer: string | null
  address: string | null
  district: string | null
  latitude: number | null
  longitude: number | null
  construction_stage: Stage | null
  completion_date: string | null
  total_floors: number | null
  total_apartments: number | null
  krisha_url: string | null
  image: string | null
  gallery: string[]
  price_avg: number | null
  price_snapshots: PriceSnapshot[]
  infrastructure: InfraItem[]
  scores: ScoreItem[]
  ai_summary: string | null
}

export interface ComplexListResponse {
  total: number
  items: ComplexListItem[]
}

export interface CompareResponse {
  complexes: ComplexDetail[]
}
