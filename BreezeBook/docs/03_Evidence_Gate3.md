# 3. Does It Work? (Gate 3)

## What we tested
300 fake planner requests the model never saw during training:

- **Familiar (150):** written in the same styles as the training data.
- **Unfamiliar (150):** new wording, slang and typos, like "vow renewal", "Tulum-ish", "beamer", "rounds of ten". **This is the honest test.**

A request counts as **right** only if the event type, guests and budget are correct, a good space is in the top 3, and nothing suggested breaks a requirement.

## Results (measured November 7, 2026)
| Who reads the request | Familiar wording | Unfamiliar wording |
|---|---|---|
| Keyword search (how normal search works) | 19.3% right | 0% right |
| **Our BreezeBook model** | **99.3% right** | **8% right** (good space in top 3: 49.3%) |
| Claude | – | ___% (press "Run Claude" in the Accuracy lab) |
| Auto: our model, Claude when unsure | – | ___% (same button) |

## What this means, simply

- On wording it has seen, our model is almost perfect, and much better than keyword search.
- On new wording, it falls apart: it gets the event type right only 29% of the time and the style only 15%. **A model trained only on fake data can't learn words it has never seen.**
- Guests, budget and dates were read correctly 100% of the time on both sets. *Caveat: we wrote those reading rules knowing what the test wording looked like, so this number is optimistic.*

## Our model knows when it's unsure
| Confidence needed | Familiar: handled by our model | Unfamiliar: handled by our model |
|---|---|---|
| 80% | 96% (and 99.3% of those are right) | only 2%; the other 98% go to Claude |

That's why Auto mode works: our free model handles what it knows and asks Claude about the rest.

## What we tried to improve it
| Change | Unfamiliar: right | Unfamiliar: good space in top 3 |
|---|---|---|
| Version 1: word patterns | 4% | 42.7% |
| Version 2: + letter patterns (helps with typos) | 7.3% | 44.7% |
| Version 3: + 600 requests in a third writing style | 6–8% | 49.3% |

## Top 3 failure types
1. **New event words:** "vow renewal" read as birthday; "annual convention" read as party.
2. **New style words:** "Tulum-ish", "fairytale" and "Gatsby" weren't recognized at all.
3. **Indoor or outdoor:** "al fresco" and "AC inside" weren't understood.

## Cost per successful result

- **Our model:** $0, because it runs in the browser.
- **Claude:** about $0.00025 per request. Cost per successful result = total Claude cost ÷ requests it got right. Fill this in after the Claude run.
