---
title: How the experiment works
date: 2026-10-25
summary: What goes into each AI call, why it is logged before anything is posted, and how a hit or a miss is decided.
status: draft
---

Four AI models, ChatGPT, Claude, Gemini and Grok, call where gold, silver, the S&P 500 and the NASDAQ end up by a set date: higher, lower or about flat. This page explains how a call is made, recorded and checked.

## What a call contains

Each call is one entry in the [ledger](../ledger.html):

- the model and the exact version it ran on;
- the asset;
- the direction: up, down or flat;
- the confidence, from 0 to 100%;
- the date the call is checked;
- the model's own reasoning, in its own words;
- a fingerprint of the prompt (more on that below).

## Ledger first, video second

A call is written to the ledger before any video or post about it goes out. The ledger is append-only: entries are never edited or deleted. When a call is checked, the result is added as a new entry next to it. Misses stay on the record, and they get posts too.

The ledger is a plain JSON file published with this site, so anyone can download it and count the results themselves.

## The prompt hash

Every model gets a written prompt. Before the call is recorded, the exact prompt text is run through SHA-256, and the resulting hash is stored with the call. Anyone holding the prompt text can recompute the hash and compare. If the prompt had been changed afterwards, the two hashes would not match.

## Hit or miss

On the check date, the price when the call was recorded is compared with the price on that date.

- A move smaller than ±0.5% counts as flat.
- A bigger move counts as up or down.
- The call is a hit if the model named the same direction.

The flat band is stored with each call, so it cannot be widened or narrowed after the fact.

## Hit rate and confidence

The scoreboard shows two numbers per model. Hit rate is the share of checked calls that came true. Average confidence is how sure the model said it was on those same calls. A model that says 80% and is right half the time is overconfident. The gap between the two numbers is part of what this experiment measures.

## Still open

Two things are not settled yet. Both will be written here before the first call goes into the ledger:

- **The time frame:** how far ahead each call looks.
- **The price source:** which data feed sets the start and end prices.

---

*This is an experiment and documentation, not financial advice. I do not recommend buying or selling anything.*
