// Phantom wallet (Solana) integration.
// Uses the injected provider — no SDK needed for connect/identity.

export function getPhantom() {
  if (window.phantom?.solana?.isPhantom) return window.phantom.solana
  if (window.solana?.isPhantom) return window.solana
  return null
}

export async function connectPhantom() {
  const provider = getPhantom()
  if (!provider) {
    window.open('https://phantom.app/', '_blank')
    throw new Error('Phantom not detected. Install the extension, then refresh and try again.')
  }
  const res = await provider.connect()
  return res.publicKey.toString()
}

export function disconnectPhantom() {
  try { getPhantom()?.disconnect() } catch { /* best effort */ }
}

export const shortAddr = (a) => (a ? a.slice(0, 4) + '…' + a.slice(-4) : '')
