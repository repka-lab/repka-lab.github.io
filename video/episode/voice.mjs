// Speak a story's subtitles in grandpa's voice: one line-<i>.wav per cue for score.py. A story that draws its
// own captions keeps its cues in "voice" instead of "subs", so the page adds no subtitle layer.
//
// node episode/voice.mjs assets/data/voice.json assets/data/heist.json episode/out/voice/heist
//
// A cue speaks its "say" when the spoken form differs from the subtitle ("$6.3B" -> "six point three billion").
// Each take is cached by its text, voice, model and settings, so a re-run costs no credits until something changes.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { post, readJson } from "./elevenlabs.mjs";

const CACHE = fileURLToPath(new URL("out/voice/cache/", import.meta.url));
const FORMAT = "mp3_44100_128";
const RATE = 44100;

const [configFile, storyFile, outDir] = process.argv.slice(2);
if (!outDir) throw new Error("usage: node episode/voice.mjs <voice.json> <story.json> <out dir>");
const { voiceId, tts } = readJson(configFile);
if (!voiceId) throw new Error(`no voiceId in ${configFile}: design and save the voice first, see voice_design.mjs`);
const story = readJson(storyFile);
const subs = story.voice ?? story.subs;
if (!Array.isArray(subs) || subs.length === 0) throw new Error(`${storyFile} has no voice or subs cues to speak`);

function ffmpeg(args) {
  const done = spawnSync("ffmpeg", ["-loglevel", "error", "-y", ...args], { encoding: "utf8" });
  if (done.status !== 0) throw new Error(`ffmpeg failed: ${done.stderr}`);
}

// Returns the cached mp3 of this take, asking ElevenLabs only when it is not there yet.
async function take(text) {
  const body = { text, model_id: tts.model, voice_settings: tts.settings, seed: tts.seed };
  const key = createHash("sha256").update(JSON.stringify({ voiceId, ...body })).digest("hex").slice(0, 16);
  const file = `${CACHE}${key}.mp3`;
  if (existsSync(file)) return { file, fetched: false };
  const response = await post(`/v1/text-to-speech/${voiceId}?output_format=${FORMAT}`, body);
  writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  return { file, fetched: true };
}

mkdirSync(CACHE, { recursive: true });
mkdirSync(outDir, { recursive: true });
let fetched = 0;
for (const [i, cue] of subs.entries()) {
  const mp3 = await take(cue.say ?? cue.text);
  fetched += mp3.fetched ? 1 : 0;
  ffmpeg(["-i", mp3.file, "-ac", "1", "-ar", String(RATE), "-c:a", "pcm_s16le", path.join(outDir, `line-${i}.wav`)]);
}
console.log(JSON.stringify({ lines: subs.length, fetched, cached: subs.length - fetched, dir: outDir }));
