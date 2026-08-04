import { TIER_META, RARITY_META, blockPriceFor, fmt, fmtB } from './economy.js'
import { rivalBid, minRaise, fmtCountdown, MARKETPLACE_LEVEL } from './state.js'
import { sfx } from './sound.js'

export default function Marketplace({
  open, tab, setTab, onClose, level, block, now,
  auctions, myBids, onBid, ownedList, onInstantSell, onFly,
}) {
  if (!open) return null
  const locked = level < MARKETPLACE_LEVEL
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal market" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Marketplace</h3>
          <button className="close-flat" onClick={onClose}>✕</button>
        </div>
        {locked ? (
          <div className="market-locked">
            <span className="big-lock">·</span>
            <p>The Marketplace unlocks at <b>Level {MARKETPLACE_LEVEL}</b>.<br />Buy and upgrade properties to level up.</p>
          </div>
        ) : (
          <>
            <div className="tabs">
              <button className={tab === 'auctions' ? 'tab on' : 'tab'} onClick={() => { sfx.click(); setTab('auctions') }}>Auctions</button>
              <button className={tab === 'sell' ? 'tab on' : 'tab'} onClick={() => { sfx.click(); setTab('sell') }}>Sell</button>
            </div>

            {tab === 'auctions' && (
              <div className="market-list">
                <p className="market-note">Notable properties from your travels go under the hammer every hour. Outbid rivals with ◈ $BLOCK. <span className="muted">(Rival bids are simulated until multiplayer goes live.)</span></p>
                {auctions.length === 0 && <p className="muted">Explore the map to discover properties — auctions pull from places you've seen.</p>}
                {auctions.map(a => {
                  const mine = myBids[a.key]
                  const rival = rivalBid(a, now)
                  const top = Math.max(rival, mine?.amount || 0)
                  const leading = mine && mine.amount >= rival
                  const raise = minRaise(top)
                  const meta = TIER_META[a.poi.tier] || TIER_META.shop
                  const rar = RARITY_META[a.poi.rarity]
                  return (
                    <div key={a.key} className="auction-row">
                      <button className="auction-info" onClick={() => onFly(a.poi)}>
                        <span className="auction-emoji">{meta.emoji}</span>
                        <span className="auction-text">
                          <b>{a.poi.name}</b>
                          <small><span style={{ color: rar.color }}>{rar.label}</span> · {meta.label} · valued ~◈{fmt(a.value)}</small>
                        </span>
                      </button>
                      <div className="auction-side">
                        <div className="auction-bidline">
                          <b className={leading ? 'lead' : 'outbid'}>◈{fmt(top)}</b>
                          <small>{leading ? 'Leading' : mine ? 'Outbid' : 'Top bid'}</small>
                        </div>
                        <div className="auction-actions">
                          <span className="countdown">{fmtCountdown(a.endsAt - now)}</span>
                          <button className="bid-btn" disabled={block < raise} onClick={() => onBid(a, raise)}>
                            Bid ◈{fmt(raise)}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {tab === 'sell' && (
              <div className="market-list">
                <p className="market-note">Instant-sell to the registry at <b>65%</b> of value in ◈, releasing a permit. Player-to-player listings arrive with multiplayer.</p>
                {ownedList.length === 0 && <p className="muted">You don't own anything yet.</p>}
                {ownedList.map(p => {
                  const meta = TIER_META[p.tier] || TIER_META.shop
                  const offer = Math.max(1, Math.round(blockPriceFor(p.price) * 0.65))
                  return (
                    <div key={p.id} className="auction-row">
                      <button className="auction-info" onClick={() => onFly(p)}>
                        <span className="auction-emoji">{meta.emoji}</span>
                        <span className="auction-text">
                          <b>{p.name}</b>
                          <small>{meta.label} · {p.ups} improvements</small>
                        </span>
                      </button>
                      <div className="auction-side">
                        <button className="sell-btn" onClick={() => onInstantSell(p, offer)}>Sell ◈{fmt(offer)}</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
