import { sfx } from './sound.js'

export default function SettingsModal({ open, onClose, settings, onToggle, onLogout, onReset, player }) {
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal settings" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Settings</h3>
          <button className="close-flat" onClick={onClose}>✕</button>
        </div>
        <div className="setting-row">
          <span>Music</span>
          <button className={settings.music ? 'toggle on' : 'toggle'} onClick={() => onToggle('music')}>
            <span className="knob" />
          </button>
        </div>
        <div className="setting-row">
          <span>Sound effects</span>
          <button className={settings.sfx ? 'toggle on' : 'toggle'} onClick={() => onToggle('sfx')}>
            <span className="knob" />
          </button>
        </div>
        <div className="setting-row">
          <span>{player.mode === 'phantom' ? 'Wallet connected' : 'Developer session'}</span>
          <button className="mini-btn" onClick={() => { sfx.click(); onLogout() }}>Disconnect</button>
        </div>
        <div className="setting-row danger">
          <span>Reset progress</span>
          <button className="mini-btn danger-btn" onClick={onReset}>Reset</button>
        </div>
        <p className="settings-foot">SOL ESTATES <span className="muted">· pre-alpha · $BLOCK on Solana</span></p>
      </div>
    </div>
  )
}
