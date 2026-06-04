import React, { useEffect, useState } from 'react'
import { fetchComplexes, fetchCompare } from '../api'
import type { ComplexListItem, ComplexDetail } from '../types'
import { formatPricePerM2, getScoreColor, STAGE_LABELS, PROFILE_LABELS } from '../utils'

export default function Compare() {
  const [list, setList] = useState<ComplexListItem[]>([])
  const [id1, setId1] = useState<string>('')
  const [id2, setId2] = useState<string>('')
  
  const [data1, setData1] = useState<ComplexDetail | null>(null)
  const [data2, setData2] = useState<ComplexDetail | null>(null)
  const [loading, setLoading] = useState(false)

  // Load all for dropdowns
  useEffect(() => {
    fetchComplexes({ limit: 100 }).then(res => setList(res.items))
  }, [])

  // Load compare data when both selected
  useEffect(() => {
    if (id1 && id2 && id1 !== id2) {
      setLoading(true)
      fetchCompare([id1, id2]).then(res => {
        if (res.complexes.length >= 2) {
          setData1(res.complexes.find(c => c.id === id1) || null)
          setData2(res.complexes.find(c => c.id === id2) || null)
        }
      }).finally(() => setLoading(false))
    } else {
      setData1(null)
      setData2(null)
    }
  }, [id1, id2])

  return (
    <div style={{ padding: '20px 16px' }}>
      <h1 style={{ marginBottom: 20 }}>Сравнение ЖК</h1>
      
      <div className="compare-grid" style={{ marginBottom: 24 }}>
        <div className="compare-col">
          <label className="compare-label">ЖК 1</label>
          <select className="select" value={id1} onChange={e => setId1(e.target.value)}>
            <option value="">Выберите ЖК...</option>
            {list.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="compare-col">
          <label className="compare-label">ЖК 2</label>
          <select className="select" value={id2} onChange={e => setId2(e.target.value)}>
            <option value="">Выберите ЖК...</option>
            {list.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {loading && <div className="spinner"></div>}

      {!loading && data1 && data2 && (
        <div className="card">
          <div className="compare-grid">
            {/* Headers */}
            <div className="compare-col" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              <h3 style={{ color: 'var(--accent-light)' }}>{data1.name}</h3>
              <span className="complex-meta">{data1.developer || '—'}</span>
            </div>
            <div className="compare-col" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              <h3 style={{ color: 'var(--accent-2)' }}>{data2.name}</h3>
              <span className="complex-meta">{data2.developer || '—'}</span>
            </div>

            {/* Price */}
            <div className="compare-col" style={{ paddingTop: 12 }}>
              <div className="compare-label">Цена м²</div>
              <div className="stat-value">
                {formatPricePerM2(data1.price_snapshots[data1.price_snapshots.length - 1]?.price_avg)}
              </div>
            </div>
            <div className="compare-col" style={{ paddingTop: 12 }}>
              <div className="compare-label">Цена м²</div>
              <div className="stat-value">
                {formatPricePerM2(data2.price_snapshots[data2.price_snapshots.length - 1]?.price_avg)}
              </div>
            </div>

            {/* Stage */}
            <div className="compare-col" style={{ paddingTop: 12 }}>
              <div className="compare-label">Стадия</div>
              <div>{data1.construction_stage ? STAGE_LABELS[data1.construction_stage] : '—'}</div>
            </div>
            <div className="compare-col" style={{ paddingTop: 12 }}>
              <div className="compare-label">Стадия</div>
              <div>{data2.construction_stage ? STAGE_LABELS[data2.construction_stage] : '—'}</div>
            </div>

            {/* Scores */}
            <div className="compare-col" style={{ paddingTop: 12, gridColumn: '1 / span 2' }}>
              <div className="compare-label" style={{ marginBottom: 12 }}>Скоринг (Инвестор / Семья / Студент)</div>
            </div>
            
            <div className="compare-col">
              <div style={{ display: 'flex', gap: 4, flexDirection: 'column' }}>
                {data1.scores.map(s => (
                  <div key={s.profile} className={`score-pill ${getScoreColor(s.score)}`} style={{ justifyContent: 'center' }}>
                    {PROFILE_LABELS[s.profile]} {s.score_value}/10
                  </div>
                ))}
              </div>
            </div>
            
            <div className="compare-col">
              <div style={{ display: 'flex', gap: 4, flexDirection: 'column' }}>
                {data2.scores.map(s => (
                  <div key={s.profile} className={`score-pill ${getScoreColor(s.score)}`} style={{ justifyContent: 'center' }}>
                    {PROFILE_LABELS[s.profile]} {s.score_value}/10
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {id1 && id2 && id1 === id2 && (
        <div className="empty" style={{ padding: '20px' }}>
          <p>Выберите разные ЖК для сравнения</p>
        </div>
      )}
    </div>
  )
}
