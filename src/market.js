// The living property market. Every property's value drifts deterministically
// with time — same seed math for every player, so the whole world sees one
// economy (and the news wire can hint at where it's heading).
//
// Value = base price × market multiplier, clamped 0.10×–10× (10%–1000%).
// The multiplier is built from:
//   · macro     — slow global cycle (±6%, days)
//   · trend     — region × tier trends over hours: mostly calm, occasional
//                 booms (up to ~4×) and slumps (down to ~0.55×)
//   · character — rarity dynamics: commons sit below par and swing hard
//                 (volatile, decay-prone), legendaries sit above par and
//                 barely move (slow growers)
// Rent always accrues on the BASE price, so a sagging property still earns —
// roughly break-even if you never sell; selling below your entry is the loss.

// FNV-1a → [0, 1)
function prand(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return ((h >>> 0) % 100000) / 100000
}

// Smooth value-noise: seeded per bucket, cubic-eased between buckets
function smoothNoise(key, x, period) {
  const b = Math.floor(x / period)
  const f = x / period - b
  const a = prand(key + ':' + b)
  const c = prand(key + ':' + (b + 1))
  const u = f * f * (3 - 2 * f)
  return a + (c - a) * u
}

// ~country-scale market cells (2.5° ≈ 275km)
export const regionCell = (lat, lon) => `${Math.floor(lat / 2.5)},${Math.floor(lon / 2.5)}`

const RARITY_DYN = {
  common:    { level: 0.82, vol: 0.45 },
  rare:      { level: 0.98, vol: 0.28 },
  epic:      { level: 1.06, vol: 0.17 },
  legendary: { level: 1.15, vol: 0.10 },
}

// Region × tier trend over hours. >1 = hot market, <1 = slump.
export function trendBoost(cell, tier, hrs) {
  const key = 'tr:' + cell + ':' + tier
  let m = 0.85 + 0.4 * smoothNoise(key, hrs, 6)
  const b = smoothNoise(key + ':boom', hrs, 8)
  const s = smoothNoise(key + ':slump', hrs, 10)
  if (b > 0.82) m *= 1 + (b - 0.82) * 18
  if (s < 0.12) m *= 0.55 + s * 3
  return m
}

export function marketMultiplier(poi, t = Date.now()) {
  const hrs = t / 3.6e6
  const dyn = RARITY_DYN[poi.rarity || 'common'] || RARITY_DYN.common
  const macro = 0.94 + 0.12 * smoothNoise('macro', hrs, 24)
  const trend = trendBoost(regionCell(poi.lat, poi.lon), poi.tier, hrs)
  const character = Math.max(0.15, dyn.level + dyn.vol * (smoothNoise('id:' + poi.id, hrs, 3) * 2 - 1))
  return Math.min(10, Math.max(0.10, macro * trend * character))
}

// Live CASH value of a property right now
export function marketPrice(poi, t = Date.now()) {
  return Math.max(50, Math.round((poi.price * marketMultiplier(poi, t)) / 50) * 50)
}

// Selling back to the registry pays 85% of live value — buying and instantly
// selling always loses ~15%, so flipping requires a real move in the market.
export const SELL_TO_GAME = 0.85
export function sellQuote(poi, t = Date.now()) {
  return Math.max(10, Math.round((marketPrice(poi, t) * SELL_TO_GAME) / 10) * 10)
}

// Sampled value history for the panel chart
export function priceHistory(poi, t = Date.now(), days = 7, pts = 56) {
  const span = days * 24 * 3.6e6
  const out = []
  for (let i = 0; i < pts; i++) out.push(marketPrice(poi, t - span + (span * i) / (pts - 1)))
  return out
}

/* ------------------------------------------------------------------ */
/* Named world regions — the news wire and global marketplace speak in
   these; each maps onto the market cell its coordinates fall in.      */

export const REGIONS = [
  { name: 'the UK', lat: 51.5, lon: -0.12 },
  { name: 'New York', lat: 40.75, lon: -73.98 },
  { name: 'Paris', lat: 48.86, lon: 2.35 },
  { name: 'Tokyo', lat: 35.68, lon: 139.76 },
  { name: 'Dubai', lat: 25.2, lon: 55.27 },
  { name: 'Los Angeles', lat: 34.05, lon: -118.24 },
  { name: 'Sydney', lat: -33.87, lon: 151.21 },
  { name: 'Berlin', lat: 52.52, lon: 13.4 },
  { name: 'Rome', lat: 41.9, lon: 12.5 },
  { name: 'Singapore', lat: 1.35, lon: 103.82 },
  { name: 'Hong Kong', lat: 22.32, lon: 114.17 },
  { name: 'Miami', lat: 25.76, lon: -80.19 },
  { name: 'Toronto', lat: 43.65, lon: -79.38 },
  { name: 'Mexico City', lat: 19.43, lon: -99.13 },
  { name: 'São Paulo', lat: -23.55, lon: -46.63 },
  { name: 'Mumbai', lat: 19.08, lon: 72.88 },
  { name: 'Seoul', lat: 37.57, lon: 126.98 },
  { name: 'Amsterdam', lat: 52.37, lon: 4.9 },
  { name: 'Istanbul', lat: 41.01, lon: 28.98 },
  { name: 'Bangkok', lat: 13.76, lon: 100.5 },
  { name: 'Chicago', lat: 41.88, lon: -87.63 },
  { name: 'Madrid', lat: 40.42, lon: -3.7 },
]

const TIER_NOUN = {
  food: 'cafés and restaurants',
  shop: 'high-street retail',
  hotel: 'hotels',
  bank: 'financial property',
  entertainment: 'entertainment venues',
  supermarket: 'grocers',
  mall: 'shopping centres',
  landmark: 'landmark assets',
}
const NEWS_TIERS = Object.keys(TIER_NOUN)

const OUTLETS = ['The Property Wire', 'BlockStreet Journal', 'Global Estates Daily', 'The Land Ledger', 'Skyline Report', 'Brick & Board']

const T_UP = [
  (r, n) => `${n} in ${r} tipped for a surge — brokers report viewings doubling this week`,
  (r, n) => `Unusual money is flowing into ${r}: ${n} agents say they "can't keep up with demand"`,
  (r, n) => `Institutional buyers quietly circling ${n} across ${r}, sources whisper`,
  (r, n) => `Heatwave of interest: analysts see ${r} ${n} outperforming in the coming hours`,
]
const T_DOWN = [
  (r, n) => `Storm clouds over ${r}: ${n} owners rushing to exit before the correction bites`,
  (r, n) => `Lenders tighten on ${n} in ${r} — valuations expected to sag`,
  (r, n) => `${r} slump watch: ${n} footfall collapses, landlords getting nervous`,
  (r, n) => `Analysts flag ${n} in ${r} as "priced for perfection" — downside ahead?`,
]
const T_FLAT = [
  (r, n) => `Mixed signals out of ${r}: ${n} holding steady despite the chatter`,
  (r, n) => `Quiet week expected for ${n} in ${r}, say market watchers`,
  (r, n) => `${r} round-up: ${n} trade sideways as investors wait for direction`,
]

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const NEWS_BUCKET = 6e5 // one potential story every 10 minutes

function newsForBucket(nb) {
  const roll = prand('news:' + nb)
  if (roll < 0.35) return null // quiet slot → real cadence lands ~10–20 min
  const time = nb * NEWS_BUCKET
  const hrs = time / 3.6e6
  const reg = REGIONS[Math.floor(prand('nr:' + nb) * REGIONS.length)]
  const tier = NEWS_TIERS[Math.floor(prand('nt:' + nb) * NEWS_TIERS.length)]
  const cell = regionCell(reg.lat, reg.lon)
  const nowB = trendBoost(cell, tier, hrs)
  const futB = trendBoost(cell, tier, hrs + 5)
  const truth = futB > nowB * 1.05 ? 'up' : futB < nowB * 0.95 ? 'down' : 'flat'
  // a quarter of the wire is noise — journalists get it wrong
  const decoy = prand('nd:' + nb) < 0.25
  const shown = decoy && truth !== 'flat' ? (truth === 'up' ? 'down' : 'up') : truth
  const pool = shown === 'up' ? T_UP : shown === 'down' ? T_DOWN : T_FLAT
  const tpl = pool[Math.floor(prand('ntp:' + nb) * pool.length)]
  return {
    id: nb,
    time,
    outlet: OUTLETS[Math.floor(prand('no:' + nb) * OUTLETS.length)],
    region: reg.name,
    lat: reg.lat,
    lon: reg.lon,
    tier,
    headline: cap(tpl(reg.name, TIER_NOUN[tier])),
  }
}

// Latest news, newest first
export function newsFeed(t = Date.now(), count = 14) {
  const items = []
  let nb = Math.floor(t / NEWS_BUCKET)
  let guard = 400
  while (items.length < count && nb > 0 && guard-- > 0) {
    const it = newsForBucket(nb)
    if (it && it.time <= t) items.push(it)
    nb--
  }
  return items
}

/* ------------------------------------------------------------------ */
/* Worldwide marketplace — simulated global sellers until multiplayer.
   Listings rotate hourly; some sit below live value (the reason to buy
   from players instead of the registry), a few ask a premium.          */

export const WORLD_SPOTS = [
  { id: 'w/louvrearc', name: 'Café de l’Arcade', lat: 48.8612, lon: 2.3364, tier: 'food', rarity: 'rare' },
  { id: 'w/oxfordst', name: 'Oxford Street Flagship', lat: 51.5152, lon: -0.1419, tier: 'shop', rarity: 'epic' },
  { id: 'w/shibuya', name: 'Shibuya Crossing Media Hall', lat: 35.6595, lon: 139.7005, tier: 'entertainment', rarity: 'epic' },
  { id: 'w/burjcafe', name: 'Marina Skyline Hotel', lat: 25.0805, lon: 55.1403, tier: 'hotel', rarity: 'legendary' },
  { id: 'w/broadway', name: 'Broadway Revue Theatre', lat: 40.759, lon: -73.9845, tier: 'entertainment', rarity: 'legendary' },
  { id: 'w/venicebeach', name: 'Venice Boardwalk Surf Shop', lat: 33.985, lon: -118.4695, tier: 'shop', rarity: 'rare' },
  { id: 'w/operahouse', name: 'Harbourfront Grand Stage', lat: -33.8568, lon: 151.2153, tier: 'landmark', rarity: 'legendary' },
  { id: 'w/kudamm', name: 'Ku’damm Corner Bank', lat: 52.5035, lon: 13.3327, tier: 'bank', rarity: 'epic' },
  { id: 'w/trastevere', name: 'Trastevere Trattoria', lat: 41.8897, lon: 12.4694, tier: 'food', rarity: 'rare' },
  { id: 'w/orchardrd', name: 'Orchard Road Mega Mall', lat: 1.3006, lon: 103.8391, tier: 'mall', rarity: 'epic' },
  { id: 'w/mongkok', name: 'Mong Kok Night Market Hall', lat: 22.3193, lon: 114.1694, tier: 'shop', rarity: 'rare' },
  { id: 'w/oceandrive', name: 'Ocean Drive Art-Deco Hotel', lat: 25.7796, lon: -80.13, tier: 'hotel', rarity: 'epic' },
  { id: 'w/distillery', name: 'Distillery District Gallery', lat: 43.6503, lon: -79.3596, tier: 'entertainment', rarity: 'rare' },
  { id: 'w/roma', name: 'Roma Norte Mercado', lat: 19.4195, lon: -99.1626, tier: 'supermarket', rarity: 'rare' },
  { id: 'w/paulista', name: 'Avenida Paulista Tower Bank', lat: -23.5614, lon: -46.6559, tier: 'bank', rarity: 'epic' },
  { id: 'w/colaba', name: 'Colaba Causeway Emporium', lat: 18.9218, lon: 72.8316, tier: 'shop', rarity: 'rare' },
  { id: 'w/gangnam', name: 'Gangnam K-Star Arena', lat: 37.4979, lon: 127.0276, tier: 'entertainment', rarity: 'epic' },
  { id: 'w/jordaan', name: 'Jordaan Canal House Café', lat: 52.3739, lon: 4.8809, tier: 'food', rarity: 'rare' },
  { id: 'w/grandbazaar', name: 'Grand Bazaar Gold Hall', lat: 41.0106, lon: 28.968, tier: 'landmark', rarity: 'epic' },
  { id: 'w/sukhumvit', name: 'Sukhumvit Rooftop Hotel', lat: 13.738, lon: 100.5608, tier: 'hotel', rarity: 'rare' },
  { id: 'w/magmile', name: 'Magnificent Mile Boutique', lat: 41.8949, lon: -87.6243, tier: 'shop', rarity: 'epic' },
  { id: 'w/granvia', name: 'Gran Vía Cinema Palace', lat: 40.4203, lon: -3.7058, tier: 'entertainment', rarity: 'epic' },
]

const SELLER_NAMES = ['BrickzillaNYC', 'DubaiWhale', 'LandLadyLiz', 'TokyoTycoon', 'SirBricksalot', 'CryptoKeith', 'PixelLandlord', 'MortgageMolly', 'CouchInvestor', 'RentierRick', 'DoorKnockerDan', 'EstateElla']

// `basePriceOf` is injected (economy.effectivePrice) to avoid a circular import
export function worldListings(basePriceOf, t = Date.now(), count = 8) {
  const hb = Math.floor(t / 3.6e6)
  const picked = [...WORLD_SPOTS]
    .map((s, i) => ({ s, r: prand('wl:' + hb + ':' + i) }))
    .sort((a, b) => a.r - b.r)
    .slice(0, count)
  return picked.map(({ s }, i) => {
    const poi = { ...s, price: basePriceOf(s) }
    const live = marketPrice(poi, t)
    const factor = 0.72 + prand('wf:' + hb + ':' + s.id) * 0.43 // 0.72–1.15
    const ask = Math.max(50, Math.round((live * factor) / 50) * 50)
    return {
      ...poi,
      ask,
      live,
      deal: Math.round((1 - ask / live) * 100), // + = below market
      seller: SELLER_NAMES[Math.floor(prand('ws:' + hb + ':' + i) * SELLER_NAMES.length)],
    }
  })
}
