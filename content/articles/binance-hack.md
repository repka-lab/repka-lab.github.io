---
title: The $6.36B Binance hack, in charts and wallets
date: 2026-10-31
summary: On October 29, about $6.36 billion left Binance hot wallets on ten chains in under four hours. What analysts found, where the money went, what was frozen, and the wallets anyone can check.
section: news
status: published
---

<figure class="shot"><video controls preload="none" playsinline width="1280" height="720" poster="../img/binance-hack-video.jpg" src="../video/binance-hack.mp4"></video><figcaption>Repka's 29-second episode on the hack. It gives the total as $6.3B; TRM Labs counts $6.36B. Repka is an animated AI character, not a person.</figcaption></figure>

At about 20:23 UTC on October 29, 2026, a single transaction emptied one Binance wallet: 167,464 ETH and 63 tokens, worth $2.53 billion, according to Elliptic. By midnight UTC, $6.36 billion in crypto had left Binance's hot wallets, the wallets an exchange keeps online for everyday withdrawals, according to TRM Labs. Analytics firms call it the largest crypto hack on record. This page puts what they found side by side, with links to every report and to the wallets themselves.

```chart
stats The hack in four numbers
hex | miss | $6.36B | taken from Binance hot wallets, according to TRM Labs; others count up to $6.43B
circle | accent | 10–11 | chains hit: TRM Labs counts 10, Elliptic 11
square | hit | ≈$2.8B | frozen so far, according to Chainalysis; Binance says about $3B
diamond | btc | under 4h | from the first transfer out to the last, in UTC
```

## How it started

According to Binance's preliminary findings, the way in was "a compromised software engineer's laptop". From there, the attackers took over the system that signs transactions for the hot wallets. TRM Labs found that the attacking wallet was first funded through Tornado Cash, a tool that hides where crypto comes from, and that the setup took at least 36 hours.

<figure class="shot"><img src="../img/binance-hack-setup.jpg" width="1160" height="590" loading="lazy" alt="Four steps in a row: an engineer's laptop compromised, the hot-wallet signing system taken over, a wallet funded via Tornado Cash on Oct 28, attack code tested on three wallets on Oct 29."><figcaption>From Repka's episode: the setup, according to TRM Labs and Binance's preliminary findings.</figcaption></figure>

## The evening of October 29

```chart
timeline What happened, hour by hour, in UTC
Oct 28 | muted | Test funding | Three transfers of 0.1 ETH reach the attacker from Tornado Cash.
Oct 29, 15:59 | muted | Setup | A contract built to collect the funds goes on-chain.
≈20:05 | miss | First chains | XRP goes first, then Solana and Optimism at about 20:10.
20:20 | miss | Bitcoin | 18,270 BTC leave in one go.
≈20:23 | miss | Ethereum | The Binance 14 hot wallet is emptied: 167,464 ETH and 63 tokens.
≈21:01 | hit | First freezes | Tether freezes USDT; Circle follows about three minutes later.
after 23:00 | miss | Last chains | Avalanche and Polygon.
23:56 | muted | Last transfer | The last sweep out of Binance's wallets.
Oct 30, 04:30 | accent | Attribution | Chainalysis links the hack to the TraderTraitor group.
note: Times from TRM Labs and Chainalysis. ≈ marks an approximate time.
```

<figure class="shot"><img src="../img/binance-hack-drain.jpg" width="1160" height="590" loading="lazy" alt="Ten Binance hot wallets, one per chain, drained into an attacker wallet; a counter reads $6.3B left at 20:23 UTC."><figcaption>From Repka's episode: the counter at 20:23 UTC, as the Ethereum wallet was emptied.</figcaption></figure>

## What was taken

Most of the value sat on Ethereum: ether itself plus 185 different tokens, among them large amounts of the stablecoins USDT and USDC. A stablecoin is a token meant to hold the value of one US dollar.

```chart
chains What was taken, by chain, according to TRM Labs
Ethereum | 3790 | 200,630 ETH and 185 tokens, among them 1.875B USDT, 823M USDC and 88.5M RLUSD
Bitcoin | 1470 | 18,270 BTC
Tron | 628 | the Tron network
XRP | 296 | the XRP Ledger
Solana | 96 | the Solana network
3 layer-2s | 39 | Arbitrum, Optimism and Base together
Avalanche | 28 | the Avalanche network
Polygon | 10 | the Polygon network
note: In US dollars at prices on the day. TRM Labs counts $6.36B in all; Chainalysis about $6.4B and Elliptic $6.43B.
```

## How it compares

Before this, the largest crypto hack on record was Bybit's in February 2025: $1.46B by Elliptic's count, itself more than twice any earlier theft. Elliptic puts this one at more than four times Bybit.

```chart
chains This hack next to the largest earlier ones, in US dollars at the time
Binance, 2026 | 6360 | according to TRM Labs
Bybit, 2025 | 1460 | according to Elliptic
Poly Network, 2021 | 611 | the hacker returned nearly all of it within two weeks, according to Decrypt
BNB Chain, 2022 | 570 | only about $100M of it left the chain, according to Decrypt
Ronin, 2022 | 552 | according to Decrypt
Coincheck, 2018 | 530 | according to Decrypt
note: Earlier hacks from Decrypt's list of the biggest, from March 2025, valued at the time of each hack. Other counts differ by a few percent.
```

## Who is behind it

According to analysts, the hack points to TraderTraitor, a North Korean group that is part of what is often called the Lazarus Group. TRM Labs says so with "high confidence" and ties it to the same group as the Bybit hack in 2025. Chainalysis calls the link likely. Elliptic is more careful: it says attribution is not yet certain, and that no government or law enforcement agency has confirmed it. As of October 31, Binance has not named anyone.

<figure class="shot"><img src="../img/binance-hack-who.jpg" width="1160" height="590" loading="lazy" alt="Left: analysts link it to North Korea, TraderTraitor (Lazarus Group). Right: bars of what was taken by chain, Ethereum $3.79B, Bitcoin $1.47B, Tron $628M, XRP $296M, Solana $96M, five others $77M."><figcaption>From Repka's episode: the attribution, and the same chain split as the chart above.</figcaption></figure>

```chart
analysts What three analytics firms found
TRM Labs | https://www.trmlabs.com/resources/blog/north-korea-steals-usd-6-36-billion-from-binance-in-the-largest-hack-in-history | $6.36B | 10 chains. Links the hack to TraderTraitor with "high confidence". About $2.7B frozen by 00:30 UTC on Oct 30.
Chainalysis | https://www.chainalysis.com/blog/binance-exploit-latest-findings-and-response/ | ≈$6.4B | Calls TraderTraitor the likely group. About $2.8B frozen; the first freezes came by 21:14 UTC.
Elliptic | https://www.elliptic.co/insights/binance-largest-hack-in-history/ | $6.43B | 11 chains. Says attribution is not yet certain. $2.85B frozen, 94% of it stablecoins.
```

## Then the laundering

Stablecoins have one weak spot for a thief: the company that issues them can freeze them. Ether and bitcoin have no issuer to do that. So, according to analysts, the first move was to swap stablecoins for ETH as fast as possible, even at a loss.

- **Stablecoins into ETH.** Chainalysis saw $325M of stablecoins swapped into $285M of ETH. By Elliptic's later count, 434M USDT had become 160,451 ETH, at 12–26% below market price.
- **USDT into TRX.** On Tron, 234M USDT went into 638M TRX, the network's own coin, according to Elliptic.
- **A Bitcoin peel chain.** The BTC was split into pieces of 1,000 and 100 BTC and passed on through 19 fresh addresses, according to Elliptic.

<figure class="shot"><img src="../img/binance-hack-launder.jpg" width="1160" height="590" loading="lazy" alt="Three laundering patterns: USDT swapped for ETH, BTC split along a peel chain, thousands of scripted transfers; about $3B frozen on-chain, about $3.3B still out of reach."><figcaption>From Repka's episode: the laundering, according to Binance, Elliptic, TRM Labs and Chainalysis.</figcaption></figure>

## What was frozen

Freezes started within the hour. Tether moved first, at about 21:01 UTC, and Circle about three minutes later.

```chart
chains Who froze what, according to TRM Labs, by 00:30 UTC on Oct 30
Tether | 1770 | issuer of USDT
Circle | 825 | issuer of USDC
Ripple | 40.5 | issuer of RLUSD
Arbitrum | 30 | the Arbitrum network
WLFI | 27.8 | World Liberty Financial
note: About $2.7B in all. Later counts are higher: Chainalysis about $2.8B, Elliptic $2.85B, and Binance about $3B.
```

```chart
split Frozen and not frozen, according to Elliptic, as of Oct 31
Frozen | 2850 | hit
Not frozen | 3580 | miss
note: 94% of what is frozen is stablecoins. Nothing is frozen on Bitcoin, XRP, Solana or NEAR.
```

Sean Farrell of Fundstrat put the part out of reach at about $3.3B, CNBC reports.

## Follow the money on Ethereum

Etherscan, the Ethereum block explorer, labels the wallets involved. Three of them show the first hop. Each address links to its page, where every transfer can be checked.

```chart
wallets Three wallets, in the order the ETH moved. Labels: Etherscan
Binance 14 | 0x28C6c06298d514Db089934071355E5743bf21d60 | victim | A Binance hot wallet. Sent 167,464.24 ETH to Exploiter 2 on Oct 29.
Exploiter 2 | 0x5227f603C1eE34CE3C06eFe6477003BDfCCB2f8c | exploiter | Held about $2.09B in tokens on Oct 31.
Exploiter 8 | 0x8532FA14ACAf483729C449b8458aedDb900543D4 | exploiter | Held about 197,460 ETH on Oct 31. Its first funds came from Exploiter 2.
note: Balances as of Oct 31; they change as funds move or are frozen.
```

The full list of labeled wallets is on [Etherscan's label page](https://etherscan.io/accounts/label/binance-hot-wallet-exploit). Bitcoin addresses are not listed here.

## What Binance says

Binance says it will "cover all losses" and temporarily paused deposits and withdrawals, CNBC reports. In its own words: "Binance will absorb the financial impact of these stolen funds, not our users." On October 31, Binance said 90% of the stolen assets had been replenished, according to Reuters.

## What comes next

```chart
timeline What comes next, as of October 31
Nov 1 | accent | Withdrawals | Binance plans to resume withdrawals, according to Reuters.
Nov 2 | accent | Proof of reserves | Binance plans to publish a proof of reserves, according to Reuters.
note: This page adds each date to the updates below once it has passed.
```

## The market after

The lab tracks Bitcoin every week, and a hack this size moves the market the AIs are calling. Both charts start at the 4-hour candle the hack began in.

```chart
market btc 2026-10-29T20:00:00Z Bitcoin around the hack, Coinbase BTC-USD
Hack
```

```chart
market bnb 2026-10-29T20:00:00Z BNB, Binance's own coin, around the hack, Binance BNB-USDT
Hack
```

## Updates

Newest first. Each entry is dated, and the numbers above change only with a new entry here.

- **October 31.** First version of this page.

## How this page was made

- **Numbers** come from the reports linked below. Where the firms differ, each number carries its firm's name.
- **Times** are UTC, from TRM Labs and Chainalysis.
- **Wallets** are Etherscan's labels; the balances were read on October 31.
- **Candles** are public 4-hour candles: [BTC from Coinbase](../data/btc-usd-4h.json) and [BNB from Binance](../data/bnb-usdt-4h.json). The lowest price is the lowest low from the hack's candle on.
- **Earlier hacks** come from Decrypt's list of the biggest crypto hacks, valued at the time of each hack, and Bybit from Elliptic.
- **The video and stills** are from Repka's episode. Repka is an animated AI character, not a person.

## Sources

- TRM Labs: [North Korea steals $6.36 billion from Binance](https://www.trmlabs.com/resources/blog/north-korea-steals-usd-6-36-billion-from-binance-in-the-largest-hack-in-history)
- Chainalysis: [Binance exploit, latest findings and response](https://www.chainalysis.com/blog/binance-exploit-latest-findings-and-response/)
- Elliptic: [Binance, the largest hack in history](https://www.elliptic.co/insights/binance-largest-hack-in-history/)
- CNBC: [Circle and Tether freeze funds](https://www.cnbc.com/2026/10/29/circle-tether-freeze-funds-impacted-by-potential-binance-security-issue.html), [the market reaction](https://www.cnbc.com/2026/10/30/bitcoin-ether-price-binance-security-scare-rattles-crypto-markets.html), [what happens to the frozen funds](https://www.cnbc.com/2026/10/30/billions-in-crypto-frozen-in-binance-hack-heres-what-happens-next-.html)
- Reuters: [Binance says 90% of stolen assets replenished](https://www.reuters.com/legal/government/binance-says-90-stolen-assets-replenished-2026-10-31/)
- BBC: [report on the hack](https://www.bbc.co.uk/news/articles/ckpdg3ql4169o)
- Wikipedia: [2026 Binance hack](https://en.wikipedia.org/wiki/2026_Binance_hack)
- The Hacker News: [Binance suffers security breach](https://thehackernews.com/2026/10/binance-suffers-security-breach.html)
- The Block: [Bitcoin slides below $77,000](https://www.theblock.co/news/markets/2026-10-29-bitcoin-slides-below-77000-binance-hack-432183)
- Etherscan: [Binance hot wallet exploit label](https://etherscan.io/accounts/label/binance-hot-wallet-exploit)
- Decrypt: [The biggest crypto hacks of all time](https://decrypt.co/308292/biggest-crypto-hacks-of-all-time)

---

*This is an experiment and documentation, not financial advice. I do not recommend buying or selling anything.*
