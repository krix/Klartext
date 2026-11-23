/** Sprachausgabe über die im Browser vorhandene SpeechSynthesis – komplett offline. */

export function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text: string, rate = 0.85): boolean {
  if (!speechAvailable() || !text.trim()) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'de-DE';
  utterance.rate = rate;
  utterance.pitch = 1;
  const germanVoice = window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith('de'));
  if (germanVoice) utterance.voice = germanVoice;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking(): void {
  if (speechAvailable()) window.speechSynthesis.cancel();
}
