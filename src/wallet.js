// Phantom wallet (Solana) integration.
// Desktop uses the injected provider; mobile uses Phantom's connect deeplink
// protocol — straight into the app's approval sheet, then back to the browser
// with the wallet address (encrypted to our session keypair).

import nacl from 'tweetnacl'
import bs58 from 'bs58'

export function getPhantom() {
  if (window.phantom?.solana?.isPhantom) return window.phantom.solana
  if (window.solana?.isPhantom) return window.solana
  return null
}

export const isMobile = () => /android|iphone|ipad|ipod/i.test(navigator.userAgent)

// x25519 keypair Phantom encrypts its deeplink responses to. Persisted so the
// return trip (a fresh page load) can still decrypt.
const DL_KEY = 'phantom-deeplink-kp-v1'
function dappKeyPair() {
  try {
    const s = JSON.parse(localStorage.getItem(DL_KEY))
    if (s?.pk && s?.sk) return { publicKey: bs58.decode(s.pk), secretKey: bs58.decode(s.sk) }
  } catch { /* regenerate below */ }
  const kp = nacl.box.keyPair()
  localStorage.setItem(DL_KEY, JSON.stringify({ pk: bs58.encode(kp.publicKey), sk: bs58.encode(kp.secretKey) }))
  return kp
}

// Open the Phantom app directly on its Connect approval — no in-app browser,
// no phantom.app interstitial. Phantom redirects back to us with the address.
export function openPhantomConnect() {
  const back = new URL(window.location.href)
  back.searchParams.set('phantom', 'return')
  const q = new URLSearchParams({
    app_url: window.location.origin,
    dapp_encryption_public_key: bs58.encode(dappKeyPair().publicKey),
    redirect_link: back.toString(),
    cluster: 'mainnet-beta',
  })
  window.location.href = `phantom://v1/connect?${q}`
  // Download page only if Phantom never took over. The timer is suspended
  // while the app is foregrounded, so it can fire late on our return —
  // visibilitychange records that the app did open and cancels the fallback.
  let left = false
  const mark = () => { if (document.hidden) left = true }
  document.addEventListener('visibilitychange', mark)
  setTimeout(() => {
    document.removeEventListener('visibilitychange', mark)
    if (!left && !document.hidden) window.location.href = 'https://phantom.app/download'
  }, 2500)
}

// Parse ?phantom=return&... when Phantom bounces back after approval.
// Returns null (not a Phantom return), {address} or {error}.
export function handlePhantomReturn() {
  const q = new URLSearchParams(window.location.search)
  if (q.get('phantom') !== 'return') return null
  if (q.get('errorCode')) return { error: q.get('errorMessage') || 'Phantom connection was cancelled.' }
  const pk = q.get('phantom_encryption_public_key')
  const nonce = q.get('nonce')
  const data = q.get('data')
  if (!pk || !nonce || !data) return null
  try {
    const shared = nacl.box.before(bs58.decode(pk), dappKeyPair().secretKey)
    const opened = nacl.box.open.after(bs58.decode(data), bs58.decode(nonce), shared)
    if (!opened) return { error: 'Could not verify Phantom’s response — try connecting again.' }
    return { address: JSON.parse(new TextDecoder().decode(opened)).public_key }
  } catch {
    return { error: 'Could not read Phantom’s response — try connecting again.' }
  }
}

export async function connectPhantom() {
  const provider = getPhantom()
  if (!provider) {
    if (isMobile()) {
      openPhantomConnect()
      throw new Error('Opening Phantom — approve the connection there.')
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
