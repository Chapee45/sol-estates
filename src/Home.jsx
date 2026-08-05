import { useEffect, useMemo, useRef, useState } from 'react'
import logo from './assets/logo-text.webp'
import cloud1 from './assets/cloud1.webp'
import cloud2 from './assets/cloud2.webp'
import bg from './assets/home-bg.webp'
import bgMobile from './assets/home-bg-mobile.webp'
import bgNight from './assets/home-bg-night.webp'
import bgNightMobile from './assets/home-bg-night-mobile.webp'
import { sfx, applyAudioSettings } from './sound.js'
import { GameSettings } from './SettingsModal.jsx'
import { fmtB, fmt, BLOCK_SYM, CASH_SYM, cashPerHour, managerBonus } from './economy.js'
import { shortAddr } from './wallet.js'
import { levelFromXp, rankForLevel } from './state.js'

import av01 from './assets/pfp/av01.jpg'
import av02 from './assets/pfp/av02.jpg'
import av03 from './assets/pfp/av03.jpg'
import av04 from './assets/pfp/av04.jpg'
import av05 from './assets/pfp/av05.jpg'
import av06 from './assets/pfp/av06.jpg'
import av07 from './assets/pfp/av07.jpg'
import av08 from './assets/pfp/av08.jpg'
import av09 from './assets/pfp/av09.jpg'
import av10 from './assets/pfp/av10.jpg'
import av11 from './assets/pfp/av11.jpg'
import av12 from './assets/pfp/av12.jpg'

const CHAR_PFPS = [
  { id: 'bull', src: av01, label: 'Bully Banks' },
  { id: 'bear', src: av02, label: 'Bear Marx' },
  { id: 'doge', src: av03, label: 'Moon Doge' },
  { id: 'ape', src: av04, label: 'Ape Foreman' },
  { id: 'whale', src: av05, label: 'Sir Whalington' },
  { id: 'robot', src: av06, label: 'Bot the Broker' },
  { id: 'astro', src: av07, label: 'Moon Mover' },
  { id: 'croc', src: av08, label: 'Croc Capital' },
  { id: 'cat', src: av09, label: 'Laser Whiskers' },
  { id: 'wizard', src: av10, label: 'The Oracle' },
  { id: 'agent', src: av11, label: 'Keys Kiara' },
  { id: 'magnate', src: av12, label: 'Old Money Monty' },
]

const SAVE_KEY = 'blocklord-save-v1'
function readSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {} } catch { return {} }
}
function writeSaveSettings(settings) {
  const s = readSave()
  s.settings = settings
  localStorage.setItem(SAVE_KEY, JSON.stringify(s))
}

// Preview standings until multiplayer goes live
const LEADER_BOTS = [
  { name: 'BrickzillaNYC', pfp: '🦖', img: av08, rev: 48200 },
  { name: 'DubaiWhale', pfp: '🐋', img: av05, rev: 31500 },
  { name: 'LandLadyLiz', pfp: '💅', img: av11, rev: 19800 },
  { name: 'TokyoTycoon', pfp: '🗼', img: av09, rev: 12400 },
  { name: 'SirBricksalot', pfp: '🎩', img: av12, rev: 8600 },
  { name: 'CryptoKeith', pfp: '🤓', img: av06, rev: 4100 },
  { name: 'PixelLandlord', pfp: '👾', img: av10, rev: 2300 },
  { name: 'MortgageMolly', pfp: '🏡', img: av03, rev: 950 },
  { name: 'CouchInvestor', pfp: '🛋️', img: av02, rev: 210 },
]

export default function Home({ player, onPlay, onCreateProfile, onConnectWallet, connecting, error }) {
  const [modal, setModal] = useState(null) // 'profile' | 'token' | 'wallet' | 'settings' | 'account' | 'leaders'
  const [name, setName] = useState('')
  const [pfp, setPfp] = useState({ type: 'image', value: '' })
  const [charSel, setCharSel] = useState(CHAR_PFPS[0].id)
  const [pendingPlay, setPendingPlay] = useState(false)
  const [locQ, setLocQ] = useState('')
  const [locHits, setLocHits] = useState([])
  const [homeSel, setHomeSel] = useState(null) // {lat, lon, label} from city search
  const fileRef = useRef(null)
  const nameOk = /^[a-zA-Z0-9_ ]{3,16}$/.test(name.trim())

  const save = readSave()
  const estate = save.block ?? 0
  const [settings, setSettings] = useState({
    music: true, sfx: true, ambience: true, musicVol: 0.5, sfxVol: 0.6, ambVol: 0.5, night: false,
    ...(save.settings || {}),
  })
  useEffect(() => {
    applyAudioSettings(settings)
    document.documentElement.dataset.theme = settings.night ? 'night' : ''
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings])
  const connected = !!player?.address
  const level = levelFromXp(save.xp ?? 0)

  // Phones get a portrait crop of the city art — the wide desktop image
  // covers to an empty sky/park slice on narrow screens.
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 560px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 560px)')
    const on = (e) => setNarrow(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const bgUrl = settings.night ? (narrow ? bgNightMobile : bgNight) : (narrow ? bgMobile : bg)

  const myRevenue = useMemo(() => {
    const owned = Object.values(save.owned || {})
    return owned.reduce((s, p) => s + cashPerHour(p.price, p.ups) * managerBonus(p), 0)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const leaders = useMemo(() => {
    const rows = [...LEADER_BOTS.map(b => ({ ...b, me: false }))]
    rows.push({ name: player?.name || 'You', pfp: player?.pfp?.value || '🙂', rev: myRevenue, me: true, img: player?.pfp?.type === 'image' ? player.pfp.value : null })
    return rows.sort((a, b) => b.rev - a.rev)
  }, [player, myRevenue])

  function toggleSetting(k) {
    sfx.click()
    const next = { ...settings, [k]: !settings[k] }
    setSettings(next)
    writeSaveSettings(next)
  }
  function setSetting(k, v) {
    const next = { ...settings, [k]: v }
    setSettings(next)
    writeSaveSettings(next)
  }

  // Store the chosen character as a small dataURL so the saved profile
  // survives redeploys (built asset filenames change between builds).
  function pickChar(c, silent) {
    if (!silent) sfx.select()
    setCharSel(c.id)
    const img = new Image()
    img.onload = () => {
      const cnv = document.createElement('canvas')
      cnv.width = cnv.height = 128
      cnv.getContext('2d').drawImage(img, 0, 0, 128, 128)
      setPfp({ type: 'image', value: cnv.toDataURL('image/jpeg', 0.85) })
    }
    img.src = c.src
  }
  useEffect(() => { pickChar(CHAR_PFPS[0], true) }, [])

  function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        c.width = c.height = 128
        const cx = c.getContext('2d')
        const s = Math.min(img.width, img.height)
        cx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 128, 128)
        setCharSel(null)
        setPfp({ type: 'image', value: c.toDataURL('image/jpeg', 0.82) })
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  }

  function handlePlay() {
    sfx.click()
    if (!connected) { setPendingPlay(true); setModal('wallet'); return }
    if (player?.name) onPlay()
    else setModal('profile')
  }

  // Once Phantom connects, continue the interrupted PLAY press
  useEffect(() => {
    if (connected && pendingPlay) {
      setPendingPlay(false)
      if (player?.name) onPlay()
      else setModal('profile')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected])

  // City search (Photon/OSM geocoder — free, worldwide, no key)
  useEffect(() => {
    const q = locQ.trim()
    if (q.length < 2 || (homeSel && q === homeSel.label)) { setLocHits([]); return }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lang=en`)
        const j = await r.json()
        setLocHits((j.features || [])
          .filter(f => f.geometry?.coordinates)
          .map(f => ({
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0],
            label: [f.properties.name, f.properties.state, f.properties.country].filter(Boolean).join(', '),
          })))
      } catch { setLocHits([]) }
    }, 300)
    return () => clearTimeout(t)
  }, [locQ, homeSel])

  const open = (m) => { sfx.open(); setModal(m) }
  const close = () => { sfx.close(); setModal(null); setPendingPlay(false) }

  return (
    <div className="home" style={{ backgroundImage: `url(${bgUrl})` }}>
      <div className="home-sky-tint" />
      <img className="cloud cloud-a" src={cloud1} alt="" />
      <img className="cloud cloud-b" src={cloud2} alt="" />
      <img className="cloud cloud-c" src={cloud1} alt="" />

      <div className="home-hud">
        <span className="hud-chip">{CASH_SYM}{fmt(save.cash ?? 0)}</span>
        <span className="hud-chip sol">{BLOCK_SYM}{fmtB(estate)}</span>
      </div>

      <div className="home-inner menu">
        <img className="home-wordmark" src={logo} alt="Sol Estates" fetchpriority="high" />

        <button className="play-btn" onClick={handlePlay}>▶ &nbsp;PLAY</button>

        <div className="menu-row">
          <button className="menu-sq" onClick={() => open('token')}>
            <span className="menu-ic sol-grad">{BLOCK_SYM}</span><span>$ESTATE</span>
          </button>
          <button className="menu-sq" onClick={() => open('wallet')}>
            <span className="menu-ic">👛</span><span>Wallet</span>
          </button>
          <button className="menu-sq" onClick={() => open('leaders')}>
            <span className="menu-ic">🏆</span><span>Leaders</span>
          </button>
          <button className="menu-sq" onClick={() => open('account')}>
            <span className="menu-ic">
              {player?.pfp?.type === 'image'
                ? <img className="menu-pfp" src={player.pfp.value} alt="" />
                : (player?.pfp?.value || '👤')}
            </span>
            <span>Account</span>
          </button>
          <button className="menu-sq" onClick={() => open('settings')}>
            <span className="menu-ic">⚙️</span><span>Settings</span>
          </button>
        </div>

        {error && <p className="home-err">{error}</p>}
      </div>

      {/* -------- profile setup (first PLAY) -------- */}
      {modal === 'profile' && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal profile-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Create your profile</h3>
              <button className="close-flat" onClick={close}>✕</button>
            </div>
            <div className="profile-center">
              <div className="pfp-preview">
                <img src={pfp.value || CHAR_PFPS[0].src} alt="" />
              </div>
              <div className="pfp-grid">
                {CHAR_PFPS.map(c => (
                  <button
                    key={c.id}
                    title={c.label}
                    className={'pfp-opt char' + (charSel === c.id ? ' on' : '')}
                    onClick={() => pickChar(c)}
                  ><img src={c.src} alt={c.label} /></button>
                ))}
                <button className="pfp-opt upload" title="Upload your own" onClick={() => { sfx.click(); fileRef.current?.click() }}>＋</button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
              </div>
              <input
                className="name-input"
                placeholder="Username (3–16 characters)"
                maxLength={16}
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <div className="loc-search">
                <input
                  className="name-input"
                  placeholder="🔍 Search any city in the world…"
                  value={locQ}
                  onChange={e => { setLocQ(e.target.value); if (homeSel) setHomeSel(null) }}
                />
                {locHits.length > 0 && (
                  <div className="loc-hits">
                    {locHits.map((h, i) => (
                      <button
                        key={h.label + i}
                        className="loc-hit"
                        onClick={() => { sfx.select(); setHomeSel(h); setLocQ(h.label); setLocHits([]) }}
                      >📍 {h.label}</button>
                    ))}
                  </div>
                )}
              </div>
              <button
                className="primary"
                disabled={!nameOk}
                onClick={() => { sfx.buy(); onCreateProfile({ name: name.trim(), pfp }, homeSel || 'auto') }}
              >
                {!nameOk ? 'Choose a username'
                  : homeSel ? `Start in ${homeSel.label.split(',')[0]} 📍`
                  : 'Start in my neighborhood 📍'}
              </button>
              <button
                className="guest-btn"
                disabled={!nameOk}
                onClick={() => { sfx.click(); onCreateProfile({ name: name.trim(), pfp }, null) }}
              >
                Start in New York
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------- $ESTATE token -------- */}
      {modal === 'token' && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3><span className="sol-grad">{BLOCK_SYM}</span> $ESTATE</h3>
              <button className="close-flat" onClick={close}>✕</button>
            </div>
            <p className="market-note">
              <b>$ESTATE</b> is the property-yield token of Sol Estates, on Solana.
              Every property you own earns it around the clock — the rarer the
              property, the richer the yield. Spend it on upgrades, permits and
              auctions, or hold it in your wallet.
            </p>
            <div className="empire-stats">
              <div><label>Network</label><b>Solana</b></div>
              <div><label>Status</label><b>Pre-launch</b></div>
              <div><label>Your balance</label><b>{BLOCK_SYM}{fmtB(estate)}</b></div>
            </div>
            <button className="primary" disabled>Buy $ESTATE — at token launch</button>
          </div>
        </div>
      )}

      {/* -------- wallet -------- */}
      {modal === 'wallet' && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>👛 {pendingPlay ? 'Connect to play' : 'Wallet'}</h3>
              <button className="close-flat" onClick={close}>✕</button>
            </div>
            {connected ? (
              <>
                <div className="empire-stats">
                  <div><label>Connected</label><b>{shortAddr(player.address)}</b></div>
                  <div><label>$ESTATE earned</label><b>{BLOCK_SYM}{fmtB(estate)}</b></div>
                </div>
                <p className="market-note">
                  Your properties keep earning $ESTATE while you play. On-chain
                  withdrawals to Phantom open at token launch — your balance is
                  recorded and safe until then.
                </p>
                <button className="primary" disabled>Withdraw to Phantom — at token launch</button>
              </>
            ) : (
              <>
                <p className="market-note">
                  {pendingPlay
                    ? <>Sol Estates runs on your Phantom wallet — it secures your empire and receives your <b>$ESTATE</b> earnings. Connect to start playing.</>
                    : <>Connect your Phantom wallet to secure your account and receive <b>$ESTATE</b> withdrawals when the token goes live.</>}
                </p>
                <button className="primary" onClick={() => { sfx.click(); onConnectWallet() }} disabled={connecting}>
                  {connecting ? 'Connecting…' : 'Connect Phantom'}
                </button>
                {error && <p className="home-err">{error}</p>}
              </>
            )}
          </div>
        </div>
      )}

      {/* -------- leaderboard -------- */}
      {modal === 'leaders' && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>🏆 Leaderboard</h3>
              <button className="close-flat" onClick={close}>✕</button>
            </div>
            <p className="market-note">Ranked by property revenue per hour. <span className="muted">Preview standings — goes fully live with multiplayer.</span></p>
            <div className="leader-list">
              {leaders.map((row, i) => (
                <div key={row.name + i} className={'leader-row' + (row.me ? ' me' : '')}>
                  <span className="leader-rank">{i + 1}</span>
                  <span className="leader-pfp">
                    {row.img ? <img src={row.img} alt="" /> : row.pfp}
                  </span>
                  <span className="leader-name">{row.name}{row.me ? ' (you)' : ''}</span>
                  <span className="leader-rev">{CASH_SYM}{fmt(row.rev)}<small>/hr</small></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* -------- settings -------- */}
      {modal === 'settings' && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>⚙️ Settings</h3>
              <button className="close-flat" onClick={close}>✕</button>
            </div>
            <GameSettings settings={settings} onToggle={toggleSetting} onSet={setSetting} />
            <p className="settings-foot">SOL ESTATES <span className="muted">· pre-alpha · $ESTATE on Solana</span></p>
          </div>
        </div>
      )}

      {/* -------- account -------- */}
      {modal === 'account' && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Account</h3>
              <button className="close-flat" onClick={close}>✕</button>
            </div>
            {player?.name ? (
              <>
                <div className="empire-id">
                  {player.pfp?.type === 'image'
                    ? <img className="pfp big" src={player.pfp.value} alt="" />
                    : <span className="pfp-emoji big">{player.pfp?.value || '🙂'}</span>}
                  <div>
                    <b>{player.name}</b>
                    <span className="rank-name">Lv {level} · {rankForLevel(level)}</span>
                  </div>
                </div>
                <div className="empire-stats">
                  <div><label>Revenue</label><b>{CASH_SYM}{fmt(myRevenue)}/hr</b></div>
                  <div><label>$ESTATE</label><b>{BLOCK_SYM}{fmtB(estate)}</b></div>
                  <div><label>Wallet</label><b>{connected ? shortAddr(player.address) : 'Not linked'}</b></div>
                </div>
                {!connected && (
                  <button className="primary" onClick={() => { sfx.click(); onConnectWallet() }} disabled={connecting}>
                    {connecting ? 'Connecting…' : 'Connect Phantom'}
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="market-note">No profile yet — hit <b>PLAY</b> to create your landlord.</p>
                <button className="primary" onClick={() => { sfx.click(); setModal('profile') }}>Create profile</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
