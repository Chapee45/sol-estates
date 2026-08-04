// SOL ESTATES audio — deep, tactile UI sounds. Physical clicks (filtered
// noise "thocks") layered over low sine thuds; nothing shrill, nothing arcade.
// Music: the Sol Estates Lounge loop. All SFX synthesized, no assets.

let ctx = null
const AC = () => (ctx ??= new (window.AudioContext || window.webkitAudioContext)())

let sfxOn = true
export function setSfx(v) { sfxOn = v }
export const getSfx = () => sfxOn

let musicOn = true
let audio = null
export function setMusic(v) {
  musicOn = v
  if (audio) { v ? audio.play().catch(() => {}) : audio.pause() }
}
export const getMusic = () => musicOn
export function initMusic(url) {
  if (audio) return
  audio = new Audio(url)
  audio.loop = true
  audio.volume = 0.22
  if (musicOn) audio.play().catch(() => { /* waits for user gesture */ })
}
export function kickMusic() {
  if (audio && musicOn && audio.paused) audio.play().catch(() => {})
}

// --- building blocks ---------------------------------------------------

let noiseBuf = null
function getNoise(ac) {
  if (noiseBuf) return noiseBuf
  const len = ac.sampleRate * 0.1
  noiseBuf = ac.createBuffer(1, len, ac.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  return noiseBuf
}

// A short filtered noise burst — the "thock" of a physical switch
function clickBurst(vol = 0.09, freq = 1100, dur = 0.03, delay = 0) {
  if (!sfxOn) return
  try {
    const ac = AC()
    const src = ac.createBufferSource()
    src.buffer = getNoise(ac)
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = freq
    bp.Q.value = 1.2
    const g = ac.createGain()
    g.gain.setValueAtTime(vol, ac.currentTime + delay)
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + delay + dur)
    src.connect(bp); bp.connect(g); g.connect(ac.destination)
    src.start(ac.currentTime + delay)
    src.stop(ac.currentTime + delay + dur + 0.02)
  } catch { /* audio unavailable */ }
}

// A low, round thud with a slight pitch drop
function thud(freq, dur = 0.09, vol = 0.07, delay = 0, drop = 0.75) {
  if (!sfxOn) return
  try {
    const ac = AC()
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(freq, ac.currentTime + delay)
    o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * drop), ac.currentTime + delay + dur)
    g.gain.setValueAtTime(0.0001, ac.currentTime + delay)
    g.gain.linearRampToValueAtTime(vol, ac.currentTime + delay + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + delay + dur)
    o.connect(g); g.connect(ac.destination)
    o.start(ac.currentTime + delay)
    o.stop(ac.currentTime + delay + dur + 0.05)
  } catch { /* audio unavailable */ }
}

// Low warm note (no pitch drop) for confirmations
function note(freq, dur = 0.14, vol = 0.06, delay = 0) {
  if (!sfxOn) return
  try {
    const ac = AC()
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'triangle'
    o.frequency.setValueAtTime(freq, ac.currentTime + delay)
    g.gain.setValueAtTime(0.0001, ac.currentTime + delay)
    g.gain.linearRampToValueAtTime(vol, ac.currentTime + delay + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + delay + dur)
    o.connect(g); g.connect(ac.destination)
    o.start(ac.currentTime + delay)
    o.stop(ac.currentTime + delay + dur + 0.05)
  } catch { /* audio unavailable */ }
}

// --- palette ------------------------------------------------------------

let lastHover = 0

export const sfx = {
  // barely-there tick for hover — heavily throttled
  hover: () => {
    const t = performance.now()
    if (t - lastHover < 70) return
    lastHover = t
    clickBurst(0.028, 850, 0.018)
  },
  // generic UI — switch thocks
  click:  () => { clickBurst(0.1, 1150, 0.028); thud(190, 0.05, 0.045) },
  open:   () => { clickBurst(0.07, 950, 0.03); thud(230, 0.09, 0.055, 0.01, 0.85) },
  close:  () => { clickBurst(0.06, 800, 0.03); thud(165, 0.1, 0.055) },
  select: () => { clickBurst(0.07, 1350, 0.022); thud(240, 0.045, 0.035) },
  plop:   () => thud(260, 0.13, 0.1, 0, 0.45), // pin drop
  // economy — low, warm confirmations
  buy:     () => { [196, 262, 330].forEach((f, i) => note(f, 0.16, 0.075, i * 0.075)); clickBurst(0.06, 900, 0.03) },
  collect: () => { note(330, 0.1, 0.06); note(392, 0.14, 0.06, 0.07); clickBurst(0.05, 1200, 0.025) },
  upgrade: () => [165, 220, 262].forEach((f, i) => note(f, 0.13, 0.07, i * 0.07)),
  sell:    () => { note(392, 0.09, 0.065); note(262, 0.18, 0.07, 0.08) },
  bid:     () => { clickBurst(0.08, 1000, 0.028); thud(210, 0.06, 0.05, 0.05) },
  win:     () => [262, 330, 392, 523].forEach((f, i) => note(f, 0.16, 0.07, i * 0.09)),
  hire:    () => [196, 247, 330].forEach((f, i) => note(f, 0.13, 0.065, i * 0.07)),
  sign:    () => { clickBurst(0.06, 700, 0.04); clickBurst(0.06, 750, 0.04, 0.09); note(330, 0.18, 0.065, 0.2) },
  levelup: () => [196, 262, 330, 392, 523].forEach((f, i) => note(f, 0.2, 0.07, i * 0.09)),
  error:   () => { thud(120, 0.14, 0.07, 0, 0.8); clickBurst(0.05, 500, 0.05) },
}
