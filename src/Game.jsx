import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { collectPOIs, selectSpawned, isSpawnedId } from './pois.js'
import { sampleViewport } from './tileSampler.js'
import { indexCandidate, displayLevel } from './lod.js'
import { fetchPhoto } from './photos.js'
import { shortAddr } from './wallet.js'
import { registerMapIcons } from './mapIcons.js'
import Tutorial, { TUT_STEPS } from './Tutorial.jsx'
import Marketplace from './Marketplace.jsx'
import SettingsModal from './SettingsModal.jsx'
import Contract from './Contract.jsx'
import StaffModal from './StaffModal.jsx'
import NearbyPanel, { sortNearby } from './NearbyPanel.jsx'
import { CHAR_ART, CHAR_NAMES, CHAR_LINES } from './characters.js'
import { sfx, setSfx, setMusic, initMusic, kickMusic } from './sound.js'
import {
  TIER_META, UPGRADES, UPGRADE_RENT_MULT, MAX_UPS, RARITY_META, rarityOf,
  START_CASH, START_BLOCK,
  effectivePrice, blockPriceFor, cashPerHour, blockPerHour, upgradeCost,
  pendingCash, pendingBlock, MANAGERS, managerBonus, managerCostFor, UNMANAGED_CAP_HOURS,
  accrualHours, fmt, fmtB, CASH_SYM, BLOCK_SYM,
} from './economy.js'
import {
  levelFromXp, cumXp, TIER_UNLOCK, LEVEL_PERKS, MARKETPLACE_LEVEL, MANAGERS_LEVEL,
  permitSlots, permitCost, xpForBuy, xpForUpgrade, xpForCollect, XP_AUCTION_WIN,
  currentAuctions, rivalBid, finalRivalBid, rankForLevel,
} from './state.js'
import themeMusic from './assets/theme.mp3'
import logoArt from './assets/logo-sol.png'

const SAVE_KEY = 'blocklord-save-v1'
const MIN_POI_ZOOM = 11
const MAX_STORE = 40000
const EMPTY_FC = { type: 'FeatureCollection', features: [] }

function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY)) || {}
    s.cash = s.cash ?? s.balance ?? START_CASH
    s.block = s.block ?? START_BLOCK
    s.xp = s.xp ?? 0
    s.extraPermits = s.extraPermits ?? 0
    s.bids = s.bids ?? {}
    s.signature = s.signature ?? null
    s.settings = s.settings ?? { music: true, sfx: true }
    for (const p of Object.values(s.owned || {})) {
      if (p.ups == null) p.ups = Math.max(0, (p.level || 1) - 1)
      p.rarity ??= rarityOf(p.id, p.tier)
      if (p.manager === true) p.manager = 'vera'
      p.manager ??= false
    }
    return s
  } catch {
    return { cash: START_CASH, block: START_BLOCK, xp: 0, extraPermits: 0, bids: {}, settings: { music: true, sfx: true } }
  }
}

let toastSeq = 0

export default function Game({ player, onLogout, onTutorialDone }) {
  const save = useRef(loadSave()).current
  const mapDiv = useRef(null)
  const mapRef = useRef(null)
  const poisRef = useRef(new Map())
  const ownedRef = useRef(save.owned || {})

  const [cash, setCash] = useState(save.cash)
  const [block, setBlock] = useState(save.block)
  const [xp, setXp] = useState(save.xp)
  const [extraPermits, setExtraPermits] = useState(save.extraPermits)
  const [bids, setBids] = useState(save.bids)
  const [settings, setSettings] = useState(save.settings)
  const [signature, setSignature] = useState(save.signature)
  const [contract, setContract] = useState(null)
  const [owned, setOwned] = useState(ownedRef.current)
  const [selectedId, setSelectedId] = useState(null)
  const [photo, setPhoto] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [zoomedOut, setZoomedOut] = useState(false)
  const [showPortfolio, setShowPortfolio] = useState(false)
  const [showMarket, setShowMarket] = useState(false)
  const [marketTab, setMarketTab] = useState('auctions')
  const [showSettings, setShowSettings] = useState(false)
  const [search, setSearch] = useState('')
  const [tutStep, setTutStep] = useState(player.tutorialDone ? null : 0)
  const [starter, setStarter] = useState(null)
  const [mapReady, setMapReady] = useState(false)
  const [satellite, setSatellite] = useState(false)
  const [toasts, setToasts] = useState([])
  const [levelUpTo, setLevelUpTo] = useState(null)
  const [collectBurst, setCollectBurst] = useState(null)
  const [staffFor, setStaffFor] = useState(null)
  const [popup, setPopup] = useState(null)
  const [showNearby, setShowNearby] = useState(false)
  const [nearbySort, setNearbySort] = useState('distance')
  const capWarnedRef = useRef(false)
  const popupSeq = useRef(0)
  const [, setAuctionTick] = useState(0)

  const level = levelFromXp(xp)
  const prevLevelRef = useRef(level)
  const slots = permitSlots(level, extraPermits)
  const ownedList = Object.values(owned)

  function toast(msg, icon = '✨') {
    const id = ++toastSeq
    setToasts(t => [...t.slice(-3), { id, msg, icon }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200)
  }

  function gainXp(amount) {
    if (amount <= 0) return
    setXp(x => x + amount)
  }

  // Character popups — one at a time, auto-dismissed
  function showPopup(char, text) {
    const id = ++popupSeq.current
    setPopup({ id, char, text })
    setTimeout(() => setPopup(p => (p?.id === id ? null : p)), 6500)
  }

  // Level-up detection → modal + sfx
  useEffect(() => {
    if (level > prevLevelRef.current) {
      setLevelUpTo(level)
      sfx.levelup()
    }
    prevLevelRef.current = level
  }, [level])

  // Audio prefs + music boot
  useEffect(() => {
    setSfx(settings.sfx)
    setMusic(settings.music)
  }, [settings])
  useEffect(() => {
    initMusic(themeMusic)
    const kick = () => kickMusic()
    document.addEventListener('pointerdown', kick)
    return () => document.removeEventListener('pointerdown', kick)
  }, [])

  useEffect(() => {
    for (const o of Object.values(ownedRef.current)) {
      poisRef.current.set(o.id, o)
      indexCandidate(o, poisRef.current)
    }
  }, [])

  useEffect(() => {
    ownedRef.current = owned
    refreshSource()
    localStorage.setItem(SAVE_KEY, JSON.stringify({ cash, block, xp, extraPermits, bids, settings, signature, owned }))
  }, [owned, cash, block, xp, extraPermits, bids, settings, signature])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Managers auto-collect their properties every 20s (and on load = offline earnings)
  useEffect(() => {
    function autoCollect() {
      const t = Date.now()
      let c = 0, b = 0
      const managed = Object.values(ownedRef.current).filter(p => p.manager)
      for (const p of managed) {
        c += pendingCash(p, t)
        b += pendingBlock(p, t)
      }
      if (c >= 1 || b >= 0.01) {
        setCash(v => v + c)
        setBlock(v => v + b)
        setOwned(prev => Object.fromEntries(Object.entries(prev).map(([k, v]) =>
          [k, v.manager ? { ...v, lastCollect: t } : v])))
        return { c, b }
      }
      return null
    }
    const first = autoCollect()
    if (first && (first.c > 50 || first.b > 0.5)) {
      toast(`Your managers collected $${fmt(first.c)} · ◈${fmtB(first.b)} while you were away`, '✦')
    }
    const iv = setInterval(autoCollect, 20000)
    return () => clearInterval(iv)
  }, [])

  // Auction resolution — settle expired bids
  useEffect(() => {
    const iv = setInterval(() => {
      setAuctionTick(t => t + 1)
      const t = Date.now()
      setBids(prev => {
        let changed = false
        const next = { ...prev }
        for (const [key, bid] of Object.entries(prev)) {
          if (bid.endsAt > t || bid.settled) continue
          changed = true
          const rivalFinal = finalRivalBid(bid)
          if (bid.amount >= rivalFinal && !ownedRef.current[bid.poi.id]) {
            setOwned(o => ({
              ...o,
              [bid.poi.id]: {
                id: bid.poi.id, name: bid.poi.name, tier: bid.poi.tier, rarity: bid.poi.rarity,
                lat: bid.poi.lat, lon: bid.poi.lon, price: bid.poi.price,
                ups: 0, manager: false, lastCollect: t,
              },
            }))
            gainXp(XP_AUCTION_WIN)
            toast(`Auction won — ${bid.poi.name} for ◈${fmt(bid.amount)}`, '✦')
            sfx.win()
            showPopup('mike', CHAR_LINES.auctionWin)
          } else {
            setBlock(b => b + bid.amount) // refund escrow
            toast(`Outbid on ${bid.poi.name} — ◈${fmt(bid.amount)} refunded`, '·')
            showPopup('mike', CHAR_LINES.outbid)
          }
          delete next[key]
        }
        return changed ? next : prev
      })
    }, 3000)
    return () => clearInterval(iv)
  }, [])

  // Brass pin drops onto the selected property
  const selPinRef = useRef(null)
  useEffect(() => {
    if (selPinRef.current) { selPinRef.current.remove(); selPinRef.current = null }
    const map = mapRef.current
    if (!selectedId || !map) return
    const p = poisRef.current.get(selectedId)
    if (!p) return
    const el = document.createElement('div')
    el.className = 'sel-pin'
    el.innerHTML = '<div class="sel-pin-shadow"></div><div class="sel-pin-body"><div class="sel-pin-head"></div><div class="sel-pin-tip"></div></div>'
    selPinRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([p.lon, p.lat])
      .addTo(map)
    sfx.plop()
    return () => { if (selPinRef.current) { selPinRef.current.remove(); selPinRef.current = null } }
  }, [selectedId])

  useEffect(() => {
    setPhoto(null)
    if (!selectedId) return
    const poi = poisRef.current.get(selectedId)
    if (!poi) return
    let alive = true
    fetchPhoto(poi).then(url => { if (alive) setPhoto(url) })
    return () => { alive = false }
  }, [selectedId])

  function refreshSource() {
    const map = mapRef.current
    if (!map || !map.style) return
    let src
    try { src = map.getSource('pois') } catch { return }
    if (!src) return
    const z = map.getZoom()
    // Monotonic LOD: each property has one fixed reveal level from the
    // quadtree index. The offset is zoom-aware: at neighborhood zoom the FULL
    // inventory shows; mid zooms cut deep; far-out views stay curated.
    // Zooming in only ever ADDS markers; zooming out only removes them.
    const lodOffset = z >= 13.5 ? 4.5 : z >= 11.5 ? 2.5 : 1.75
    const b = map.getBounds()
    const west = b.getWest(), east = b.getEast()
    const south = b.getSouth(), north = b.getNorth()
    const padLon = (east - west) * 0.3
    const padLat = (north - south) * 0.3
    const features = []
    for (const p of selectSpawned(poisRef.current.values(), ownedRef.current)) {
      const isOwned = !!ownedRef.current[p.id]
      if (!isOwned) {
        if (displayLevel(p) > z + lodOffset) continue
        if (p.lon < west - padLon || p.lon > east + padLon ||
            p.lat < south - padLat || p.lat > north + padLat) continue
      }
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
        properties: {
          id: p.id, name: p.name, tier: p.tier,
          rarity: p.rarity || 'common',
          owned: isOwned,
          priority: isOwned ? 0 : displayLevel(p),
        },
      })
    }
    src.setData({ type: 'FeatureCollection', features })
  }

  function addCandidate(p) {
    if (poisRef.current.has(p.id)) return false
    p.rarity = rarityOf(p.id, p.tier)
    p.price = effectivePrice(p)
    poisRef.current.set(p.id, p)
    indexCandidate(p, poisRef.current)
    return true
  }

  function loadVisible() {
    const map = mapRef.current
    if (!map) return
    const z = map.getZoom()
    setZoomedOut(false)
    // Wide zoom: harvest a spread of distant tiles so every visible area has
    // properties, not just previously explored chunks.
    if (z < 12.5) {
      sampleViewport(map, addCandidate)
        .then(n => { if (n > 0) refreshSource() })
        .catch(() => {})
    }
    if (z < MIN_POI_ZOOM) return
    let added = 0
    for (const p of collectPOIs(map)) {
      if (addCandidate(p)) added++
    }
    if (poisRef.current.size > MAX_STORE) {
      for (const id of poisRef.current.keys()) {
        if (poisRef.current.size <= MAX_STORE) break
        if (!ownedRef.current[id] && !isSpawnedId(id)) poisRef.current.delete(id)
      }
    }
    if (added) refreshSource()
  }

  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapDiv.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: player.home ? [player.home.lon, player.home.lat] : [-73.9857, 40.758],
      zoom: player.home ? 15.5 : 16,
      minZoom: 1,
    })
    mapRef.current = map
    window.__map = map // dev debugging handle
    map.addControl(new maplibregl.NavigationControl(), 'bottom-right')
    map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: true }), 'bottom-right')

    // Init once the style is usable. The 'load' event can fail to fire after
    // remounts/resizes, so a polling fallback keeps retrying until setup
    // completes without throwing.
    let setupDone = false
    const setup = () => {
      if (setupDone) return
      try {
        if (!map.getStyle()?.layers?.length) return
      } catch { return }
      try {
        doSetup()
        setupDone = true
      } catch (err) {
        console.warn('Map setup retrying:', err.message)
      }
    }
    const doSetup = () => {
      try { map.setProjection({ type: 'globe' }) } catch (err) { console.warn('Globe unavailable:', err) }
      try {
        for (const layer of map.getStyle().layers) {
          if (layer.type !== 'symbol') continue
          const tf = map.getLayoutProperty(layer.id, 'text-field')
          if (tf && JSON.stringify(tf).includes('name')) {
            map.setLayoutProperty(layer.id, 'text-field',
              ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']])
          }
        }
      } catch (err) { console.warn('English label override failed:', err) }

      registerMapIcons(map)
      // Satellite imagery (Esri World Imagery), hidden until toggled.
      // Every add is guarded so a failed attempt can retry cleanly.
      if (!map.getSource('satellite')) map.addSource('satellite', {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Imagery © Esri',
      })
      if (!map.getLayer('satellite-layer')) map.addLayer({
        id: 'satellite-layer',
        type: 'raster',
        source: 'satellite',
        layout: { visibility: 'none' },
        paint: { 'raster-fade-duration': 150 },
      })
      if (!map.getSource('pois')) map.addSource('pois', { type: 'geojson', data: EMPTY_FC })
      if (!map.getLayer('poi-hover')) map.addLayer({
        id: 'poi-hover',
        type: 'circle',
        source: 'pois',
        filter: ['==', ['get', 'id'], ''],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 16, 17, 30],
          'circle-color': 'rgba(201, 169, 106, 0.16)',
          'circle-stroke-color': 'rgba(201, 169, 106, 0.65)',
          'circle-stroke-width': 1.5,
        },
      })
      if (!map.getLayer('poi-icons')) map.addLayer({
        id: 'poi-icons',
        type: 'symbol',
        source: 'pois',
        layout: {
          'icon-image': ['case', ['get', 'owned'],
            ['concat', 'poi-', ['get', 'tier'], '-owned'],
            ['concat', 'poi-', ['get', 'tier'], '-', ['get', 'rarity']]],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.26, 12, 0.38, 17, 0.74],
          'icon-allow-overlap': true,
          'symbol-sort-key': ['get', 'priority'],
        },
      })
      if (!map.getLayer('poi-labels')) map.addLayer({
        id: 'poi-labels',
        type: 'symbol',
        source: 'pois',
        minzoom: 15.5,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
          'text-offset': [0, 1.6],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: { 'text-color': '#ffffff', 'text-halo-color': '#0b0f19', 'text-halo-width': 1.5 },
      })
      refreshSource()
      loadVisible()
      // Recover from a stalled init: re-sync canvas size and kick the renderer
      map.resize()
      map.jumpTo({ center: map.getCenter(), zoom: map.getZoom() })
      setMapReady(true)
    }
    // Layer-scoped listeners are safe to attach before the layer exists
    map.on('click', 'poi-icons', (e) => { sfx.open(); setSelectedId(e.features[0].properties.id) })
    let hoveredBadge = null
    map.on('mousemove', 'poi-icons', (e) => {
      map.getCanvas().style.cursor = 'pointer'
      const id = e.features?.[0]?.properties?.id
      if (id) {
        if (id !== hoveredBadge) { hoveredBadge = id; sfx.hover() }
        try { map.setFilter('poi-hover', ['==', ['get', 'id'], id]) } catch { /* not ready */ }
      }
    })
    map.on('mouseleave', 'poi-icons', () => {
      hoveredBadge = null
      map.getCanvas().style.cursor = ''
      try { map.setFilter('poi-hover', ['==', ['get', 'id'], '']) } catch { /* not ready */ }
    })
    map.on('load', setup)
    const setupPoll = setInterval(() => {
      if (setupDone) { clearInterval(setupPoll); return }
      setup()
    }, 700)
    map.on('idle', loadVisible)
    map.on('moveend', loadVisible)
    // Live marker updates WHILE zooming/panning — no waiting for the gesture
    // to settle. Cheap thanks to cached reveal levels; throttled to ~8fps.
    let lastLive = 0
    const liveRefresh = () => {
      const t = performance.now()
      if (t - lastLive < 120) return
      lastLive = t
      refreshSource()
    }
    map.on('zoom', liveRefresh)
    map.on('move', liveRefresh)
    map.on('zoomend', refreshSource)
    map.on('moveend', refreshSource)
    // The preview/host pane resizes often and maplibre's internal tracker can
    // miss it after a stalled init — force-sync canvas size ourselves.
    const ro = new ResizeObserver(() => { try { map.resize() } catch { /* removed */ } })
    ro.observe(mapDiv.current)
    return () => {
      ro.disconnect()
      clearInterval(setupPoll)
      mapRef.current = null
      map.remove()
    }
  }, [])

  const totalPendingCash = ownedList.reduce((s, p) => s + pendingCash(p, now), 0)
  const totalPendingBlock = ownedList.reduce((s, p) => s + pendingBlock(p, now), 0)
  const totalCashRate = ownedList.reduce((s, p) => s + cashPerHour(p.price, p.ups) * managerBonus(p), 0)
  const totalBlockRate = ownedList.reduce((s, p) => s + blockPerHour(p.price, p.ups) * managerBonus(p), 0)
  const canCollect = totalPendingCash >= 1 || totalPendingBlock >= 0.01

  const auctions = currentAuctions(now, [...poisRef.current.values()], owned)

  // ---- Guided first-purchase tutorial step ----
  const tutDef = tutStep != null ? TUT_STEPS[tutStep] : null

  // Find the cheapest affordable, unowned, tier-unlocked property nearby
  useEffect(() => {
    if (tutDef?.mode !== 'buy') return
    let cancelled = false
    const find = () => {
      if (cancelled) return
      const cands = [...poisRef.current.values()]
        .filter(p => !ownedRef.current[p.id]
          && p.price <= cash
          && levelFromXp(xp) >= (TIER_UNLOCK[p.tier] || 1))
        .sort((a, b) => a.price - b.price)
      if (cands.length) {
        const pick = cands[0]
        setStarter(pick)
        mapRef.current?.flyTo({ center: [pick.lon, pick.lat], zoom: 17.2 })
        setSelectedId(pick.id)
      }
    }
    find()
    const iv = setInterval(find, 1500)
    return () => { cancelled = true; clearInterval(iv) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutStep])

  // Advance the tutorial the moment they buy their starter
  const ownedCount = ownedList.length
  const prevOwnedCount = useRef(ownedCount)
  useEffect(() => {
    if (ownedCount > prevOwnedCount.current && tutDef?.mode === 'buy') {
      setTutStep(s => s + 1)
    }
    prevOwnedCount.current = ownedCount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownedCount])

  // Opens the purchase agreement; ownership transfers on signature.
  function buy(poi, currency) {
    if (owned[poi.id]) return
    const unlockAt = TIER_UNLOCK[poi.tier] || 1
    if (level < unlockAt) { sfx.error(); toast(`${TIER_META[poi.tier].label}s unlock at Level ${unlockAt}`, '·'); return }
    if (ownedList.length >= slots) { sfx.error(); toast('No permits available — level up or acquire one in your Portfolio', '·'); return }
    if (currency === 'cash' && cash < poi.price) return
    if (currency === 'block' && block < blockPriceFor(poi.price)) return
    sfx.open()
    setContract({ poi, currency })
  }

  function completeBuy(sigDataUrl) {
    if (!contract) return
    const { poi, currency } = contract
    setContract(null)
    if (sigDataUrl && sigDataUrl !== signature) setSignature(sigDataUrl)
    if (owned[poi.id]) return
    if (currency === 'cash') {
      if (cash < poi.price) return
      setCash(c => c - poi.price)
    } else {
      const bPrice = blockPriceFor(poi.price)
      if (block < bPrice) return
      setBlock(b => b - bPrice)
    }
    sfx.buy()
    gainXp(xpForBuy(poi.price))
    toast(`Deed recorded: ${poi.name} · +${fmt(xpForBuy(poi.price))} XP`, '✦')
    setOwned(prev => ({
      ...prev,
      [poi.id]: {
        id: poi.id, name: poi.name, tier: poi.tier, rarity: poi.rarity, lat: poi.lat, lon: poi.lon,
        price: poi.price, ups: 0, manager: false, lastCollect: Date.now(),
      },
    }))
  }

  function upgrade(id) {
    const p = owned[id]
    if (!p || p.ups >= MAX_UPS) return
    const cost = upgradeCost(p.price, p.ups)
    if (block < cost) return
    sfx.upgrade()
    setBlock(b => b - cost)
    gainXp(xpForUpgrade(cost))
    setOwned(prev => ({ ...prev, [id]: { ...prev[id], ups: prev[id].ups + 1 } }))
  }

  function openStaffing(id) {
    if (level < MANAGERS_LEVEL) { sfx.error(); toast(`Managers unlock at Level ${MANAGERS_LEVEL}`, '·'); return }
    sfx.open()
    setStaffFor(id)
  }

  function hireManager(id, key) {
    const p = owned[id]
    if (!p || p.manager) return
    const cost = managerCostFor(p.price, key)
    if (block < cost) { sfx.error(); return }
    sfx.hire()
    setBlock(b => b - cost)
    setStaffFor(null)
    setOwned(prev => ({ ...prev, [id]: { ...prev[id], manager: key } }))
    toast(`${MANAGERS[key].name} appointed at ${p.name}`, '✦')
    showPopup(key, CHAR_LINES.hire[key])
  }

  function collectAll() {
    if (!canCollect) return
    sfx.collect()
    const t = Date.now()
    const c = totalPendingCash, b = totalPendingBlock
    setCash(v => v + c)
    setBlock(v => v + b)
    gainXp(xpForCollect(c, b))
    setCollectBurst({ c, b, id: t })
    setTimeout(() => setCollectBurst(null), 1400)
    setOwned(prev => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, lastCollect: t }])))
  }

  function buyPermit() {
    const cost = permitCost(extraPermits)
    if (block < cost) { sfx.error(); return }
    sfx.buy()
    setBlock(b => b - cost)
    setExtraPermits(n => n + 1)
    toast(`Permit acquired — you may now hold ${slots + 1} properties`, '✦')
  }

  function placeBid(auction, amount) {
    const existing = bids[auction.key]
    const delta = amount - (existing?.amount || 0)
    if (block < delta) { sfx.error(); return }
    sfx.bid()
    setBlock(b => b - delta) // escrow the difference
    setBids(prev => ({
      ...prev,
      [auction.key]: {
        poi: auction.poi, amount, endsAt: auction.endsAt,
        ceiling: auction.ceiling, startBid: auction.startBid, settled: false,
      },
    }))
    toast(`Bid placed — ◈${fmt(amount)} on ${auction.poi.name}`, '·')
  }

  function instantSell(p, offer) {
    sfx.sell()
    setBlock(b => b + offer)
    setOwned(prev => {
      const next = { ...prev }
      delete next[p.id]
      return next
    })
    toast(`Sold ${p.name} to the registry for ◈${fmt(offer)}`, '✦')
  }

  async function onSearch(e) {
    e.preventDefault()
    const q = search.trim()
    if (!q) return
    sfx.click()
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (json[0]) mapRef.current?.flyTo({ center: [+json[0].lon, +json[0].lat], zoom: 15.5 })
    } catch (err) { console.warn('Geocode failed:', err) }
  }

  function flyTo(p) {
    mapRef.current?.flyTo({ center: [p.lon, p.lat], zoom: 17 })
    setSelectedId(p.id)
    setShowPortfolio(false)
    setShowMarket(false)
  }

  function finishTutorial() { setTutStep(null); onTutorialDone() }

  function toggleSatellite() {
    sfx.click()
    const map = mapRef.current
    if (!map) return
    const next = !satellite
    try {
      map.setLayoutProperty('satellite-layer', 'visibility', next ? 'visible' : 'none')
      setSatellite(next)
    } catch { /* layer not ready yet */ }
  }

  function resetProgress() {
    if (!window.confirm('Reset ALL progress? This cannot be undone.')) return
    localStorage.removeItem(SAVE_KEY)
    window.location.reload()
  }

  const basePoi = selectedId ? poisRef.current.get(selectedId) : null
  const sel = basePoi ? { ...basePoi, ...(owned[selectedId] || {}) } : null
  const selMeta = sel ? (TIER_META[sel.tier] || TIER_META.shop) : null
  const selRar = sel ? RARITY_META[sel.rarity || 'common'] : null
  const selOwned = sel && !!owned[sel.id]
  const selUpgrades = sel ? (UPGRADES[sel.tier] || UPGRADES.shop) : []
  const selBlockPrice = sel ? blockPriceFor(sel.price) : 0
  const selUnlockAt = sel ? (TIER_UNLOCK[sel.tier] || 1) : 1
  const selLocked = sel && level < selUnlockAt
  const selCapped = sel && selOwned && !sel.manager && accrualHours(sel, now) >= UNMANAGED_CAP_HOURS

  // First time the player sees a capped property, Ray pitches staffing
  useEffect(() => {
    if (selCapped && !capWarnedRef.current) {
      capWarnedRef.current = true
      showPopup('ray', CHAR_LINES.capWarning)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selCapped])

  // Broker sheet: unowned listings near the current view
  const nearbyItems = showNearby ? (() => {
    const c = mapRef.current?.getCenter()
    if (!c) return []
    const items = []
    for (const p of selectSpawned(poisRef.current.values(), ownedRef.current)) {
      if (ownedRef.current[p.id]) continue
      const dx = (p.lon - c.lng) * 111320 * Math.cos((c.lat * Math.PI) / 180)
      const dy = (p.lat - c.lat) * 110574
      const dist = Math.hypot(dx, dy)
      if (dist < 4000) items.push({ ...p, dist })
    }
    return sortNearby(items, nearbySort).slice(0, 40)
  })() : []

  const xpInto = xp - cumXp(level)
  const xpNeed = cumXp(level + 1) - cumXp(level)

  return (
    <div className="app">
      <div ref={mapDiv} className="map" />

      <header className="hud">
        <div className="hud-row">
          <div className="brand">SOL ESTATES</div>
          <form className="search" onSubmit={onSearch}>
            <input
              placeholder="Search any city or address"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onSearch(e) }}
            />
            <button type="submit" className="go">GO</button>
          </form>
          <button className={'icon-btn' + (satellite ? ' on' : '')} title="Satellite view" onClick={toggleSatellite}>SAT</button>
          <button className="icon-btn" title="Settings" onClick={() => { sfx.open(); setShowSettings(true) }}>⋯</button>
        </div>
        <div className="hud-row hud-row2">
          <button className="chip level-chip" onClick={() => { sfx.open(); setShowPortfolio(s => !s) }}>
            <span className="lvl-badge">Lv {level}</span>
            <span className="xp-track"><span className="xp-fill" style={{ width: `${Math.min(100, (xpInto / xpNeed) * 100)}%` }} /></span>
          </button>
          <span className="money-wrap" data-tut="money">
            <span className="chip money-chip"><i className="cur">{CASH_SYM}</i>{fmt(cash)}</span>
            <span className="chip money-chip block-chip"><i className="cur brass">{BLOCK_SYM}</i>{fmtB(block)}</span>
          </span>
          <button className="chip collect-chip" data-tut="collect" disabled={!canCollect} onClick={collectAll}>
            Collect {CASH_SYM}{fmt(totalPendingCash)} · {BLOCK_SYM}{fmtB(totalPendingBlock)}
          </button>
          <button className="chip" data-tut="permits" onClick={() => { sfx.open(); setShowPortfolio(s => !s) }}>
            {ownedList.length}/{slots} held
          </button>
          <button className="chip" data-tut="market" onClick={() => { sfx.open(); setShowMarket(true) }}>Market</button>
          <button className="chip" onClick={() => { sfx.open(); setShowNearby(v => !v) }}>Nearby</button>
          <button className="chip player-chip" title="Account" onClick={() => { sfx.open(); setShowSettings(true) }}>
            {player.pfp?.type === 'image'
              ? <img className="pfp" src={player.pfp.value} alt="" />
              : <span className="pfp-emoji">{player.pfp?.value || (player.mode === 'phantom' ? '👻' : '🛠')}</span>}
            <span className="player-name">{player.name || (player.mode === 'phantom' ? shortAddr(player.address) : 'Dev')}</span>
          </button>
        </div>
        {collectBurst && (
          <div className="collect-burst" key={collectBurst.id}>
            +{CASH_SYM}{fmt(collectBurst.c)} · +{BLOCK_SYM}{fmtB(collectBurst.b)}
          </div>
        )}
      </header>

      {zoomedOut && <div className="hint">Zoom in to reveal properties</div>}

      <div className="toasts">
        {toasts.map(t => <div key={t.id} className="toast">{t.icon} {t.msg}</div>)}
      </div>

      {sel && (
        <div className="card" key={sel.id}>
          <div className="card-photo" style={photo ? { backgroundImage: `url(${photo})` } : undefined}>
            {!photo && <span className="card-photo-emoji">{selMeta.emoji}</span>}
            <button className="close" onClick={() => { sfx.click(); setSelectedId(null) }}>✕</button>
            <span className={'tier-chip tier-' + sel.tier}>{selMeta.label}</span>
            <span className="rar-chip" style={{ background: selRar.color }}>{selRar.label}</span>
          </div>
          <div className="card-body">
            <h2>{sel.name}</h2>
            {selOwned ? (
              <>
                <div className="stats">
                  <div><label>Yield</label><b>{CASH_SYM}{fmt(cashPerHour(sel.price, sel.ups) * managerBonus(sel))} · {BLOCK_SYM}{fmtB(blockPerHour(sel.price, sel.ups) * managerBonus(sel))}<small>/hr</small></b></div>
                  <div><label>Accrued</label><b className="gold">{CASH_SYM}{fmt(pendingCash(sel, now))} · {BLOCK_SYM}{fmtB(pendingBlock(sel, now))}</b></div>
                  <div><label>Improvements</label><b>{sel.ups}/{MAX_UPS}</b></div>
                </div>
                {selCapped && <div className="capped-warn">Yield halted — the 8-hour unmanaged cap was reached. Collect now, or appoint a manager.</div>}
                <div className={'manager-row' + (sel.manager ? ' hired' : '')} data-tut="manager">
                  {sel.manager ? (
                    <span className="mgr-on">
                      <img className="staff-mini" src={CHAR_ART[sel.manager]} alt="" />
                      {MANAGERS[sel.manager]?.name} — auto-collect, +{Math.round((managerBonus(sel) - 1) * 100)}% yield
                    </span>
                  ) : (
                    <>
                      <span className="mgr-off">No manager <small>· yield halts after {UNMANAGED_CAP_HOURS}h</small></span>
                      <button className="mini-btn hire-btn" onClick={() => openStaffing(sel.id)}>
                        {level < MANAGERS_LEVEL ? `Level ${MANAGERS_LEVEL} required` : 'Appoint staff'}
                      </button>
                    </>
                  )}
                </div>
                <div className="ups">
                  <div className="ups-title">Improvements</div>
                  {selUpgrades.map((name, i) => {
                    const done = i < sel.ups
                    const next = i === sel.ups
                    const cost = upgradeCost(sel.price, i)
                    const boost = Math.round((UPGRADE_RENT_MULT[i] - 1) * 100)
                    return (
                      <div key={name} className={'up-row' + (done ? ' done' : next ? ' next' : ' locked')}>
                        <span className="up-name">{name}</span>
                        <span className="up-boost">+{boost}% yield</span>
                        {next
                          ? <button className="up-buy" disabled={block < cost} onClick={() => upgrade(sel.id)}>{BLOCK_SYM}{fmt(cost)}</button>
                          : <span className="up-cost">{done ? 'Installed' : `${BLOCK_SYM}${fmt(cost)}`}</span>}
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="stats">
                  <div><label>Price</label><b>{CASH_SYM}{fmt(sel.price)}<small> or </small>{BLOCK_SYM}{fmt(selBlockPrice)}</b></div>
                  <div><label>Yield</label><b>{CASH_SYM}{fmt(cashPerHour(sel.price, 0))} · {BLOCK_SYM}{fmtB(blockPerHour(sel.price, 0))}<small>/hr</small></b></div>
                  <div><label>Max yield</label><b>{CASH_SYM}{fmt(cashPerHour(sel.price, MAX_UPS))} · {BLOCK_SYM}{fmtB(blockPerHour(sel.price, MAX_UPS))}<small>/hr</small></b></div>
                </div>
                {selLocked ? (
                  <div className="locked-bar">{selMeta.label} properties unlock at <b>Level {selUnlockAt}</b></div>
                ) : ownedList.length >= slots ? (
                  <div className="locked-bar">No permits available — <b>{ownedList.length}/{slots}</b> held. Level up or acquire one in your Portfolio.</div>
                ) : (
                  <div className="buy-row">
                    <button
                      className={'primary' + (tutDef?.mode === 'buy' && starter && sel.id === starter.id ? ' tut-glow' : '')}
                      data-tut="buy"
                      disabled={cash < sel.price}
                      onClick={() => buy(sel, 'cash')}
                    >
                      Acquire · {CASH_SYM}{fmt(sel.price)}
                    </button>
                    <button className="primary block-buy" disabled={block < selBlockPrice} onClick={() => buy(sel, 'block')}>
                      {BLOCK_SYM}{fmt(selBlockPrice)}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {showPortfolio && (
        <div className="portfolio">
          <div className="modal-head">
            <h3>Portfolio</h3>
            <button className="close-flat" onClick={() => { sfx.close(); setShowPortfolio(false) }}>✕</button>
          </div>
          <div className="empire-id">
            {player.pfp?.type === 'image'
              ? <img className="pfp big" src={player.pfp.value} alt="" />
              : <span className="pfp-emoji big">{player.pfp?.value || '👻'}</span>}
            <div>
              <b>{player.name || 'Anonymous Landlord'}</b>
              <span className="rank-name">{rankForLevel(level)}</span>
            </div>
          </div>
          <div className="level-panel">
            <div className="level-line">
              <span className="lvl-badge big">Lv {level}</span>
              <span className="xp-text">{fmt(xpInto)} / {fmt(xpNeed)} XP</span>
            </div>
            <div className="xp-track wide"><span className="xp-fill" style={{ width: `${Math.min(100, (xpInto / xpNeed) * 100)}%` }} /></div>
            {LEVEL_PERKS[level + 1] && <p className="next-perk">Next: <b>{LEVEL_PERKS[level + 1]}</b></p>}
          </div>
          <div className="empire-stats">
            <div><label>Holdings</label><b>{ownedList.length}/{slots}</b></div>
            <div><label>{CASH_SYM} per hr</label><b>{fmt(totalCashRate)}</b></div>
            <div><label>{BLOCK_SYM} per hr</label><b>{fmtB(totalBlockRate)}</b></div>
          </div>
          <button className="permit-btn" disabled={block < permitCost(extraPermits)} onClick={buyPermit}>
            Acquire permit · {BLOCK_SYM}{fmt(permitCost(extraPermits))}
          </button>
          {ownedList.length === 0 && <p className="muted">No holdings yet. Select a property on the map to acquire it.</p>}
          {ownedList.map(p => (
            <button key={p.id} className="prop-row" onClick={() => { sfx.select(); flyTo(p) }}>
              <span>{(TIER_META[p.tier] || TIER_META.shop).emoji} {p.name}{p.manager ? ' · managed' : ''}</span>
              <span className="muted">{p.ups}/{MAX_UPS} · {CASH_SYM}{fmt(cashPerHour(p.price, p.ups))} · {BLOCK_SYM}{fmtB(blockPerHour(p.price, p.ups))}</span>
            </button>
          ))}
        </div>
      )}

      <Marketplace
        open={showMarket}
        tab={marketTab}
        setTab={setMarketTab}
        onClose={() => setShowMarket(false)}
        level={level}
        block={block}
        now={now}
        auctions={auctions}
        myBids={bids}
        onBid={placeBid}
        ownedList={ownedList}
        onInstantSell={instantSell}
        onFly={flyTo}
      />

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onToggle={(k) => { sfx.click(); setSettings(s => ({ ...s, [k]: !s[k] })) }}
        onLogout={onLogout}
        onReset={resetProgress}
        player={player}
      />

      {levelUpTo && (
        <div className="modal-backdrop" onClick={() => setLevelUpTo(null)}>
          <div className="levelup" onClick={e => e.stopPropagation()}>
            <div className="lu-kicker">Promotion</div>
            <h2>Level {levelUpTo}</h2>
            <p className="rank-line">{rankForLevel(levelUpTo)}</p>
            <hr className="lu-rule" />
            {LEVEL_PERKS[levelUpTo] && <p>{LEVEL_PERKS[levelUpTo]}</p>}
            <button className="primary" onClick={() => { sfx.click(); setLevelUpTo(null) }}>Continue</button>
          </div>
        </div>
      )}

      <StaffModal
        propId={staffFor}
        prop={staffFor ? owned[staffFor] : null}
        block={block}
        onHire={hireManager}
        onClose={() => setStaffFor(null)}
      />

      <NearbyPanel
        open={showNearby}
        items={nearbyItems}
        sort={nearbySort}
        setSort={setNearbySort}
        onSelect={(p) => { setShowNearby(false); flyTo(p) }}
        onClose={() => setShowNearby(false)}
      />

      {popup && (
        <div className="char-popup" key={popup.id}>
          <img src={CHAR_ART[popup.char]} alt="" />
          <div className="char-popup-text">
            <b>{CHAR_NAMES[popup.char]}</b>
            <p>{popup.text}</p>
          </div>
        </div>
      )}

      <Contract
        contract={contract}
        playerName={player.name}
        signature={signature}
        onComplete={completeBuy}
        onCancel={() => { sfx.click(); setContract(null) }}
      />

      {tutDef?.mode === 'dialog' && !tutDef.target && <div className="tut-blur" />}
      {tutStep != null && (
        <Tutorial
          step={tutStep}
          ctx={{ starter }}
          onNext={() => (tutStep >= TUT_STEPS.length - 1 ? finishTutorial() : setTutStep(tutStep + 1))}
          onSkip={finishTutorial}
        />
      )}

      {!mapReady && (
        <div className="splash">
          <img className="splash-mark" src={logoArt} alt="" />
          <h1 className="home-title">SOL ESTATES</h1>
          <div className="spinner" />
          <p className="splash-text">Entering the real world…</p>
        </div>
      )}
    </div>
  )
}
