// Design grandpa's voice once, then keep it: every video speaks with the saved voiceId.
//
// node episode/voice_design.mjs assets/data/voice.json [seed]           three previews land in out/voice-previews/
// node episode/voice_design.mjs assets/data/voice.json --save <id>      keep the preview with that generated id
// node episode/voice_design.mjs assets/data/voice.json --remix [seed]   three takes on the saved voice, changed as "remix" says
//
// The description and the sample text are in voice.json ("design", "remix"). Saving writes the new voiceId back into it;
// the id is not a secret, the key stays in .env.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { post, readJson, writeJson } from "./elevenlabs.mjs";

const PREVIEWS = fileURLToPath(new URL("out/voice-previews/", import.meta.url));
const FORMAT = "mp3_44100_128";

const [configFile, arg, value] = process.argv.slice(2);
if (!configFile) throw new Error("usage: node episode/voice_design.mjs <voice.json> [seed | --save <generated id> | --remix [seed]]");
const config = readJson(configFile);

// Writes <tag>-<i>.mp3 and <tag>.json with the generated ids to pick from.
function keep(previews, tag) {
  if (!Array.isArray(previews) || previews.length === 0) throw new Error("ElevenLabs returned no previews");
  mkdirSync(PREVIEWS, { recursive: true });
  const saved = previews.map((preview, i) => {
    const file = `${PREVIEWS}${tag}-${i + 1}.mp3`;
    writeFileSync(file, Buffer.from(preview.audio_base_64, "base64"));
    return { file, id: preview.generated_voice_id, seconds: preview.duration_secs };
  });
  writeJson(`${PREVIEWS}${tag}.json`, saved);
  return saved;
}

async function design(seed) {
  const { model, description, text } = config.design;
  const response = await post(`/v1/text-to-voice/design?output_format=${FORMAT}`, {
    voice_description: description,
    model_id: model,
    text,
    seed,
  });
  const { previews } = await response.json();
  return { seed, previews: keep(previews, seed) };
}

// The saved voice with the same timbre, changed only as the remix description says.
async function remix(seed) {
  if (!config.voiceId) throw new Error("no saved voice to remix: run --save <generated id> first");
  const { description, text } = config.remix;
  const response = await post(`/v1/text-to-voice/${config.voiceId}/remix?output_format=${FORMAT}`, {
    voice_description: description,
    text,
    seed,
  });
  const { previews } = await response.json();
  return { remixed: config.voiceId, seed, previews: keep(previews, `remix-${seed}`) };
}

async function save(id) {
  const response = await post("/v1/text-to-voice", {
    voice_name: config.name,
    voice_description: config.design.description,
    generated_voice_id: id,
  });
  const { voice_id: voiceId } = await response.json();
  if (!voiceId) throw new Error("ElevenLabs saved the voice but returned no voice_id");
  writeJson(configFile, { ...config, voiceId });
  return { saved: id, voiceId };
}

if (arg === "--save" && !value) throw new Error("--save needs the generated id from the previews json");
const MODES = {
  "--save": () => save(value),
  "--remix": () => remix(Number(value ?? config.remix.seed)),
};
const result = await (MODES[arg] ?? (() => design(Number(arg ?? config.design.seed))))();
console.log(JSON.stringify(result));
