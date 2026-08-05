import { useEffect, useRef, useState } from 'react'
import Home from './Home.jsx'
import Game from './Game.jsx'
import { connectPhantom, disconnectPhantom, handlePhantomReturn } from './wallet.js'
import { sfx, kickMusic } from './sound.js'

const PLAYER_KEY = 'blocklord-player-v1'

function loadPlayer() {
  try { return JSON.parse(localStorage.getItem(PLAYER_KEY)) } catch { return null }
}

export default function App() {
  const [player, setPlayer] = useState(loadPlayer)
  const [stage, setStage] = useState('home') // 'home' | 'play'
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(null)

  // One delegated listener gives every enabled button a soft hover tick
  const lastHoverEl = useRef(null)
  useEffect(() => {
    const onOver = (e) => {
      const btn = e.target.closest?.('button:not(:disabled), .chip, .prop-row')
      if (btn && btn !== lastHoverEl.current) {
        lastHoverEl.current = btn
        sfx.hover()
      } else if (!btn) {
        lastHoverEl.current = null
      }
    }
    document.addEventListener('pointerover', onOver)
    return () => document.removeEventListener('pointerover', onOver)
  }, [])

  // Back from the Phantom app: after the player approves the connection,
  // Phantom redirects here with the wallet address encrypted in the query.
  useEffect(() => {
    const res = handlePhantomReturn()
    if (!res) return
    const url = new URL(window.location.href)
    for (const k of ['phantom', 'phantom_encryption_public_key', 'nonce', 'data', 'errorCode', 'errorMessage']) {
      url.searchParams.delete(k)
    }
    window.history.replaceState({}, '', url.pathname + url.search)
    if (res.error) {
      setError(res.error)
    } else if (res.address) {
      sfx.buy()
      savePlayer({ ...(loadPlayer() || { tutorialDone: false }), address: res.address, mode: 'phantom' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function savePlayer(p) {
    localStorage.setItem(PLAYER_KEY, JSON.stringify(p))
    setPlayer(p)
  }

  // Returning player pressed PLAY
  function onPlay() {
    kickMusic()
    setStage('play')
  }

  // First-time player finished the profile card.
  // home: {lat, lon} from the city search, 'auto' to locate them, or null for the default city.
  function onCreateProfile(profile, home) {
    kickMusic()
    const base = { ...(player || {}), ...profile, mode: player?.address ? 'phantom' : 'guest', tutorialDone: false }
    const go = (h) => {
      savePlayer(h ? { ...base, home: { lat: h.lat, lon: h.lon } } : base)
      setStage('play')
    }
    if (home && home !== 'auto') return go(home)
    if (home !== 'auto') return go(null)
    if (!navigator.geolocation) return ipFallback(go)
    navigator.geolocation.getCurrentPosition(
      (pos) => go({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => ipFallback(go),
      { timeout: 12000, maximumAge: 300000 }
    )
  }

  // Two independent IP-location services before giving up — either can be
  // rate-limited or blocked, and a failed lookup should never strand the player.
  async function ipFallback(go) {
    try {
      const r = await fetch('https://ipapi.co/json/')
      const j = await r.json()
      if (j.latitude && j.longitude) return go({ lat: j.latitude, lon: j.longitude })
    } catch { /* try next */ }
    try {
      const r = await fetch('https://ipwho.is/')
      const j = await r.json()
      if (j.latitude && j.longitude) return go({ lat: j.latitude, lon: j.longitude })
    } catch { /* default city */ }
    go(null)
  }

  // Wallet connect is optional and lives on the home screen
  async function onConnectWallet() {
    setConnecting(true)
    setError(null)
    try {
      const address = await connectPhantom()
      sfx.buy()
      savePlayer({ ...(player || { tutorialDone: false }), address, mode: 'phantom' })
    } catch (e) {
      setError(e.message)
    }
    setConnecting(false)
  }

  function onTutorialDone() {
    savePlayer({ ...player, tutorialDone: true })
  }

  function onLogout() {
    disconnectPhantom()
    localStorage.removeItem(PLAYER_KEY)
    setPlayer(null)
    setStage('home')
  }

  if (stage === 'play' && player?.name) {
    return <Game player={player} onLogout={onLogout} onTutorialDone={onTutorialDone} />
  }
  return (
    <Home
      player={player}
      onPlay={onPlay}
      onCreateProfile={onCreateProfile}
      onConnectWallet={onConnectWallet}
      connecting={connecting}
      error={error}
    />
  )
}
