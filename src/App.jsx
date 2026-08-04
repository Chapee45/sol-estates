import { useState } from 'react'
import Home from './Home.jsx'
import Game from './Game.jsx'
import { connectPhantom, disconnectPhantom } from './wallet.js'
import { sfx, kickMusic } from './sound.js'

const PLAYER_KEY = 'blocklord-player-v1'

// Phantom is the only real door. The ?dev=1 bypass exists solely so the game
// can be tested in environments without the extension — REMOVE BEFORE LAUNCH.
const DEV_MODE = new URLSearchParams(window.location.search).has('dev')

function loadPlayer() {
  try { return JSON.parse(localStorage.getItem(PLAYER_KEY)) } catch { return null }
}

export default function App() {
  const [player, setPlayer] = useState(loadPlayer)
  // 'login' → 'account' → 'locate' → 'play'. A reload mid-onboarding resumes
  // at account creation until a username exists — no skipping the flow.
  const [stage, setStage] = useState(() => {
    const p = loadPlayer()
    if (!p) return 'login'
    if (!p.name) return 'account'
    return 'play'
  })
  const [connecting, setConnecting] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState(null)

  function savePlayer(p) {
    localStorage.setItem(PLAYER_KEY, JSON.stringify(p))
    setPlayer(p)
  }

  async function onPhantom() {
    kickMusic()
    setConnecting(true)
    setError(null)
    try {
      const address = await connectPhantom()
      sfx.buy()
      savePlayer({ mode: 'phantom', address, tutorialDone: false })
      setStage('account')
    } catch (e) {
      setError(e.message)
    }
    setConnecting(false)
  }

  function onDev() {
    kickMusic()
    savePlayer({ mode: 'dev', address: null, tutorialDone: false })
    setStage('account')
  }

  function onCreateAccount({ name, pfp }) {
    sfx.click()
    savePlayer({ ...loadPlayer(), name, pfp })
    setStage('locate')
  }

  // Native browser permission popup → start the game where the player lives.
  // GPS/browser geolocation first; IP-based city lookup as fallback so the
  // button works even when precise location is blocked or unavailable.
  function onUseLocation() {
    setLocating(true)
    const finish = (home) => {
      if (home) savePlayer({ ...loadPlayer(), home })
      setLocating(false)
      setStage('play')
    }
    const ipFallback = async () => {
      try {
        const r = await fetch('https://ipapi.co/json/')
        const j = await r.json()
        if (j.latitude && j.longitude) return finish({ lat: +j.latitude, lon: +j.longitude })
      } catch { /* no luck */ }
      finish(null) // default city
    }
    if (!navigator.geolocation) return ipFallback()
    navigator.geolocation.getCurrentPosition(
      (pos) => finish({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => ipFallback(),
      { timeout: 12000, maximumAge: 300000 }
    )
  }

  function onSkipLocation() { setStage('play') }

  function onTutorialDone() {
    savePlayer({ ...player, tutorialDone: true })
  }

  function onLogout() {
    disconnectPhantom()
    localStorage.removeItem(PLAYER_KEY)
    setPlayer(null)
    setStage('login')
  }

  if (player && stage === 'play') {
    return <Game player={player} onLogout={onLogout} onTutorialDone={onTutorialDone} />
  }
  return (
    <Home
      stage={player && (stage === 'locate' || stage === 'account') ? stage : 'login'}
      onPhantom={onPhantom}
      onDev={onDev}
      showDev={DEV_MODE}
      onCreateAccount={onCreateAccount}
      onUseLocation={onUseLocation}
      onSkipLocation={onSkipLocation}
      locating={locating}
      connecting={connecting}
      error={error}
    />
  )
}
