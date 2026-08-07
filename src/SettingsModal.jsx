import { sfx } from './sound.js'

// Shared audio/theme controls — used by the in-game settings modal and the
// home-menu settings modal so the two stay identical.
export function GameSettings({ settings, onToggle, onSet }) {
  const row = (label, key, volKey) => (
    <>
      <div className="setting-row">
        <span>{label}</span>
        <button className={settings[key] ? 'toggle on' : 'toggle'} onClick={() => onToggle(key)}>
          <span className="knob" />
        </button>
      </div>
      {volKey && settings[key] && (
        <div className="setting-row slider-row">
          <input
            type="range"
            min="0" max="1" step="0.05"
            value={settings[volKey] ?? 0.5}
            onChange={e => onSet(volKey, parseFloat(e.target.value))}
            onPointerUp={() => sfx.click()}
          />
        </div>
      )}
    </>
  )
  return (
    <>
      {row('Music', 'music', 'musicVol')}
      {row('Sound effects', 'sfx', 'sfxVol')}
      {row('City ambience', 'ambience', 'ambVol')}
      <div className="setting-row">
        <span>Night mode 🌙</span>
        <button className={settings.night ? 'toggle on' : 'toggle'} onClick={() => onToggle('night')}>
          <span className="knob" />
        </button>
      </div>
    </>
  )
}

// Studio-only creator tools — compiled in ONLY when the build sets
// VITE_STUDIO (the hidden test deployment). Absent from the public bundle.
function CreatorTools({ onDevSet }) {
  const grab = (id) => {
    const el = document.getElementById(id)
    const v = parseFloat(el?.value)
    if (el) el.value = ''
    return v
  }
  return (
    <div className="creator-tools">
      <div className="hc-title">🎬 Creator Tools</div>
      <div className="ct-row">
        <input id="ct-cash" type="number" placeholder="Cash" />
        <input id="ct-est" type="number" placeholder="ESTATE" />
        <input id="ct-lvl" type="number" placeholder="Level" min="1" max="30" />
      </div>
      <div className="ct-row">
        <button className="mini-btn" onClick={() => { sfx.click(); onDevSet({ cash: grab('ct-cash'), block: grab('ct-est'), level: grab('ct-lvl') }) }}>Apply</button>
        <button className="mini-btn" onClick={() => { sfx.buy(); onDevSet({ cash: 999999999, block: 999999999 }) }}>💰 Max balances</button>
      </div>
    </div>
  )
}

export default function SettingsModal({ open, onClose, settings, onToggle, onSet, onLogout, onReset, player, onDevSet }) {
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal settings" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Settings</h3>
          <button className="close-flat" onClick={() => { sfx.close(); onClose() }}>✕</button>
        </div>
        {import.meta.env.VITE_STUDIO && onDevSet && <CreatorTools onDevSet={onDevSet} />}
        <GameSettings settings={settings} onToggle={onToggle} onSet={onSet} />
        <div className="setting-row">
          <span>{player.mode === 'phantom' ? 'Wallet connected' : 'Developer session'}</span>
          <button className="mini-btn" onClick={() => { sfx.click(); onLogout() }}>Disconnect</button>
        </div>
        <div className="setting-row danger">
          <span>Reset progress</span>
          <button className="mini-btn danger-btn" onClick={() => { sfx.click(); onReset() }}>Reset</button>
        </div>
        <p className="settings-foot">SOL ESTATES <span className="muted">· pre-alpha · $ESTATE on Solana</span></p>
      </div>
    </div>
  )
}
