// Wide-zoom property supply: the basemap's tiles carry no shop data below
// ~z12, so zoomed-out views would only show already-explored chunks. This
// sampler fetches a small grid of z13 vector tiles spread across the visible
// viewport and harvests their POIs — so every area on screen contributes
// properties no matter how far out the camera is.
import { PbfReader } from 'pbf'
import { VectorTile } from '@mapbox/vector-tile'
import { buildPoi } from './pois.js'

const SAMPLE_Z = 14 // the tileset's maxzoom — the only level with the full poi layer
const COLS = 4
const ROWS = 3
const MAX_FETCHES_PER_PASS = 12

let tileTemplate = null
let templateLoading = null
const visited = new Set()

async function getTemplate() {
  if (tileTemplate) return tileTemplate
  templateLoading ??= fetch('https://tiles.openfreemap.org/planet')
    .then(r => r.json())
    .then(j => { tileTemplate = j.tiles?.[0] || null; return tileTemplate })
    .catch(() => null)
  return templateLoading
}

function lngLatToTile(lon, lat, z) {
  const n = 2 ** z
  const x = Math.floor(((lon + 180) / 360) * n)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)
  return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) }
}

async function harvestTile(template, x, y) {
  const url = template.replace('{z}', SAMPLE_Z).replace('{x}', x).replace('{y}', y)
  const res = await fetch(url)
  if (!res.ok) throw new Error('tile ' + res.status)
  const buf = new Uint8Array(await res.arrayBuffer())
  const vt = new VectorTile(new PbfReader(buf))
  const layer = vt.layers.poi
  if (!layer) return []
  const out = []
  for (let i = 0; i < layer.length; i++) {
    const f = layer.feature(i)
    const gj = f.toGeoJSON(x, y, SAMPLE_Z)
    if (gj.geometry.type !== 'Point') continue
    const [lon, lat] = gj.geometry.coordinates
    const poi = buildPoi(f.properties || {}, lon, lat, f.id)
    if (poi) out.push(poi)
  }
  return out
}

// Harvest a spread of tiles across the current viewport. Returns how many new
// tiles were sampled (0 = everything in view was already covered).
export async function sampleViewport(map, addPoi) {
  const template = await getTemplate()
  if (!template) return 0
  const b = map.getBounds()
  const south = b.getSouth(), north = b.getNorth()
  const west = b.getWest(), east = b.getEast()
  const jobs = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (jobs.length >= MAX_FETCHES_PER_PASS) break
      const lat = south + ((r + 0.5) / ROWS) * (north - south)
      const lon = west + ((c + 0.5) / COLS) * (east - west)
      if (Math.abs(lat) > 84) continue
      const { x, y } = lngLatToTile(lon, lat, SAMPLE_Z)
      const key = x + '/' + y
      if (visited.has(key)) continue
      visited.add(key)
      jobs.push(
        harvestTile(template, x, y)
          .then(pois => pois.forEach(addPoi))
          .catch(() => visited.delete(key))
      )
    }
  }
  if (!jobs.length) return 0
  await Promise.all(jobs)
  return jobs.length
}
