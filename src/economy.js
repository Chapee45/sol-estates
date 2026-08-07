// Dual-currency economy (Luca's design, 2026-08-04):
//  - CASH  💵 — soft in-game currency. Properties earn it fast. Buys properties.
//  - $BLOCK 🪙 — the crypto token (Solana). Properties earn it SLOWLY.
//    Buys properties too, and is the ONLY currency for upgrades.
// All prices are deterministic from the OSM id — every player sees the same numbers.

export const START_CASH = 25000
export const START_BLOCK = 120

// Pricing peg used for property price tags: 1 $BLOCK = 100 CASH
export const CASH_PER_BLOCK = 100

// Global faucet throttle for the real token: $BLOCK accrues at this fraction
// of the CASH pace (relative to its own price). THE knob for treasury safety.
export const BLOCK_YIELD_FACTOR = 0.25

export const TIER_META = {
  landmark:      { label: 'Landmark',       emoji: '🏛️', base: 60000 },
  mall:          { label: 'Shopping Mall',  emoji: '🏬', base: 30000 },
  hotel:         { label: 'Hotel',          emoji: '🏨', base: 25000 },
  bank:          { label: 'Bank & Finance', emoji: '🏦', base: 18000 },
  entertainment: { label: 'Entertainment',  emoji: '🎭', base: 12000 },
  supermarket:   { label: 'Supermarket',    emoji: '🛒', base: 9000 },
  food:          { label: 'Food & Drink',   emoji: '☕', base: 4500 },
  shop:          { label: 'Shop',           emoji: '🛍️', base: 2500 },
}

// Four themed upgrades per tier, bought in order — $BLOCK only.
export const UPGRADES = {
  landmark:      ['Guided Tours', 'Gift Shop', 'Night Illumination', 'World Icon Status'],
  mall:          ['Food Court', 'Cinema Wing', 'Flagship Stores', 'Grand Expansion'],
  hotel:         ['Spa & Pool', 'Fine Dining', 'Penthouse Suites', '5-Star Rating'],
  bank:          ['Vault Upgrade', 'Private Banking', 'Trading Floor', 'Crypto Desk'],
  entertainment: ['Sound System', 'VIP Lounge', 'Headline Acts', 'World Tour Venue'],
  supermarket:   ['Self Checkout', 'Deli Counter', '24/7 Opening', 'Regional Chain'],
  food:          ['New Menu', 'Full Renovation', 'Delivery Service', 'Celebrity Chef'],
  shop:          ['Window Display', 'Loyalty Program', 'Online Store', 'Franchise'],
}

export const UPGRADE_COST_MULT = [0.3, 0.5, 0.8, 1.2]
export const UPGRADE_RENT_MULT = [1.25, 1.4, 1.6, 2.0]
export const MAX_UPS = 4

// Deterministic 0..1 pseudo-random from a string id (FNV-1a)
function prand(id) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return (h % 1000) / 1000
}

// ---------- Rarity ----------
// Currency display: both currencies wear the $ prefix; $ESTATE additionally
// spells out the word after the amount ("$1,000 ESTATE") — no icon.
export const CASH_SYM = '$'
export const BLOCK_SYM = '◈' // legacy glyph — display code should prefer fmtE/fmtEB
export const EST_WORD = 'ESTATE'

export const RARITIES = ['common', 'rare', 'epic', 'legendary']
export const RARITY_META = {
  common:    { label: 'Common',    color: '#e8e6f2', mult: 1 },
  rare:      { label: 'Rare',      color: '#3e9bff', mult: 1.6 },
  epic:      { label: 'Epic',      color: '#a45cff', mult: 2.8 },
  legendary: { label: 'Legendary', color: '#ffc93c', mult: 5 },
}

// Deterministic rarity — premium tiers skew rarer-than-common more often
export function rarityOf(id, tier) {
  const r = prand('rar:' + id)
  const t = tier === 'landmark' ? [0.40, 0.75, 0.95]
    : (tier === 'mall' || tier === 'hotel' || tier === 'bank') ? [0.60, 0.87, 0.975]
    : [0.72, 0.93, 0.99]
  return r < t[0] ? 'common' : r < t[1] ? 'rare' : r < t[2] ? 'epic' : 'legendary'
}

// CASH price of a property (before rarity)
export function priceFor(poi) {
  const meta = TIER_META[poi.tier] || TIER_META.shop
  return Math.round((meta.base * (0.75 + 0.7 * prand(poi.id))) / 50) * 50
}

// Final CASH price including the rarity multiplier
export function effectivePrice(poi) {
  const rar = poi.rarity || rarityOf(poi.id, poi.tier)
  return Math.round((priceFor(poi) * RARITY_META[rar].mult) / 50) * 50
}

// $BLOCK price of the same property
export const blockPriceFor = (cashPrice) => Math.ceil(cashPrice / CASH_PER_BLOCK)

function upMult(ups) {
  let m = 1
  for (let i = 0; i < ups; i++) m *= UPGRADE_RENT_MULT[i]
  return m
}

// CASH rent: 0.8%/hr of price, multiplied by upgrades
export function cashPerHour(price, ups = 0) {
  return price * 0.008 * upMult(ups)
}

// $BLOCK rent: same curve against its own price, throttled by BLOCK_YIELD_FACTOR
export function blockPerHour(price, ups = 0) {
  return blockPriceFor(price) * 0.008 * BLOCK_YIELD_FACTOR * upMult(ups)
}

// Upgrades and renovations are CASH — that's what the rent you collect is for.
// (Utility remap 2026-08-06: ESTATE acquires property; CASH runs the business.)
export function upgradeCost(price, upsIndex) {
  return Math.max(50, Math.round((price * UPGRADE_COST_MULT[upsIndex]) / 50) * 50)
}

// Unmanaged properties stop accruing after 8h — appoint a manager to go
// infinite. Three characters, three price/performance tiers.
export const UNMANAGED_CAP_HOURS = 8

export const MANAGERS = {
  ray:  { name: 'Ray the Rookie',  costMult: 0.35, bonus: 1.05, blurb: 'Fresh license, big energy. Keeps the lights on.' },
  vera: { name: 'Vera the Closer', costMult: 0.6,  bonus: 1.10, blurb: 'Runs a tight book. Rent lands early.' },
  don:  { name: 'Don Marble',      costMult: 1.1,  bonus: 1.20, blurb: 'Old money. Tenants don’t argue.' },
}

export const managerBonus = (prop) => (prop?.manager ? (MANAGERS[prop.manager]?.bonus ?? 1.1) : 1)
// Staff are paid in CASH
export const managerCostFor = (price, key) =>
  Math.max(300, Math.round((price * (MANAGERS[key]?.costMult ?? 0.6)) / 50) * 50)

export function accrualHours(prop, now) {
  const h = (now - prop.lastCollect) / 3600000
  return prop.manager ? h : Math.min(h, UNMANAGED_CAP_HOURS)
}

export function pendingCash(prop, now) {
  return cashPerHour(prop.price, prop.ups) * managerBonus(prop) * accrualHours(prop, now)
}

export function pendingBlock(prop, now) {
  return blockPerHour(prop.price, prop.ups) * managerBonus(prop) * accrualHours(prop, now)
}

export const fmt = (n) => Math.floor(n).toLocaleString('en-US')
// $ESTATE amounts are small — show 2 decimals below 100
export const fmtB = (n) => n >= 100
  ? Math.floor(n).toLocaleString('en-US')
  : (Math.floor(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// $ESTATE spelled out: "$1,000 ESTATE" (whole) / "$12.50 ESTATE" (decimal)
export const fmtE = (n) => `$${fmt(n)} ${EST_WORD}`
export const fmtEB = (n) => `$${fmtB(n)} ${EST_WORD}`

// The token cost of a property at a given CASH value
export const estatePriceFor = (cashValue) => blockPriceFor(cashValue)

// Purchase tokenomics: 10% of every property purchase burns, 90% lands in the
// master wallet that funds ESTATE payouts. Simulated client-side until the
// on-chain backend takes over.
export const BURN_RATE = 0.10
export const splitPurchase = (estateCost) => {
  const burned = Math.max(1, Math.round(estateCost * BURN_RATE))
  return { burned, toTreasury: estateCost - burned }
}
