// SOL ESTATES sound effects — playful synthesized pops for every interaction.
// No music track; SFX only (toggle in settings). All WebAudio, no assets.

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

function tone(freq, dur, type = 'triangle', vol = 0.06, delay = 0, slideTo = 0) {
  if (!sfxOn) return
  try {
    const ac = AC()
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, ac.currentTime + delay)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), ac.currentTime + delay + dur)
    g.gain.setValueAtTime(0.0001, ac.currentTime + delay)
    g.gain.linearRampToValueAtTime(vol, ac.currentTime + delay + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + delay + dur)
    o.connect(g); g.connect(ac.destination)
    o.start(ac.currentTime + delay)
    o.stop(ac.currentTime + delay + dur + 0.05)
  } catch { /* audio unavailable */ }
}

export const sfx = {
  // generic UI
  click:   () => tone(700, 0.06, 'triangle', 0.06),
  open:    () => { tone(520, 0.06, 'triangle', 0.06); tone(680, 0.07, 'triangle', 0.06, 0.05) },
  close:   () => { tone(640, 0.06, 'triangle', 0.055); tone(460, 0.08, 'triangle', 0.055, 0.05) },
  select:  () => tone(880, 0.05, 'square', 0.04),
  plop:    () => tone(340, 0.12, 'sine', 0.09, 0, 170), // pin drop
  // economy
  buy:     () => [523, 659, 784].forEach((f, i) => tone(f, 0.11, 'triangle', 0.08, i * 0.07)),
  collect: () => { tone(988, 0.07, 'square', 0.05); tone(1319, 0.1, 'square', 0.05, 0.06); tone(1568, 0.12, 'square', 0.04, 0.12) },
  upgrade: () => [392, 523, 659].forEach((f, i) => tone(f, 0.1, 'triangle', 0.07, i * 0.07)),
  sell:    () => { tone(1047, 0.08, 'square', 0.06); tone(784, 0.16, 'triangle', 0.07, 0.07) }, // cha-ching
  bid:     () => { tone(740, 0.06, 'triangle', 0.07); tone(940, 0.07, 'triangle', 0.07, 0.06) },
  win:     () => [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.16, 'triangle', 0.08, i * 0.09)),
  hire:    () => [440, 587, 740].forEach((f, i) => tone(f, 0.1, 'triangle', 0.07, i * 0.07)),
  sign:    () => { tone(300, 0.05, 'triangle', 0.05); tone(300, 0.05, 'triangle', 0.05, 0.08); tone(659, 0.16, 'triangle', 0.07, 0.18) },
  levelup: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.18, 'triangle', 0.08, i * 0.09)),
  error:   () => tone(180, 0.16, 'sawtooth', 0.06, 0, 130),
}
