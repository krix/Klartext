// Vorlesen mit der Web Speech API. Keine Cloud-Stimme, keine Datenabgabe.

const synth = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;

let voices = [];
let preferredRate = 0;
let enabled = true;

const RATES = [0.72, 0.9, 1.05];

function refreshVoices() {
  if (!synth) return;
  voices = synth.getVoices();
}

if (synth) {
  refreshVoices();
  synth.addEventListener("voiceschanged", refreshVoices);
}

export function isSpeechAvailable() {
  return Boolean(synth);
}

export function isSpeechEnabled() {
  return enabled && isSpeechAvailable();
}

export function setSpeechEnabled(value) {
  enabled = Boolean(value);
  if (!enabled) stopSpeech();
}

export function setSpeechRate(index) {
  preferredRate = Math.max(0, Math.min(RATES.length - 1, Number(index) || 0));
}

export function speechRateLabel(index = preferredRate) {
  return ["langsam", "normal", "etwas schneller"][index] || "langsam";
}

function pickGermanVoice() {
  if (!voices.length) refreshVoices();
  const german = voices.filter((voice) => /^de([-_]|$)/i.test(voice.lang));
  return german.find((voice) => voice.localService) || german[0] || null;
}

export function hasGermanVoice() {
  return Boolean(pickGermanVoice());
}

export function stopSpeech() {
  if (synth) synth.cancel();
}

/** Spricht einen deutschen Text. Gibt false zurück, wenn gerade nichts vorgelesen wird. */
export function speak(text, { rate = preferredRate, onEnd } = {}) {
  if (!isSpeechEnabled() || !text) return false;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(String(text));
  const voice = pickGermanVoice();
  if (voice) utterance.voice = voice;
  utterance.lang = voice ? voice.lang : "de-DE";
  utterance.rate = RATES[Math.max(0, Math.min(RATES.length - 1, rate))];
  utterance.pitch = 1;
  if (onEnd) utterance.addEventListener("end", onEnd, { once: true });
  synth.speak(utterance);
  return true;
}

/** Erzeugt einen kleinen Vorlese-Button mit Text und optionalem Label. */
export function speakButton(text, label = "Vorlesen", { slow = false } = {}) {
  if (!hasGermanVoice()) return "";
  const safeLabel = escapeHtml(label);
  return `<button type="button" class="speak-btn" data-speak="${escapeAttr(text)}" data-slow="${slow ? "1" : "0"}">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Zm12.5 3a4.5 4.5 0 0 0-2.2-3.9v7.8a4.5 4.5 0 0 0 2.2-3.9Z"/></svg>
    <span>${safeLabel}</span>
  </button>`;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeAttr(value) {
  return escapeHtml(value).replaceAll("\n", "&#10;");
}
