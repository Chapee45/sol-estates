// Understated audio — soft, low-volume cues, no arcade beeps.
// All SFX synthesized with WebAudio; music is the Suno-generated theme loop.

let ctx = null
const AC = () => (ctx ??= new (window.AudioContext || window.webkitAudioContext)())

let sfxOn = true
let musicOn = true
let audio = null

export function setSfx(v) { sfxOn = v }
export function setMusic(v) {
  musicOn = v
  if (audio) { v ? audio.play().catch(() => {}) : audio.pause() }
}
export const getSfx = () => sfxOn
export const getMusic = () => musicOn

function tone(freq, dur, type = 'sine', vol = 0.04, delay = 0) {
  if (!sfxOn) return
  try {
    const ac = AC()
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, ac.currentTime + delay)
    g.gain.setValueAtTime(0.0001, ac.currentTime + delay)
    g.gain.linearRampToValueAtTime(vol, ac.currentTime + delay + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + delay + dur)
    o.connect(g); g.connect(ac.destination)
    o.start(ac.currentTime + delay)
    o.stop(ac.currentTime + delay + dur + 0.05)
  } catch { /* audio unavailable */ }
}

// A soft, felt-like tick made from a fast-decaying low sine
const tick = (f = 640, vol = 0.028) => tone(f, 0.045, 'sine', vol)

export const sfx = {
  click:   () => tick(620),
  open:    () => tick(420, 0.024),
  buy:     () => { tone(392, 0.16, 'sine', 0.045); tone(587, 0.22, 'sine', 0.04, 0.09) },
  collect: () => { tone(523, 0.1, 'sine', 0.035); tone(659, 0.14, 'sine', 0.03, 0.06) },
  upgrade: () => { tone(330, 0.12, 'sine', 0.04); tone(494, 0.16, 'sine', 0.035, 0.08) },
  levelup: () => [392, 494, 587].forEach((f, i) => tone(f, 0.22, 'sine', 0.045, i * 0.12)),
  error:   () => tone(160, 0.14, 'sine', 0.045),
  bid:     () => tick(540, 0.03),
  win:     () => [440, 554, 659].forEach((f, i) => tone(f, 0.2, 'sine', 0.04, i * 0.1)),
  sell:    () => { tick(500, 0.03); tick(380, 0.026) },
  hire:    () => { tone(349, 0.12, 'sine', 0.04); tone(440, 0.16, 'sine', 0.035, 0.08) },
  sign:    () => { tick(300, 0.03); tone(494, 0.2, 'sine', 0.035, 0.1) },
}

export function initMusic(url) {
  if (audio) return
  audio = new Audio(url)
  audio.loop = true
  audio.volume = 0.25
  if (musicOn) audio.play().catch(() => { /* waits for user gesture */ })
}

// Browsers block autoplay until a gesture — call this on any click
export function kickMusic() {
  if (audio && musicOn && audio.paused) audio.play().catch(() => {})
}
