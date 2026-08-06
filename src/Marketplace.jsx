import { TIER_META, RARITY_META, fmt, CASH_SYM, BLOCK_SYM } from './economy.js'
import { rivalBid, minRaise, fmtCountdown, MARKETPLACE_LEVEL } from './state.js'
import { sellQuote, marketPrice } from './market.js'
import { sfx } from './sound.js'

export default function Marketplace({
  open, tab, setTab, onClose, level, cash, block, now,
  auctions, myBids, onBid, ownedList, onInstantSell, onFly,
  listings, onBuyListing,
}) {
  if (!open) return null
  const locked = level < MARKETPLACE_LEVEL
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal market" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Marketplace</h3>
          <button className="close-flat" onClick={() => { sfx.close(); onClose() }}>✕</button>
        </div>
        {locked ? (
          <div className="market-locked">
            <span className="big-lock">·</span>
            <p>The Marketplace unlocks at <b>Level {MARKETPLACE_LEVEL}</b>.<br />Buy and upgrade properties to level up.</p>
          </div>
        ) : (
          <>
            <div className="tabs">
              <button className={tab === 'global' ? 'tab on' : 'tab'} onClick={() => { sfx.click(); setTab('global') }}>Global</button>
              <button className={tab === 'auctions' ? 'tab on' : 'tab'} onClick={() => { sfx.click(); setTab('auctions') }}>Auctions</button>
              <button className={tab === 'sell' ? 'tab on' : 'tab'} onClick={() => { sfx.click(); setTab('sell') }}>Sell</button>
            </div>

            {tab === 'global' && (
              <div className="market-list">
                <p className="market-note">
                  Landlords worldwide list properties here — many <b>below live market value</b>, which is the whole
                  point of buying player-to-player instead of paying the registry full price.
                  Listings rotate every hour. <span className="muted">(Sellers are simulated until multiplayer goes live — then this board is real players.)</span>
                </p>
                {listings.map(l => {
                  const meta = TIER_META[l.tier] || TIER_META.shop
                  const rar = RARITY_META[l.rarity]
                  const ownedAlready = ownedList.some(p => p.id === l.id)
                  return (
                    <div key={l.id} className="auction-row">
                      <button className="auction-info" onClick={() => { sfx.select(); onFly(l) }}>
                        <span className="auction-emoji">{meta.emoji}</span>
                        <span className="auction-text">
                          <b>{l.name}</b>
                          <small>
                            <span style={{ color: rar.color }}>{rar.label}</span> · {meta.label} · listed by {l.seller}
                            {l.deal > 3 && <span className="deal-tag"> ▼{l.deal}% below market</span>}
                            {l.deal < -3 && <span className="premium-tag"> ▲{-l.deal}% above market</span>}
                          </small>
                        </span>
                      </button>
                      <div className="auction-side">
                        <div className="auction-bidline">
                          <b>{CASH_SYM}{fmt(l.ask)}</b>
                          <small>market {CASH_SYM}{fmt(l.live)}</small>
                        </div>
                        <div className="auction-actions">
                          <button className="bid-btn" disabled={ownedAlready || cash < l.ask} onClick={() => onBuyListing(l)}>
                            {ownedAlready ? 'Owned' : 'Buy'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {tab === 'auctions' && (
              <div className="market-list">
                <p className="market-note">Notable properties from your travels go under the hammer every hour. Outbid rivals with ◈ $ESTATE. <span className="muted">(Rival bids are simulated until multiplayer goes live.)</span></p>
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
                      <button className="auction-info" onClick={() => { sfx.select(); onFly(a.poi) }}>
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
                <p className="market-note">The registry buys instantly at <b>85% of live market value</b>, paid in {CASH_SYM} CASH — a permit comes free. Listing to other players at full price arrives with multiplayer.</p>
                {ownedList.length === 0 && <p className="muted">You don't own anything yet.</p>}
                {ownedList.map(p => {
                  const meta = TIER_META[p.tier] || TIER_META.shop
                  const quote = sellQuote(p, now)
                  const live = marketPrice(p, now)
                  const paid = p.paid ?? p.price
                  const pl = Math.round(((live - paid) / paid) * 100)
                  return (
                    <div key={p.id} className="auction-row">
                      <button className="auction-info" onClick={() => { sfx.select(); onFly(p) }}>
                        <span className="auction-emoji">{meta.emoji}</span>
                        <span className="auction-text">
                          <b>{p.name}</b>
                          <small>
                            market {CASH_SYM}{fmt(live)} ·{' '}
                            <span style={{ color: pl >= 0 ? 'var(--green)' : 'var(--red)' }}>{pl >= 0 ? '▲' : '▼'}{Math.abs(pl)}% vs paid</span>
                            {' '}· {p.ups} improvements
                          </small>
                        </span>
                      </button>
                      <div className="auction-side">
                        <button className="sell-btn" onClick={() => onInstantSell(p)}>Sell {CASH_SYM}{fmt(quote)}</button>
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
