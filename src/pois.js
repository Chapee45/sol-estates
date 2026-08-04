// Real-world POIs read straight from the map's own vector tiles
// (OpenMapTiles schema) — no external API, no rate limits, whole planet.

const SUBCLASS_TIER = {
  attraction: 'landmark', museum: 'landmark', gallery: 'landmark', zoo: 'landmark',
  theme_park: 'landmark', aquarium: 'landmark', viewpoint: 'landmark', artwork: 'landmark',
  monument: 'landmark', castle: 'landmark', memorial: 'landmark', fort: 'landmark', stadium: 'landmark',
  hotel: 'hotel', hostel: 'hotel', motel: 'hotel', guest_house: 'hotel',
  mall: 'mall', department_store: 'mall',
  bank: 'bank', casino: 'bank',
  cinema: 'entertainment', theatre: 'entertainment', nightclub: 'entertainment',
  supermarket: 'supermarket', convenience: 'supermarket', greengrocer: 'supermarket',
  cafe: 'food', restaurant: 'food', bar: 'food', pub: 'food', fast_food: 'food',
  food_court: 'food', ice_cream: 'food',
}

const CLASS_TIER = {
  attraction: 'landmark', museum: 'landmark', art_gallery: 'landmark', zoo: 'landmark',
  monument: 'landmark', castle: 'landmark', stadium: 'landmark',
  lodging: 'hotel',
  bank: 'bank',
  cinema: 'entertainment', theatre: 'entertainment', music: 'entertainment',
  grocery: 'supermarket',
  restaurant: 'food', fast_food: 'food', cafe: 'food', bar: 'food', beer: 'food', ice_cream: 'food',
  shop: 'shop', clothing_store: 'shop', alcohol_shop: 'shop', drugstore: 'shop',
  car: 'shop', laundry: 'shop', hardware: 'shop', jewelry: 'shop',
}

// World supply cap: the planet is split into ~1km grid cells and each cell
// deterministically spawns its top PER_CELL properties — landmarks first, ties
// broken by a per-id hash. Every populated town gets properties, the world
// total lands around 1,000,000 (doubled from 500k on 2026-08-04), and raising
// PER_CELL again "releases" new properties worldwide as the game grows.
export const PER_CELL = 12
const CELL = 0.01 // ≈1.1km of latitude

export const TIER_WEIGHT = {
  landmark: 8, mall: 7, hotel: 6, bank: 5,
  entertainment: 4, supermarket: 3, food: 2, shop: 1,
}

function fnv(s) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h
}

const hashId = (s) => fnv(s).toString(36)

// Deterministic 0..1 from id — same verdict for every player, every session.
const spawnRoll = (id) => (fnv('spawn:' + id) % 100000) / 100000

const cellOf = (lat, lon) => `${Math.floor(lat / CELL)}:${Math.floor(lon / CELL)}`

// What exists in the game world: every owned property, plus up to PER_CELL
// spawns per ~1km cell. Existence is STICKY — once a property spawns it never
// despawns, no matter what stronger candidates arrive later — so the map
// stays stable while zooming and exploring. Major properties (high tiers,
// epic/legendary) always spawn even into full cells; they're rare.
const stickySpawned = new Set()
const cellCounts = new Map()

export const isSpawnedId = (id) => stickySpawned.has(id)

export function selectSpawned(candidates, ownedIds) {
  const picked = []
  for (const p of candidates) {
    if (ownedIds[p.id] || stickySpawned.has(p.id)) { picked.push(p); continue }
    const major = (TIER_WEIGHT[p.tier] || 1) >= 6 || p.rarity === 'epic' || p.rarity === 'legendary'
    const count = cellCounts.get(p.cell) || 0
    if (count < PER_CELL || major) {
      stickySpawned.add(p.id)
      cellCounts.set(p.cell, count + 1)
      picked.push(p)
    }
  }
  return picked
}

// Shared constructor: turn raw tile-feature properties into a game POI.
export function buildPoi(props, lon, lat, rawId) {
  const name = props['name:en'] || props['name:latin'] || props.name
  if (!name) return null
  const tier = SUBCLASS_TIER[props.subclass] || CLASS_TIER[props.class]
  if (!tier) return null
  const id = String('t/' + (rawId ?? hashId(`${name}|${lon.toFixed(5)}|${lat.toFixed(5)}`)))
  return { id, name, tier, lat, lon, roll: spawnRoll(id), cell: cellOf(lat, lon) }
}

export function collectPOIs(map) {
  let feats = []
  try {
    feats = map.querySourceFeatures('openmaptiles', { sourceLayer: 'poi' })
  } catch {
    return []
  }
  const out = []
  for (const f of feats) {
    if (f.geometry?.type !== 'Point') continue
    const [lon, lat] = f.geometry.coordinates
    const poi = buildPoi(f.properties || {}, lon, lat, f.id)
    if (poi) out.push(poi)
  }
  return out
}
