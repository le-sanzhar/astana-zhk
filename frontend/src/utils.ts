import type { Stage, ScoreColor, Profile } from './types'

export const STAGE_LABELS: Record<string, string> = {
  commissioned: 'Сдан',
  under_construction: 'Строится',
  foundation: 'Котлован',
  planned: 'Проект',
}

export const PROFILE_LABELS: Record<Profile, string> = {
  investor: '📈 Инвестор',
  family: '👨‍👩‍👧 Семья',
  student: '🎓 Студент',
}

export const SCORE_LABELS: Record<ScoreColor, string> = {
  green: 'Зелёный',
  yellow: 'Жёлтый',
  red: 'Красный',
}

export const INFRA_ICONS: Record<string, string> = {
  school: '🏫',
  kindergarten: '🧒',
  grocery: '🛒',
  hospital: '🏥',
  bus_stop: '🚌',
  metro: '🚇',
  park: '🌳',
}

export const INFRA_LABELS: Record<string, string> = {
  school: 'Школа',
  kindergarten: 'Детсад',
  grocery: 'Магазин',
  hospital: 'Больница',
  bus_stop: 'Остановка',
  metro: 'Метро',
  park: 'Парк',
}

export function formatPrice(val: number | null | undefined): string {
  if (!val) return '—'
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)} млн`
  if (val >= 1_000) return `${Math.round(val / 1_000)} тыс`
  return `${val}`
}

export function formatPricePerM2(val: number | null | undefined): string {
  if (!val) return '—'
  return `${Math.round(val).toLocaleString('ru')} ₸/м²`
}

export function formatDistance(meters: number | null | undefined): string {
  if (!meters) return '—'
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} км`
  return `${meters} м`
}

export function getScoreEmoji(score: ScoreColor | null | undefined): string {
  if (score === 'green') return '🟢'
  if (score === 'yellow') return '🟡'
  if (score === 'red') return '🔴'
  return '⚪'
}

export function getScoreColor(score: ScoreColor | null | undefined): string {
  return score || 'unknown'
}
