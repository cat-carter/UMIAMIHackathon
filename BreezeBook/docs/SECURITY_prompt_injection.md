# Prompt injection: where it could happen and what BreezeBook does

| Where text reaches Claude | Risk | Defense in the code |
|---|---|---|
| Event search box | Text tries to change prices or rules | Sentences that look like instructions are removed before Claude (BV.stripInjection); the message is wrapped as untrusted data; Claude may only return values from fixed lists (event types, layouts, amenities), checked by validate(). Worst case: wrong search filters, which the planner can edit. |
| Breezy chat | Fake price, fake booking, junk sent to the team | Messages matching injection patterns never reach Claude (BV.screen); input capped at 800 characters; messages wrapped in <planner_message> tags marked as data; rules forbid confirming prices or bookings; any dollar figure not from a tool result or the planner gets a warning; booking claims get "nothing is booked until the hotel approves". |
| Sending to the team | Claude tricked into sending | Claude can only show a "Send to the team" button; nothing is sent until the person clicks. Max 5 sends per day per browser; text fields are length-capped. |
| Prices and negotiation | "Set the price to $0" | Claude never sets prices. Negotiation is plain code with each hotel's price floor, and a hotel employee approves every deal. |
| Team inbox display | Stored text with HTML or script | Everything is shown with escaping (esc / textContent); nothing from users or Claude is inserted as HTML. |
| Who can read requests | One planner reading another's | Database rules: each person writes only their own document; only the page owner and editors read the inbox. |
| Future: hotel-supplied documents | Instructions hidden in a hotel's PDF or description | Not in the demo. Plan: same treatment as planner text (wrap as data, extract to fixed fields, human review before publishing). |

Tested in team_page/injection_test.js with a fake Claude that obeys every attack: blocked message made 0 Claude calls; the misbehaving reply got both warnings; nothing reached the inbox until the click; the injected sentence never reached Claude. Model accuracy unchanged (node model/evaluate.js).
Limits: pattern lists can be evaded by rewording, so the real protection is that Claude has no power to set prices, book, or send without a click.
