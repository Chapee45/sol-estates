import { MANAGERS, managerCostFor, fmt, BLOCK_SYM } from './economy.js'
import { CHAR_ART } from './characters.js'
import { sfx } from './sound.js'

// Choose a property manager — three characters, three tiers.
export default function StaffModal({ propId, prop, block, onHire, onClose }) {
  if (!propId || !prop) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Appoint a manager</h3>
          <button className="close-flat" onClick={() => { sfx.close(); onClose() }}>✕</button>
        </div>
        <p className="market-note">
          A manager runs <b>{prop.name}</b> around the clock — no 8-hour cap, rent
          collected automatically, plus their personal touch on the yield.
        </p>
        <div className="staff-list">
          {Object.entries(MANAGERS).map(([key, m]) => {
            const cost = managerCostFor(prop.price, key)
            return (
              <div key={key} className="staff-row">
                <img className="staff-pfp" src={CHAR_ART[key]} alt={m.name} />
                <div className="staff-text">
                  <b>{m.name}</b>
                  <small>{m.blurb}</small>
                  <span className="staff-bonus">+{Math.round((m.bonus - 1) * 100)}% yield · auto-collect</span>
                </div>
                <button className="bid-btn" disabled={block < cost} onClick={() => onHire(propId, key)}>
                  {BLOCK_SYM}{fmt(cost)}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
