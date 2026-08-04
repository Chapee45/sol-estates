import { useMemo, useRef, useState } from 'react'
import logo from './assets/logo-sol.png'
import { sfx } from './sound.js'
import { fmtB, BLOCK_SYM } from './economy.js'
import { shortAddr } from './wallet.js'

const EMOJI_PFPS = ['🤑', '😎', '🦈', '👑', '🐺', '🚀', '💼', '🏗️', '🧱', '🐉', '🦁', '💎']

// $ESTATE earned so far lives in the game save
function readEstateBalance() {
  try { return JSON.parse(localStorage.getItem('blocklord-save-v1'))?.block ?? 0 } catch { return 0 }
}

// Deterministic skyline: [x, width, height] per building; windows generated
const BACK_BUILDINGS = [
  [0, 90, 150], [100, 70, 210], [180, 110, 130], [300, 80, 240], [390, 100, 170],
  [500, 70, 260], [580, 120, 150], [710, 90, 220], [810, 100, 160], [920, 80, 200],
  [1010, 110, 140], [1130, 80, 230], [1220, 100, 180], [1330, 90, 250], [1430, 90, 160],
]
const FRONT_BUILDINGS = [
  [30, 120, 110], [180, 90, 170], [290, 130, 90], [450, 100, 150], [580, 140, 100],
  [750, 110, 180], [890, 130, 120], [1050, 100, 160], [1180, 140, 95], [1350, 110, 140],
]

function Skyline({ className, buildings, lit }) {
  const content = useMemo(() => buildings.map(([x, w, h], bi) => {
    const rects = [<rect key="b" x={x} y={300 - h} width={w} height={h} rx="4" />]
    if (lit) {
      const cols = Math.floor(w / 22)
      const rows = Math.floor(h / 30)
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          // deterministic scatter — about half the windows are lit
          if ((bi * 7 + c * 3 + r * 5) % 5 < 2) {
            rects.push(
              <rect
                key={`w${c}-${r}`}
                className="win"
                x={x + 9 + c * 22} y={300 - h + 12 + r * 30}
                width="8" height="11" rx="1.5"
                style={{ animationDelay: `${((bi * 13 + c * 7 + r * 11) % 40) / 10}s` }}
              />
            )
          }
        }
      }
    }
    return rects
  }), [buildings, lit])
  return (
    <svg className={className} viewBox="0 0 1520 300" preserveAspectRatio="xMidYMax slice" aria-hidden>
      {content}
    </svg>
  )
}

export default function Home({ player, onPlay, onCreateProfile, onConnectWallet, connecting, error }) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [tokenOpen, setTokenOpen] = useState(false)
  const [walletOpen, setWalletOpen] = useState(false)
  const [name, setName] = useState('')
  const [pfp, setPfp] = useState({ type: 'emoji', value: '🤑' })
  const fileRef = useRef(null)
  const nameOk = /^[a-zA-Z0-9_ ]{3,16}$/.test(name.trim())
  const estate = readEstateBalance()
  const connected = !!player?.address

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
        setPfp({ type: 'image', value: c.toDataURL('image/jpeg', 0.82) })
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  }

  function handlePlay() {
    sfx.click()
    if (player?.name) onPlay()
    else setProfileOpen(true)
  }

  return (
    <div className="home">
      <Skyline className="city city-back" buildings={BACK_BUILDINGS} lit={false} />
      <Skyline className="city city-front" buildings={FRONT_BUILDINGS} lit={true} />
      <div className="home-grass" />

      <div className="home-inner">
        <img className="home-mark" src={logo} alt="Sol Estates" />
        <p className="home-tag">
          The real world is for sale. Buy real buildings, earn <b>CASH</b> — and{' '}
          <b>$ESTATE</b>, the real token, straight to your wallet.
        </p>

        <button className="play-btn" onClick={handlePlay}>
          ▶ &nbsp;PLAY
        </button>

        <div className="home-row">
          <button className="home-sq token-btn" onClick={() => { sfx.open(); setTokenOpen(true) }}>
            <span className="home-sq-icon">{BLOCK_SYM}</span>
            <span>$ESTATE</span>
          </button>
          <button className="home-sq wallet-btn" onClick={() => { sfx.open(); setWalletOpen(true) }}>
            <span className="home-sq-icon">👛</span>
            <span>{connected ? shortAddr(player.address) : 'Wallet'}</span>
          </button>
        </div>

        {error && <p className="home-err">{error}</p>}
      </div>

      {/* -------- profile setup (first PLAY) -------- */}
      {profileOpen && (
        <div className="modal-backdrop" onClick={() => setProfileOpen(false)}>
          <div className="modal profile-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Create your profile</h3>
              <button className="close-flat" onClick={() => { sfx.close(); setProfileOpen(false) }}>✕</button>
            </div>
            <div className="profile-center">
              <div className="pfp-preview">
                {pfp.type === 'image' ? <img src={pfp.value} alt="" /> : <span>{pfp.value}</span>}
              </div>
              <div className="pfp-grid">
                {EMOJI_PFPS.map(e => (
                  <button
                    key={e}
                    className={'pfp-opt' + (pfp.type === 'emoji' && pfp.value === e ? ' on' : '')}
                    onClick={() => { sfx.select(); setPfp({ type: 'emoji', value: e }) }}
                  >{e}</button>
                ))}
                <button className="pfp-opt upload" onClick={() => { sfx.click(); fileRef.current?.click() }}>＋</button>
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
                className="primary"
                disabled={!nameOk}
                onClick={() => { sfx.buy(); onCreateProfile({ name: name.trim(), pfp }, true) }}
              >
                {nameOk ? 'Start in my neighborhood 📍' : 'Choose a username'}
              </button>
              <button
                className="guest-btn"
                disabled={!nameOk}
                onClick={() => { sfx.click(); onCreateProfile({ name: name.trim(), pfp }, false) }}
              >
                Start in New York
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------- $ESTATE token -------- */}
      {tokenOpen && (
        <div className="modal-backdrop" onClick={() => setTokenOpen(false)}>
          <div className="modal token-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{BLOCK_SYM} $ESTATE</h3>
              <button className="close-flat" onClick={() => { sfx.close(); setTokenOpen(false) }}>✕</button>
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
      {walletOpen && (
        <div className="modal-backdrop" onClick={() => setWalletOpen(false)}>
          <div className="modal wallet-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>👛 Wallet</h3>
              <button className="close-flat" onClick={() => { sfx.close(); setWalletOpen(false) }}>✕</button>
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
                  Connect your Phantom wallet to secure your account and receive
                  <b> $ESTATE</b> withdrawals when the token goes live.
                </p>
                <button className="primary" onClick={() => { sfx.click(); onConnectWallet() }} disabled={connecting}>
                  {connecting ? 'Connecting…' : 'Connect Phantom'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
