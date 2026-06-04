import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { fetchComplex } from '../api'
import type { ComplexDetail, ScoreItem } from '../types'
import { 
  formatPricePerM2, STAGE_LABELS, PROFILE_LABELS, SCORE_LABELS, 
  INFRA_ICONS, INFRA_LABELS, formatDistance 
} from '../utils'

function ScoreCard({ score }: { score: ScoreItem }) {
  return (
    <div className={`score-card ${score.score}`}>
      <div className="score-label">
        <span className="icon">{PROFILE_LABELS[score.profile]}</span>
        <span>{SCORE_LABELS[score.score]}</span>
        {score.score_value && <span style={{ marginLeft: 'auto', opacity: 0.7 }}>{score.score_value}/10</span>}
      </div>
      <div className="score-explanation">
        {score.explanation}
      </div>
    </div>
  )
}

export default function Complex() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<ComplexDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      if (!id) return
      try {
        const detail = await fetchComplex(id)
        setData(detail)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [id])

  if (loading) return <div className="spinner"></div>
  if (!data) return <div className="empty">ЖК не найден</div>

  const latestPrice = data.price_snapshots.length > 0 
    ? data.price_snapshots[data.price_snapshots.length - 1] 
    : null

  const chartData = data.price_snapshots.map(s => ({
    date: new Date(s.recorded_at).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' }),
    price: s.price_avg,
    listings: s.listings_count
  }))

  return (
    <div style={{ paddingBottom: 24 }}>
      <div className="hero-gradient">
        <Link to="/" className="back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Назад
        </Link>
        <h1>{data.name}</h1>
        <p className="complex-meta" style={{ marginTop: 8 }}>
          {data.developer && `${data.developer} • `}
          {data.address || data.district}
        </p>
        
        <div style={{ marginTop: 16 }}>
          <div className="price-label">Средняя цена</div>
          <div className="price-main">{formatPricePerM2(latestPrice?.price_avg)}</div>
        </div>
      </div>

      <div className="section-title">Скоринг</div>
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.scores.map(s => (
          <ScoreCard key={s.profile} score={s} />
        ))}
      </div>

      {data.ai_summary && (
        <div style={{ padding: '20px 16px 0' }}>
          <div className="ai-block">
            <div className="ai-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12A10 10 0 0 1 12 2z"></path>
                <path d="M12 16v-4"></path>
                <path d="M12 8h.01"></path>
              </svg>
              AI Аналитика
            </div>
            <div className="ai-text">{data.ai_summary}</div>
          </div>
        </div>
      )}

      {chartData.length > 1 && (
        <>
          <div className="section-title">Динамика цен</div>
          <div className="card" style={{ margin: '0 16px' }}>
            <div className="chart-wrap" style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis domain={['auto', 'auto']} stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => `${Math.round(v/1000)}k`} width={40} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    itemStyle={{ color: 'var(--accent-light)' }}
                    formatter={((val: number) => [`${val.toLocaleString()} ₸`, 'Цена']) as any}
                  />
                  <Line type="monotone" dataKey="price" stroke="var(--accent)" strokeWidth={3} dot={{ r: 4, fill: 'var(--bg-card)' }} activeDot={{ r: 6, fill: 'var(--accent-2)' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      <div className="section-title">Характеристики</div>
      <div style={{ padding: '0 16px' }}>
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-value">{data.construction_stage ? STAGE_LABELS[data.construction_stage] : '—'}</div>
            <div className="stat-label">Стадия</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{latestPrice?.listings_count || '—'}</div>
            <div className="stat-label">Объявлений</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{data.total_floors || '—'}</div>
            <div className="stat-label">Этажность</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{data.total_apartments || '—'}</div>
            <div className="stat-label">Квартир</div>
          </div>
        </div>
      </div>

      {data.infrastructure.length > 0 && (
        <>
          <div className="section-title">Инфраструктура (до 1 км)</div>
          <div style={{ padding: '0 16px' }}>
            <div className="card infra-list">
              {data.infrastructure
                .sort((a, b) => (a.distance_meters || 0) - (b.distance_meters || 0))
                .slice(0, 8)
                .map((infra, idx) => (
                  <div key={idx} className="infra-item">
                    <div className="infra-name">
                      <span style={{ marginRight: 6 }}>{INFRA_ICONS[infra.type] || '📍'}</span>
                      {INFRA_LABELS[infra.type] || infra.type}
                    </div>
                    <div className="infra-dist">{formatDistance(infra.distance_meters)}</div>
                  </div>
              ))}
            </div>
          </div>
        </>
      )}

      {data.krisha_url && (
        <div style={{ padding: '24px 16px' }}>
          <a href={data.krisha_url} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ width: '100%' }}>
            Открыть на Krisha.kz
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
        </div>
      )}
    </div>
  )
}
