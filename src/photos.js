// Property photos — every property always gets one, best source first:
//   1. Wikipedia lead image  — actual photo of the place, name-matched nearby
//   2. Wikimedia Commons     — nearest geotagged real photo within ~250m
//   3. Google Street View    — the street the property is on (skipped
//      automatically if the key/quota is unavailable — costs stay capped)
//   4. Satellite crop        — last-resort backstop so no card is ever empty
// Never generated/AI imagery.
import { GOOGLE_MAPS_KEY } from './config.js'

const cache = new Map()

async function streetViewPhoto(poi) {
  if (!GOOGLE_MAPS_KEY) return null
  const loc = `${poi.lat},${poi.lon}`
  // metadata endpoint is free — verify imagery exists before using the shot
  const meta = await fetch(
    `https://maps.googleapis.com/maps/api/streetview/metadata?location=${loc}&key=${GOOGLE_MAPS_KEY}`
  ).then(r => r.json()).catch(() => null)
  if (meta?.status !== 'OK') return null
  return `https://maps.googleapis.com/maps/api/streetview?size=640x400&location=${loc}&fov=75&key=${GOOGLE_MAPS_KEY}`
}

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

async function wikiPhoto(poi) {
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
    '&generator=geosearch&ggscoord=' + poi.lat + '%7C' + poi.lon +
    '&ggsradius=250&ggslimit=10&prop=pageimages&piprop=thumbnail&pithumbsize=640'
  const res = await fetch(url)
  const json = await res.json()
  const pages = Object.values(json.query?.pages || {}).filter(p => p.thumbnail)
  if (!pages.length) return null
  const key = norm(poi.name).slice(0, 12)
  const match = key && pages.find(p => norm(p.title).includes(key) || key.includes(norm(p.title).slice(0, 12)))
  if (match) return match.thumbnail.source
  // only landmark-class properties may wear the nearest notable photo
  if (poi.tier === 'landmark' || poi.tier === 'hotel' || poi.tier === 'mall') {
    return pages[0].thumbnail.source
  }
  return null
}

async function commonsPhoto(poi) {
  const url =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
    '&generator=geosearch&ggscoord=' + poi.lat + '%7C' + poi.lon +
    '&ggsradius=250&ggslimit=10&ggsnamespace=6' +
    '&prop=imageinfo&iiprop=url&iiurlwidth=640'
  const res = await fetch(url)
  const json = await res.json()
  const pages = Object.values(json.query?.pages || {})
  for (const p of pages) {
    const info = p.imageinfo?.[0]
    const u = info?.thumburl || info?.url
    if (u && /\.(jpe?g|png|webp)$/i.test(u)) return u
  }
  return null
}

// Satellite crop of the property itself — deterministic, always available.
// Only ever shown when no real photo and no street view exists.
function aerialPhoto(poi) {
  const z = 18
  const latRad = (poi.lat * Math.PI) / 180
  const n = 2 ** z
  const x = Math.floor(((poi.lon + 180) / 360) * n)
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`
}

// Never resolves empty: real photo of the place > street view > satellite backstop.
export function fetchPhoto(poi) {
  if (cache.has(poi.id)) return cache.get(poi.id)
  const promise = (async () => {
    try {
      const wiki = await wikiPhoto(poi)
      if (wiki) return wiki
    } catch { /* next source */ }
    try {
      const commons = await commonsPhoto(poi)
      if (commons) return commons
    } catch { /* next source */ }
    try {
      const sv = await streetViewPhoto(poi)
      if (sv) return sv
    } catch { /* next source */ }
    return aerialPhoto(poi)
  })()
  cache.set(poi.id, promise)
  return promise
}
