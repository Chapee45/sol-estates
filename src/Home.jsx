import { useMemo, useRef, useState } from 'react'
import logo from './assets/logo-sol.png'
import bg from './assets/home-bg.png'
import { sfx, setSfx, setMusic } from './sound.js'
import { fmtB, fmt, BLOCK_SYM, CASH_SYM, cashPerHour, managerBonus } from './economy.js'
import { shortAddr } from './wallet.js'
import { levelFromXp, rankForLevel } from './state.js'

const EMOJI_PFPS = ['🤑', '😎', '🦈', '👑', '🐺', '🚀', '💼', '🏗️', '🧱', '🐉', '🦁', '💎']

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
  { name: 'BrickzillaNYC', pfp: '🦖', rev: 48200 },
  { name: 'DubaiWhale', pfp: '🐋', rev: 31500 },
  { name: 'LandLadyLiz', pfp: '💅', rev: 19800 },
  { name: 'TokyoTycoon', pfp: '🗼', rev: 12400 },
  { name: 'SirBricksalot', pfp: '🎩', rev: 8600 },
  { name: 'CryptoKeith', pfp: '🤓', rev: 4100 },
  { name: 'PixelLandlord', pfp: '👾', rev: 2300 },
  { name: 'MortgageMolly', pfp: '🏡', rev: 950 },
  { name: 'CouchInvestor', pfp: '🛋️', rev: 210 },
]

export default function Home({ player, onPlay, onCreateProfile, onConnectWallet, connecting, error }) {
  const [modal, setModal] = useState(null) // 'profile' | 'token' | 'wallet' | 'settings' | 'account' | 'leaders'
  const [name, setName] = useState('')
  const [pfp, setPfp] = useState({ type: 'emoji', value: '🤑' })
  const fileRef = useRef(null)
  const nameOk = /^[a-zA-Z0-9_ ]{3,16}$/.test(name.trim())

  const save = readSave()
  const estate = save.block ?? 0
  const [settings, setSettings] = useState(save.settings ?? { music: true, sfx: true })
  const connected = !!player?.address
  const level = levelFromXp(save.xp ?? 0)

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
    if (k === 'sfx') setSfx(next.sfx)
    if (k === 'music') setMusic(next.music)
  }

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
    else setModal('profile')
  }

  const open = (m) => { sfx.open(); setModal(m) }
  const close = () => { sfx.close(); setModal(null) }

  return (
    <div className="home" style={{ backgroundImage: `url(${bg})` }}>
      <div className="home-sky-tint" />

      <div className="home-inner menu">
        <img className="home-mark" src={logo} alt="Sol Estates" />

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
              <h3>👛 Wallet</h3>
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
            <div className="setting-row">
              <span>Music</span>
              <button className={settings.music ? 'toggle on' : 'toggle'} onClick={() => toggleSetting('music')}>
                <span className="knob" />
              </button>
            </div>
            <div className="setting-row">
              <span>Sound effects</span>
              <button className={settings.sfx ? 'toggle on' : 'toggle'} onClick={() => toggleSetting('sfx')}>
                <span className="knob" />
              </button>
            </div>
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
