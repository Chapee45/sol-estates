import { useEffect, useState } from 'react'
import avatar from './assets/mogul-mike.png'
import { fmt } from './economy.js'

// Placeholder character — name TBD per Luca
export const MENTOR_NAME = 'Mogul Mike'

// mode 'dialog' = story step. mode 'buy' = waits for the guided first purchase.
// target = CSS selector of the UI element to spotlight; the bubble docks next
// to it. No target → full-screen blur with the big-avatar layout.
export const TUT_STEPS = [
  { mode: 'dialog', text: () => "Yo! Welcome to SOL ESTATES. See this map? That's YOUR neighborhood — real streets, real buildings, live from the real world. And it's all for sale." },
  { mode: 'dialog', text: () => "Every badge is a real place. The ring is its rarity — gray Common, blue Rare, violet Epic… gold LEGENDARY. Rarer = pricier = pays way more." },
  { mode: 'dialog', target: '[data-tut="money"]', text: () => "Your two currencies: $ CASH builds the empire, ◈ $BLOCK is the real crypto token — straight to your Phantom wallet. Every property earns BOTH." },
  { mode: 'dialog', text: () => "Enough talk. Rule #1 of real estate: your first deal should be CHEAP. Let me find you a bargain nobody owns yet… follow me!" },
  {
    mode: 'buy',
    target: '[data-tut="buy"]',
    text: (ctx) => ctx.starter
      ? `THIS one — ${ctx.starter.name}. Just $${fmt(ctx.starter.price)}, and it's unowned. Underpriced, honest little earner, perfect first deal. Hit Acquire and put your signature on the deed!`
      : 'Hold up… scanning the neighborhood for a bargain…',
  },
  { mode: 'dialog', target: '[data-tut="manager"]', text: () => "YESSS! 🎉 You're an owner — it's earning right now. But see this bar? No manager = rent STOPS after 8 hours. Managers (Level 5) collect forever, +10% yield." },
  { mode: 'dialog', target: '[data-tut="permits"]', text: () => "Your permits. You can only HOLD so many properties — level up (or spend ◈) for more. Levels also unlock better tiers… landmarks at Level 8." },
  { mode: 'dialog', target: '[data-tut="market"]', text: () => "The Marketplace — opens at Level 3. Hourly auctions on hot properties, and instant-sell when you need ◈ or permits back." },
  { mode: 'dialog', target: '[data-tut="collect"]', text: () => "And THIS is the money button. Rent piles up here — collect, reinvest, repeat. Build the biggest empire on the planet. Now get to work! 💼" },
]

export default function Tutorial({ step, ctx, onNext, onSkip }) {
  const def = TUT_STEPS[step]
  const [rect, setRect] = useState(null)

  // Track the highllighted element's position (it can move/animate)
  useEffect(() => {
    if (!def.target) { setRect(null); return }
    let alive = true
    const measure = () => {
      if (!alive) return
      const el = document.querySelector(def.target)
      if (!el) { setRect(null); return }
      const r = el.getBoundingClientRect()
      if (r.width < 2) { setRect(null); return }
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom })
    }
    measure()
    const iv = setInterval(measure, 300)
    window.addEventListener('resize', measure)
    return () => { alive = false; clearInterval(iv); window.removeEventListener('resize', measure) }
  }, [step, def.target])

  const last = step >= TUT_STEPS.length - 1
  const buying = def.mode === 'buy'

  const controls = (
    <div className="tut-controls">
      <div className="tut-dots">
        {TUT_STEPS.map((_, i) => <span key={i} className={i === step ? 'on' : ''} />)}
      </div>
      <div className="tut-btns">
        {!last && <button className="tut-skip" onClick={onSkip}>Skip</button>}
        {buying
          ? <span className="tut-wait">👆 buy it to continue</span>
          : <button className="tut-next" onClick={onNext}>{last ? "Let's go 🚀" : 'Next'}</button>}
      </div>
    </div>
  )

  // Anchored coach-mark layout: spotlight + bubble docked to the target
  if (rect) {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const BW = Math.min(360, vw - 16)
    const below = rect.bottom < vh * 0.55
    const left = Math.max(8, Math.min(rect.left, vw - BW - 8))
    const bubbleStyle = below
      ? { top: rect.bottom + 16, left, width: BW }
      : { bottom: vh - rect.top + 16, left, width: BW }
    return (
      <>
        <div
          className="tut-spot"
          style={{ top: rect.top - 7, left: rect.left - 7, width: rect.width + 14, height: rect.height + 14 }}
        />
        <div className={'tut-anchored' + (below ? ' from-top' : ' from-bottom')} style={bubbleStyle} key={step}>
          <div className="tut-head">
            <img src={avatar} alt={MENTOR_NAME} />
            <span className="tut-name">{MENTOR_NAME} <span className="tut-name-note">· your mentor</span></span>
          </div>
          <p className="tut-text">{def.text(ctx)}</p>
          {controls}
        </div>
      </>
    )
  }

  // Default layout: big avatar bottom-left (full-screen blur handled by Game)
  return (
    <div className="tut">
      <img className="tut-avatar" src={avatar} alt={MENTOR_NAME} />
      <div className="tut-bubble">
        <div className="tut-name">{MENTOR_NAME} <span className="tut-name-note">· your mentor</span></div>
        <p className="tut-text">{def.text(ctx)}</p>
        {controls}
      </div>
    </div>
  )
}
