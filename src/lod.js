// Hierarchical level-of-detail index.
//
// Every property gets ONE stable "reveal level": the coarsest quadtree cell it
// dominates. A cell's champion is, by construction, also the champion of its
// own sub-cell — so visibility is monotonic: once a marker appears while
// zooming in, it stays until you zoom back out past its reveal level. No
// jumping, no swapping.
import { TIER_WEIGHT } from './pois.js'
import { RARITIES } from './economy.js'

const L_MIN = 3
const L_MAX = 20
const L_CLAMP = 18 // co-located losers still show by deep street zoom

const best = new Map() // 'level/x/y' -> { id, score }

function tileKey(lon, lat, l) {
  const n = 2 ** l
  const x = Math.floor(((lon + 180) / 360) * n)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)
  return l + '/' + x + '/' + y
}

// Total order: tier, then rarity, then price, then id (stable tiebreak)
export function scoreFor(p) {
  const w = TIER_WEIGHT[p.tier] || 1
  const r = RARITIES.indexOf(p.rarity || 'common')
  return (w * 5 + r) * 1e9 + (p.price || 0)
}

// Register a candidate in the pyramid. A dethroned champion gets its cached
// reveal level cleared so it recomputes (it can only move deeper).
export function indexCandidate(p, store) {
  const score = scoreFor(p)
  p._score = score
  p._M = null
  for (let l = L_MIN; l <= L_MAX; l++) {
    const k = tileKey(p.lon, p.lat, l)
    const cur = best.get(k)
    if (!cur) { best.set(k, { id: p.id, score }); continue }
    if (cur.id === p.id) continue
    if (score > cur.score || (score === cur.score && p.id < cur.id)) {
      const old = store.get(cur.id)
      if (old) old._M = null
      best.set(k, { id: p.id, score })
    }
  }
}

export function minLevelOf(p) {
  if (p._M != null) return p._M
  for (let l = L_MIN; l <= L_MAX; l++) {
    if (best.get(tileKey(p.lon, p.lat, l))?.id === p.id) {
      p._M = l
      return l
    }
  }
  p._M = L_MAX + 1
  return p._M
}

export const displayLevel = (p) => Math.min(minLevelOf(p), L_CLAMP)
