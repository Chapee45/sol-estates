import { useRef, useState } from 'react'
import logo from './assets/logo-sol.png'

const EMOJI_PFPS = ['🤑', '😎', '🦈', '👑', '🐺', '🚀', '💼', '🏗️', '🧱', '🐉', '🦁', '💎']

export default function Home({
  stage, onPhantom, onDev, showDev, onCreateAccount,
  onUseLocation, onSkipLocation, locating, connecting, error,
}) {
  const [name, setName] = useState('')
  const [pfp, setPfp] = useState({ type: 'emoji', value: '🤑' })
  const fileRef = useRef(null)
  const nameOk = /^[a-zA-Z0-9_ ]{3,16}$/.test(name.trim())

  function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        // resize to a small square so it fits in local storage
        const c = document.createElement('canvas')
        c.width = c.height = 128
        const ctx = c.getContext('2d')
        const s = Math.min(img.width, img.height)
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 128, 128)
        setPfp({ type: 'image', value: c.toDataURL('image/jpeg', 0.82) })
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="home">
      <div className="home-glow home-glow-a" />
      <div className="home-glow home-glow-b" />
      <div className="home-inner">
        {stage === 'login' && (
          <>
            <img className="home-mark" src={logo} alt="" />
            <h1 className="home-title">SOL ESTATES</h1>
            <p className="home-tag">
              The real world is for sale. Buy real landmarks and shops on the world
              map. Every property pays you <b>CASH</b> to grow your empire — and{' '}
              <b>$BLOCK</b>, the real token, straight to your wallet.
            </p>
            <div className="home-stats">
              <div><b>1M</b><span>real properties</span></div>
              <div><b>195</b><span>countries</span></div>
              <div><b>$BLOCK</b><span>on Solana</span></div>
            </div>
            <button className="phantom-btn" onClick={onPhantom} disabled={connecting}>
              {connecting ? 'Connecting…' : 'Connect Phantom'}
            </button>
            {showDev && (
              <button className="guest-btn" onClick={onDev}>Developer session (local only)</button>
            )}
            {error && <p className="home-err">{error}</p>}
          </>
        )}

        {stage === 'account' && (
          <>
            <h1 className="home-title small">Create your profile</h1>
            <div className="pfp-preview">
              {pfp.type === 'image'
                ? <img src={pfp.value} alt="pfp" />
                : <span>{pfp.value}</span>}
            </div>
            <div className="pfp-grid">
              {EMOJI_PFPS.map(e => (
                <button
                  key={e}
                  className={'pfp-opt' + (pfp.type === 'emoji' && pfp.value === e ? ' on' : '')}
                  onClick={() => setPfp({ type: 'emoji', value: e })}
                >{e}</button>
              ))}
              <button className="pfp-opt upload" onClick={() => fileRef.current?.click()}>＋</button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
            </div>
            <input
              className="name-input"
              placeholder="Username (3–16 characters)"
              maxLength={16}
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <button
              className="phantom-btn"
              disabled={!nameOk}
              onClick={() => onCreateAccount({ name: name.trim(), pfp })}
            >
              {nameOk ? `Continue as ${name.trim()}` : 'Choose a username'}
            </button>
          </>
        )}

        {stage === 'locate' && (
          <>
            <div className="locate-pin">📍</div>
            <h1 className="home-title small">Play where you live</h1>
            <p className="home-tag">
              Start the game in <b>your own neighborhood</b> — the streets you walk,
              the cafés you know, all buyable. Your location stays on your device.
            </p>
            <button className="phantom-btn" onClick={onUseLocation} disabled={locating}>
              {locating ? 'Finding your neighborhood…' : 'Use my location'}
            </button>
            <button className="guest-btn" onClick={onSkipLocation}>Skip — start in New York</button>
          </>
        )}
      </div>
    </div>
  )
}
