/** Sprachausgabe über die im Browser vorhandene SpeechSynthesis – komplett offline. */

export function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function utterance(text: string, rate: number): SpeechSynthesisUtterance {
  const spoken = new SpeechSynthesisUtterance(text);
  spoken.lang = 'de-DE';
  spoken.rate = rate;
  spoken.pitch = 1;
  const germanVoice = window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith('de'));
  if (germanVoice) spoken.voice = germanVoice;
  return spoken;
}

/** Spricht mehrere Teile nacheinander, z. B. erst das Wort, dann der Beispielsatz. */
export function speakParts(parts: readonly string[], rate = 0.85): boolean {
  if (!speechAvailable()) return false;
  const texts = parts.map((part) => part.trim()).filter(Boolean);
  if (texts.length === 0) return false;
  window.speechSynthesis.cancel();
  for (const text of texts) window.speechSynthesis.speak(utterance(text, rate));
  return true;
}

export function speak(text: string, rate = 0.85): boolean {
  return speakParts([text], rate);
}

/**
 * Das Wort allein klingt bei manchen Wörtern wie ein anderes (essen/Essen).
 * Der Beispielsatz wird deshalb direkt im Anschluss vorgelesen.
 */
export function speakWordAndSentence(word: string, sentence?: string, rate = 0.85): boolean {
  return speakParts([word, sentence ?? ''], rate);
}

export function stopSpeaking(): void {
  if (speechAvailable()) window.speechSynthesis.cancel();
}
