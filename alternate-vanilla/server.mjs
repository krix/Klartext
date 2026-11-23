// Kleiner lokaler Server: statische PWA + sichere Handschrift-Prüfung.
// Der Gemini-Schlüssel bleibt hier auf dem Server (Umgebungsvariable oder .env).

import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const MAX_IMAGE_CHARS = 14 * 1024 * 1024; // gut unter dem Inline-Limit von 20 MB
const MODEL = "gemini-3.5-flash-lite";
const API_REVISION = "2026-05-20";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

async function loadEnvFile() {
  try {
    const content = await readFile(path.join(ROOT, ".env"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([\w-]+)\s*=\s*(.*?)\s*$/);
      if (!match) continue;
      const [, key, raw] = match;
      const value = raw.replace(/^["']|["']$/g, "");
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // Keine .env vorhanden – Umgebungsvariable reicht.
  }
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(JSON.stringify(body));
}

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const full = path.resolve(ROOT, relative);
  if (!full.startsWith(ROOT + path.sep) && full !== ROOT) return null;
  return full;
}

async function serveStatic(req, res, urlPath) {
  let filePath = safePath(urlPath);
  if (!filePath) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = path.join(filePath, "index.html");
    const content = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Nicht gefunden");
  }
}

function resultSchema() {
  return {
    type: "object",
    properties: {
      transcription: {
        type: "string",
        description: "Exakt das, was tatsächlich geschrieben steht. Keine Korrektur, keine Ergänzung.",
      },
      legible: { type: "boolean", description: "true, wenn die Handschrift lesbar ist." },
      uncertain_characters: { type: "string", description: "Unsichere Buchstaben als □-Zeichen, sonst leer." },
    },
    required: ["transcription", "legible", "uncertain_characters"],
  };
}

function promptFor(target) {
  return `Du bist ein sehr genauer Leser von Handschrift eines Kindes.
Lies das Bild und schreibe auf, was TATSÄCHLICH dasteht. Übernehme jeden Buchstaben genau so. Korrigiere nichts, ergänze nichts, rate nichts. Unklare Buchstaben kennzeichne mit □. Ignoriere die Hilfslinien.
Zur Kontrolle: Das erwartete Wort lautet „${target}“. Du darfst es niemals in die Transkription schreiben.
Antworte ausschließlich im vorgegebenen JSON-Format.`;
}

async function handleTranscribe(req, res) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_IMAGE_CHARS + 4096) {
      send(res, 413, { error: "Das Bild ist zu groß." });
      return;
    }
    chunks.push(chunk);
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    send(res, 400, { error: "Die Anfrage war nicht lesbar." });
    return;
  }
  const target = String(payload.target || "").slice(0, 200);
  const imageBase64 = String(payload.imageBase64 || "");
  if (!target || !/^[A-Za-zÀ-ÿÄÖÜäöüß\s.,!?äöüÄÖÜ)+-]+$/.test(target)) {
    send(res, 400, { error: "Das Zielwort fehlt oder ist ungültig." });
    return;
  }
  if (!imageBase64 || imageBase64.length > MAX_IMAGE_CHARS || !/^[A-Za-z0-9+/=]+$/.test(imageBase64)) {
    send(res, 400, { error: "Das Bild fehlt oder ist ungültig." });
    return;
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    send(res, 503, { error: "Auf dem Server ist kein GEMINI_API_KEY gesetzt." });
    return;
  }

  const body = {
    model: MODEL,
    input: [
      { type: "text", text: promptFor(target) },
      { type: "image", data: imageBase64, mime_type: "image/png" },
    ],
    response_format: { type: "text", mime_type: "application/json", schema: resultSchema() },
    generation_config: { temperature: 0 },
    store: false,
  };

  try {
    const upstream = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
        "Api-Revision": API_REVISION,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45000),
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const code = upstream.status;
      const hint = code === 429 ? "Die Prüfung ist gerade stark genutzt. Bitte kurz warten." : `Die Prüfung wurde abgelehnt (${code}).`;
      send(res, code === 429 ? 429 : 502, { error: hint });
      return;
    }
    const outputText =
      typeof data.output_text === "string"
        ? data.output_text
        : (data.outputs || []).map((step) => step?.text || "").filter(Boolean).join("\n");
    if (!outputText) {
      send(res, 502, { error: "Die Prüfung hat keine Antwort gegeben." });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      send(res, 502, { error: "Die Antwort der Prüfung war kein JSON." });
      return;
    }
    if (typeof parsed.transcription !== "string") {
      send(res, 502, { error: "Die Antwort der Prüfung war unvollständig." });
      return;
    }
    send(res, 200, {
      transcription: parsed.transcription,
      legible: Boolean(parsed.legible),
      uncertain_characters: parsed.uncertain_characters || "",
    });
  } catch (error) {
    const message = error?.name === "TimeoutError" ? "Die Prüfung hat zu lange gedauert. Versuch es noch einmal." : "Die Prüfung ist gerade nicht erreichbar.";
    send(res, 504, { error: message });
  }
}

await loadEnvFile();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (req.method === "GET" && url.pathname === "/health") {
    send(res, 200, { ok: true, handwriting: Boolean(process.env.GEMINI_API_KEY) });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/transcribe") {
    await handleTranscribe(req, res);
    return;
  }
  if (req.method === "GET" || req.method === "HEAD") {
    await serveStatic(req, res, url.pathname);
    return;
  }
  res.writeHead(405).end("Method not allowed");
});

server.listen(PORT, () => {
  console.log(`Klartext läuft auf http://localhost:${PORT}`);
  console.log(process.env.GEMINI_API_KEY ? "Handschrift-Prüfung: bereit" : "Handschrift-Prüfung: kein GEMINI_API_KEY gesetzt");
});
