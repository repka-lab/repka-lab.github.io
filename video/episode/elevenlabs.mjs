// The few ElevenLabs calls grandpa's voice needs. The key lives only in ai-prediction-lab/.env
// (ELEVENLABS_API_KEY, see .env.example) and is never printed or written anywhere else.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const API = "https://api.elevenlabs.io";
const ENV_FILE = fileURLToPath(new URL("../../.env", import.meta.url));

function apiKey() {
  try {
    process.loadEnvFile(ENV_FILE);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error(`ELEVENLABS_API_KEY is not set: add it to ${ENV_FILE}, see .env.example`);
  return key;
}

// POSTs JSON and returns the response; the caller reads it as JSON or audio.
export async function post(route, body) {
  const response = await fetch(`${API}${route}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`ElevenLabs ${route.split("?")[0]} answered ${response.status}: ${detail}`);
  }
  return response;
}

export function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

export function writeJson(file, data) {
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}
