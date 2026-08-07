import { TIER_META, RARITY_META, RARITIES, fmt, fmtE, estatePriceFor } from './economy.js'
import { sfx } from './sound.js'

const SORTS = [
  { key: 'distance', label: 'Nearest' },
  { key: 'priceAsc', label: 'Price ↑' },
  { key: 'priceDesc', label: 'Price ↓' },
  { key: 'rarity', label: 'Rarity' },
]

const fmtDist = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`)

// Listings around the current map view, sortable — a broker's sheet.
export default function NearbyPanel({ open, items, sort, setSort, onSelect, onClose }) {
  if (!open) return null
  return (
    <div className="portfolio nearby-panel">
      <div className="modal-head">
        <h3>Nearby listings</h3>
        <button className="close-flat" onClick={() => { sfx.close(); onClose() }}>✕</button>
      </div>
      <div className="sort-row">
        {SORTS.map(s => (
          <button
            key={s.key}
            className={'sort-chip' + (sort === s.key ? ' on' : '')}
            onClick={() => { sfx.click(); setSort(s.key) }}
          >{s.label}</button>
        ))}
      </div>
      {items.length === 0 && <p className="muted">No unowned listings in view — pan or zoom the map.</p>}
      {items.map(p => {
        const meta = TIER_META[p.tier] || TIER_META.shop
        const rar = RARITY_META[p.rarity || 'common']
        return (
          <button key={p.id} className="prop-row" onClick={() => { sfx.select(); onSelect(p) }}>
            <span className="nearby-main">
              <span className="nearby-emoji">{meta.emoji}</span>
              <span className="nearby-text">
                <b>{p.name}</b>
                <small><span style={{ color: rar.color }}>{rar.label}</span> · {meta.label} · {fmtDist(p.dist)}</small>
              </span>
            </span>
            <span className="nearby-price">{fmtE(estatePriceFor(p.price))}</span>
          </button>
        )
      })}
    </div>
  )
}

export function sortNearby(items, sort) {
  const rarityRank = (r) => RARITIES.indexOf(r || 'common')
  switch (sort) {
    case 'priceAsc': return items.sort((a, b) => a.price - b.price)
    case 'priceDesc': return items.sort((a, b) => b.price - a.price)
    case 'rarity': return items.sort((a, b) => (rarityRank(b.rarity) - rarityRank(a.rarity)) || b.price - a.price)
    default: return items.sort((a, b) => a.dist - b.dist)
  }
}
