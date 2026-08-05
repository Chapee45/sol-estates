// Phantom wallet (Solana) integration.
// Uses the injected provider — no SDK needed for connect/identity.

export function getPhantom() {
  if (window.phantom?.solana?.isPhantom) return window.phantom.solana
  if (window.solana?.isPhantom) return window.solana
  return null
}

export const isMobile = () => /android|iphone|ipad|ipod/i.test(navigator.userAgent)

// Reopen the game inside Phantom's in-app browser, where the wallet is
// injected. The ?phantom=connect flag lets App.jsx resume the connect there.
export function openInPhantomApp() {
  const url = new URL(window.location.href)
  url.searchParams.set('phantom', 'connect')
  window.location.href =
    `https://phantom.app/ul/browse/${encodeURIComponent(url.toString())}` +
    `?ref=${encodeURIComponent(window.location.origin)}`
}

// Phantom's in-app browser can inject the provider after our scripts run.
export async function waitForPhantom(ms = 3000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const p = getPhantom()
    if (p) return p
    await new Promise((r) => setTimeout(r, 100))
  }
  return null
}

export async function connectPhantom() {
  const provider = getPhantom()
  if (!provider) {
    if (isMobile()) {
      openInPhantomApp()
      throw new Error('Opening the Phantom app… finish connecting there.')
    }
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
