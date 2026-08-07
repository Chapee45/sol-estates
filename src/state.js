// Progression, permits and auction logic — pure functions, no React.
import { blockPriceFor, effectivePrice, rarityOf } from './economy.js'

// ---------- XP & levels ----------
export const cumXp = (lvl) => 125 * (lvl - 1) * (lvl - 1) + 125 * (lvl - 1)

export function levelFromXp(xp) {
  let l = 1
  while (cumXp(l + 1) <= xp) l++
  return l
}

// XP awards
export const xpForBuy = (cashPrice) => Math.round(cashPrice / 50)
export const xpForUpgrade = (cashCost) => Math.round(cashCost / 20)
export const xpForCollect = (cashAmt, blockAmt) => Math.round(cashAmt / 500 + blockAmt * 2)
export const XP_AUCTION_WIN = 200

// Property tiers unlock as you level
export const TIER_UNLOCK = {
  shop: 1, food: 1, supermarket: 2, entertainment: 3,
  bank: 4, hotel: 5, mall: 6, landmark: 8,
}

// ESTATE earning unlocks here — before this, properties pay CASH only.
// The grind gate: buy with ESTATE, build rent flow, unlock the license.
export const EARN_LEVEL = 4

// Named perk per level, shown on level-up + in the Empire panel
export const LEVEL_PERKS = {
  2:  'Supermarkets unlocked · +1 permit',
  3:  'Entertainment unlocked · Marketplace access · +1 permit',
  4:  '📜 EARNING LICENSE — properties now earn ESTATE · Banks unlocked · +1 permit',
  5:  'Hotels unlocked · Managers for hire · +1 permit',
  6:  'Shopping malls unlocked · +1 permit',
  7:  '+1 permit',
  8:  '🏛️ LANDMARKS unlocked · +1 permit',
  9:  '+1 permit',
  10: 'Tycoon status · +1 permit',
}

export const MARKETPLACE_LEVEL = 3
export const MANAGERS_LEVEL = 5

// ---------- Landlord ranks ----------
export const RANKS = [
  { lvl: 1,  name: 'Brokie' },
  { lvl: 2,  name: 'Couch Surfer' },
  { lvl: 3,  name: 'Renter' },
  { lvl: 4,  name: 'First-Time Buyer' },
  { lvl: 5,  name: 'Landlord' },
  { lvl: 6,  name: 'Slumlord' },
  { lvl: 7,  name: 'Property Shark' },
  { lvl: 8,  name: 'Block Boss' },
  { lvl: 10, name: 'Real Estate Mogul' },
  { lvl: 12, name: 'Tycoon' },
  { lvl: 15, name: 'BLOCKLORD' },
]

export function rankForLevel(level) {
  let r = RANKS[0].name
  for (const step of RANKS) {
    if (level >= step.lvl) r = step.name
  }
  return r
}

// ---------- Permits ----------
// You can only hold so many properties: 3 base + 1 per level + purchased extras.
export const permitSlots = (level, extraPermits) => 3 + level + (extraPermits || 0)
export const permitCost = (bought) => Math.round(20 * Math.pow(bought + 1, 1.5)) // $BLOCK, escalating

// ---------- Auction house ----------
// Client-side auction sim (deterministic per hour) — becomes real P2P with the backend.
const AUCTION_SLOTS = 4
const HOUR = 3600e3

function fnv(s) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h
}
const roll = (s) => (fnv(s) % 100000) / 100000

// Pick this hour's auctions from the candidates the player has discovered.
export function currentAuctions(now, candidates, ownedIds) {
  const hour = Math.floor(now / HOUR)
  const pool = candidates
    .filter(p => !ownedIds[p.id])
    .sort((a, b) => effectivePrice(b) - effectivePrice(a))
    .slice(0, 60)
  if (!pool.length) return []
  const out = []
  const used = new Set()
  for (let slot = 0; slot < Math.min(AUCTION_SLOTS, pool.length); slot++) {
    let idx = fnv(`auc:${hour}:${slot}`) % pool.length
    while (used.has(idx)) idx = (idx + 1) % pool.length
    used.add(idx)
    const poi = pool[idx]
    const value = blockPriceFor(effectivePrice(poi))
    out.push({
      key: `${hour}:${poi.id}`,
      poi: { ...poi, rarity: poi.rarity || rarityOf(poi.id, poi.tier) },
      endsAt: (hour + 1) * HOUR,
      startBid: Math.max(1, Math.round(value * 0.4)),
      // hidden ceiling the simulated rival bidders will not exceed
      ceiling: Math.max(2, Math.round(value * (0.7 + 0.4 * roll(`ceil:${hour}:${poi.id}`)))),
      value,
    })
  }
  return out
}

// Rival bid ramps stepwise from startBid toward ceiling over the hour
export function rivalBid(auction, now) {
  const start = auction.endsAt - HOUR
  const t = Math.min(0.95, Math.max(0, (now - start) / (HOUR * 0.9)))
  const raw = auction.startBid + (auction.ceiling - auction.startBid) * t
  return Math.min(auction.ceiling, Math.ceil(raw))
}

export const minRaise = (current) => Math.max(current + 1, Math.ceil(current * 1.05))

// Final rival bid at close — player wins if their escrowed bid beats it
export const finalRivalBid = (bid) => bid.ceiling

export const fmtCountdown = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
