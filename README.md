# Repka · AI Prediction Lab

Four AI models make one call on Bitcoin every week. Each call goes into a public ledger before anyone sees it, and misses stay on the record next to the hits.

**Site:** https://repka-lab.github.io · **Ledger:** [`data/ledger.json`](data/ledger.json) · **Scoreboard:** [`data/results.json`](data/results.json)

## How a week runs

1. **Monday.** ChatGPT, Claude, Gemini and Grok get the same prompt and each answer one question: does BTC end the week higher or lower than it started?
2. **Ledger first.** Every answer is written to `data/ledger.json` with a UTC timestamp and the SHA-256 hash of the exact prompt. Only after that does a video or post about it go out.
3. **Friday.** The call is checked against the BTC price and the result is added next to it. Nothing earlier in the file is edited or removed.
4. **The bar.** A coin flip is right half the time. The question is whether any of the four models does better than 50% over many weeks.

## What a call records

| Field | Meaning |
| --- | --- |
| `id` | `P0001`, `P0002`, … in the order calls were recorded |
| `date` | when the call was recorded, ISO 8601, UTC |
| `model`, `model_version` | which AI made it and the exact API model id |
| `direction` | higher or lower |
| `confidence` | how sure the model said it was, 0–100 |
| `reasoning` | the model's own explanation, unedited |
| `prompt_hash` | SHA-256 of the prompt, so anyone can check it was not changed afterwards |
| `verify_date` | when the call gets checked |

The check adds `price_source`, `price_start`, `price_end`, `change_pct` and `hit`.

## Repository

```
data/          ledger.json (append-only), results.json, prompts/
content/       articles in Markdown
src/           ledger rules and the static site builder (TypeScript, tested)
docs/          the built site, served by GitHub Pages
video/         the weekly episode: scenes, character rig, render tools
```

```
npm ci
npm test          # ledger and site tests
npm run site      # rebuild docs/ from the ledger and the articles
```

Node 24 or newer.

## Still open

- The exact start and end times of the week in UTC.
- Which public BTC price source is used for the check.

Both will be fixed here before the first call is recorded.

## About the host

Repka, the grandpa in the videos, is an animated AI character, not a real person.

## License

- Code: [MIT](LICENSE).
- Articles in `content/` and data in `data/`: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Fonts in `video/assets/fonts/` keep their own licenses (SIL OFL 1.1, Apache 2.0), stored next to each font.
- The Repka character and name are not covered by these licenses.

---

This is an experiment and documentation, not financial advice. I do not recommend buying or selling anything.
