# 4. Running It for Real (Gate 4)

## Who owns it on Monday?

- **Product owner:** runs the pilot with the hotels and decides what to fix first.
- **Tech lead:** keeps the app working and is on call.
- **Budget owner:** the value lead tracks AI and scanning costs. At each hotel, the general manager signs off.

## What we watch every week
| What | Why it matters | Alarm if... |
|---|---|---|
| Requests read correctly (checked on a weekly sample) | Wrong reads mean wrong matches | Falls below 85% |
| Share sent to Claude or a person | Shows how often our model is unsure | Above 50% (time to retrain) |
| Suspicious messages flagged | Catches trick attempts | Any reaches a hotel without a person checking |
| Claude cost per successful result | Keeps it affordable | More than 10× our estimate |
| Reply time to planners | Our main promise | Over 1 hour |
| Space use per hotel | The whole point | Not rising after 60 days |

## If something breaks (fallback)

- **Claude is down or too expensive:** our own model keeps working in the browser, and the app says so on screen.
- **The model is unsure:** the request goes to a person on the hotel's events team.
- **The negotiation assistant gets confused:** it stops and hands over to a person. It can never go below the hotel's lowest price.

## What it costs to run

- **Our model:** $0.
- **Claude:** about $0.00025 per request it reads.
- **Hosting:** about $100/month (estimate).
- **People:** on-site scanning and hotel onboarding are the main costs. The scan fee ($375 per space) is set to cover the visit.

## 90-day pilot plan
| Days | What we do |
|---|---|
| 1–30 | Sign 3 Miami hotels. Scan and measure their indoor and outdoor spaces. Load their rate cards and the extras they're willing to offer. |
| 31–60 | Go live. Collect real planner requests (with permission) and label 500 of them. |
| 61–90 | Retrain our model on the real requests. Compare space use and reply times before and after. |

## Decide at day 90

- **Scale:** space use is up at least 5 points and hotels want to keep paying.
- **Fix and retry:** planners like it, but hotels aren't converting requests into bookings.
- **Stop:** hotels won't share rate cards or allow scans.
