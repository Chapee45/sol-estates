// Character art registry — portraits generated with KIE nano banana.
import mike from './assets/mogul-mike.webp'
import ray from './assets/mgr-ray.webp'
import vera from './assets/mgr-vera.webp'
import don from './assets/mgr-don.webp'

export const CHAR_ART = { mike, ray, vera, don }
export const CHAR_NAMES = {
  mike: 'Mogul Mike',
  ray: 'Ray the Rookie',
  vera: 'Vera the Closer',
  don: 'Don Marble',
}

// One-liners the characters drop when events happen
export const CHAR_LINES = {
  hire: {
    ray:  "Boss! I won't let you down. Rent's getting collected if I have to knock myself.",
    vera: 'Consider it handled. The books will be spotless.',
    don:  'A fine acquisition. My tenants pay on the first — always have.',
  },
  auctionWin: 'SOLD! That gavel sound never gets old. Beautiful piece of business.',
  outbid: "We got outbid?! Shake it off — there's always another deal on the block.",
  capWarning: 'Psst — your yield stalled at the 8-hour cap. Staff your properties and they earn while you sleep.',
}
