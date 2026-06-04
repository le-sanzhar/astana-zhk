import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchComplexes } from '../api'
import type { ComplexListItem, Profile } from '../types'
import { formatPricePerM2, STAGE_LABELS, PROFILE_LABELS, getScoreEmoji, getScoreColor } from '../utils'

export default function Home() {
  const [complexes, setComplexes] = useState<ComplexListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile>('investor')
  
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const data = await fetchComplexes({ profile })
        setComplexes(data.items)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [profile])

  return (
    <div>
      <div className="filter-bar">
        {(Object.keys(PROFILE_LABELS) as Profile[]).map(p => (
          <button 
            key={p}
            className={`filter-chip ${profile === p ? 'active' : ''}`}
            onClick={() => setProfile(p)}
          >
            {PROFILE_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="complex-list">
        {loading ? (
          Array(5).fill(0).map((_, i) => (
            <div key={i} className="complex-item skeleton" style={{ height: 100, margin: 16 }}></div>
          ))
        ) : complexes.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🏙️</div>
            <p>Нет ЖК, соответствующих фильтрам</p>
          </div>
        ) : (
          complexes.map(c => {
            const scoreKey = `${profile}_score` as keyof ComplexListItem
            const score = c[scoreKey] as any
            
            return (
              <Link to={`/complex/${c.id}`} key={c.id} className="complex-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 className="complex-name">{c.name}</h3>
                    <p className="complex-meta">
                      {c.district ? `${c.district} район` : 'Район не указан'}
                    </p>
                  </div>
                  <div className={`score-pill ${getScoreColor(score)}`}>
                    {getScoreEmoji(score)}
                  </div>
                </div>
                
                <div className="complex-scores-row" style={{ marginTop: 12 }}>
                  <span className="tag">{formatPricePerM2(c.price_avg)}</span>
                  {c.construction_stage && (
                    <span className={`stage-badge ${c.construction_stage}`}>
                      {STAGE_LABELS[c.construction_stage]}
                    </span>
                  )}
                  {c.listings_count && (
                    <span className="tag" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                      {c.listings_count} объявлений
                    </span>
                  )}
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
