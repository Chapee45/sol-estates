// Canvas-drawn map badges: tier glyph inside a muted circle, ring = rarity
// (green ring = owned). Registered as MapLibre images for the symbol layer.
import { TIER_META, RARITIES, RARITY_META } from './economy.js'

const TIER_BG = {
  landmark: '#ffb300', mall: '#ff4f9a', hotel: '#8a5cff', bank: '#e0a800',
  entertainment: '#ff5a5f', supermarket: '#22c7d6', food: '#ff8a3c', shop: '#3e7bff',
}

function drawBadge(emoji, bg, ring, glow) {
  const s = 76
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d')
  if (glow) {
    ctx.shadowColor = ring
    ctx.shadowBlur = 8
  }
  // navy cartoon outline, bright fill, rarity ring — logo-style chunky badge
  ctx.beginPath()
  ctx.arc(s / 2, s / 2, 28, 0, Math.PI * 2)
  ctx.fillStyle = '#2b2350'
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.beginPath()
  ctx.arc(s / 2, s / 2, 25, 0, Math.PI * 2)
  ctx.fillStyle = bg
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = ring
  ctx.stroke()
  ctx.font = '25px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, s / 2, s / 2 + 2)
  return ctx.getImageData(0, 0, s, s)
}

export function registerMapIcons(map) {
  for (const [tier, meta] of Object.entries(TIER_META)) {
    for (const rar of RARITIES) {
      const name = `poi-${tier}-${rar}`
      if (!map.hasImage(name)) {
        map.addImage(name, drawBadge(meta.emoji, TIER_BG[tier], RARITY_META[rar].color, rar === 'legendary' || rar === 'epic'))
      }
    }
    const ownedName = `poi-${tier}-owned`
    if (!map.hasImage(ownedName)) {
      map.addImage(ownedName, drawBadge(meta.emoji, '#35b95c', '#ffffff', true))
    }
  }
}
