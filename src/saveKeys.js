// Storage namespaces. The studio (creator) build keeps ENTIRELY separate
// saves from the live game — balances, profile, progress — so test footage
// can never contaminate a real account and vice versa.
const NS = import.meta.env.VITE_STUDIO ? '-studio' : ''

export const SAVE_KEY = `blocklord-save${NS}-v1`
export const PLAYER_KEY = `blocklord-player${NS}-v1`

// The $ESTATE contract address — placeholder until the pump.fun launch.
export const CONTRACT_ADDRESS = null
export const CA_PLACEHOLDER = 'TBA — dropping at launch'
