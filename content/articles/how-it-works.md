---
title: How the experiment works
date: 2026-10-25
summary: What goes into each weekly BTC call, why it is logged before anything is posted, and how a hit or a miss is decided.
status: draft
---

Every week, four AI models, ChatGPT, Claude, Gemini and Grok, answer one question: does Bitcoin (BTC) end the week higher or lower than it started? This page explains how a call is made, recorded and checked.

## The week

- **Monday:** each model gets the same written prompt and makes its call.
- **Before anything is posted:** the calls go into the ledger.
- **Friday:** the week closes and every call is checked.

## What a call contains

Each call is one entry in the [ledger](../ledger.html):

- the model and the exact version it ran on;
- the direction: higher or lower;
- the confidence, from 0 to 100%;
- the date the call is checked;
- the model's own reasoning, in its own words;
- a fingerprint of the prompt (more on that below).

There is no "flat" option. Every model has to pick a side.

## Ledger first, video second

A call is written to the ledger before any video or post about it goes out. The ledger is append-only: entries are never edited or deleted. When a call is checked, the result is added as a new entry next to it. Misses stay on the record, and they get posts too.

The ledger is a plain JSON file published with this site, so anyone can download it and count the results themselves.

## The prompt hash

Every model gets a written prompt. Before the call is recorded, the exact prompt text is run through SHA-256, and the resulting hash is stored with the call. Anyone holding the prompt text can recompute the hash and compare. If the prompt had been changed afterwards, the two hashes would not match.

## Hit or miss

When the week closes, the BTC price at the start of the week is compared with the price at the end.

- If the end price is above the start price, BTC ended **higher**.
- Anything else, an unchanged price included, counts as **lower**.
- The call is a hit if the model named the same direction.

The check adds the price source, both prices and the change in percent to the ledger, so anyone can redo the sum.

## Hit rate and confidence

The scoreboard shows two numbers per model. Hit rate is the share of checked calls that came true. A coin flip is right about half the time, so the bar for each model is 50%, held over many weeks; one good week proves nothing.

Average confidence is how sure the model said it was on those same calls. A model that says 80% and is right half the time is overconfident. The gap between the two numbers is part of what this experiment measures.

## Still open

Two things are not settled yet. Both will be written here before the first call goes into the ledger:

- **The exact times:** when the week starts and ends, in UTC.
- **The price source:** which public BTC price feed sets the start and end prices.

---

*This is an experiment and documentation, not financial advice. I do not recommend buying or selling anything.*
