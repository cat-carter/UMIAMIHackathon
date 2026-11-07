const assert = require("assert");
const data = require("../js/data");
const ai = require("../js/ai");

const venues = data.VENUES;

const wedding = ai.parseUtterance("Wedding for 150 guests in Coral Gables under $20k", {});
assert.strictEqual(wedding.type, "wedding");
assert.strictEqual(wedding.guests, 150);
assert.strictEqual(wedding.location, "Coral Gables");
assert.strictEqual(wedding.budget, 20000);

const ranked = ai.rankVenues(venues, wedding);
assert.strictEqual(ranked[0].venue.id, "palmetto");
assert.strictEqual(ranked[0].layout.id, "banquet");
assert.ok(ranked[0].score > ranked[1].score);

const board = ai.parseUtterance("Executive meeting for 12 guests downtown", {});
assert.strictEqual(board.type, "meeting");
assert.strictEqual(board.guests, 12);
const boardRank = ai.rankVenues(venues, board);
assert.strictEqual(boardRank[0].venue.id, "northline");

const key = ai.parseUtterance("Dinner on Brickell Key for 200 guests", {});
assert.strictEqual(key.location, "Brickell Key");

const roof = ai.reply(venues, { type: "social", guests: 120, budget: 20000 }, "Only rooftops");
assert.strictEqual(roof.brief.style, "rooftop");
assert.strictEqual(roof.ranked[0].venue.id, "altura");

const early = ai.reply(venues, {}, "Hello");
assert.strictEqual(early.ranked.length, 0);
assert.ok(/what kind of event/i.test(early.text));

const summary = ai.compareSummary([venues[0], venues[4]], { type: "wedding", guests: 140 });
assert.ok(/sample read/i.test(summary));
assert.ok(summary.includes("Luster") || summary.includes("Sky Terrace"));

console.log("match tests passed");
