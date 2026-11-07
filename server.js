"use strict";

const path = require("path");
const express = require("express");
const data = require("./js/data");
const ai = require("./js/ai");
const catalog = require("./js/catalog");

const app = express();
const PORT = Number(process.env.PORT) || 8000;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
const buckets = new Map();

app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use(express.static(__dirname, { extensions: ["html"] }));

function liveEnabled() {
  return Boolean(String(process.env.ANTHROPIC_API_KEY || "").trim());
}

function limited(ip) {
  const now = Date.now();
  const bucket = buckets.get(ip) || { count: 0, start: now };
  if (now - bucket.start > 10 * 60 * 1000) {
    bucket.count = 0;
    bucket.start = now;
  }
  bucket.count += 1;
  buckets.set(ip, bucket);
  return bucket.count > 20;
}

function venuesForPrompt() {
  return catalog.compact(data.VENUES);
}

app.get("/api/status", function (_req, res) {
  res.json({ live: liveEnabled() });
});

app.post("/api/breeze", async function (req, res) {
  const ip = String(req.ip || "local");
  if (limited(ip)) {
    return res.status(429).json({ live: false, error: "rate" });
  }
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const message = String(body.message || "").trim().slice(0, 1200);
  if (!message) return res.status(400).json({ live: false, error: "empty" });

  const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
  const brief = body.brief && typeof body.brief === "object" ? body.brief : {};
  const profile = body.profile && typeof body.profile === "object" ? body.profile : null;
  const page = String(body.page || "").slice(0, 80);
  const venueId = String(body.venueId || "").slice(0, 40);

  const merged = ai.applyProfile(brief, profile);
  const parsed = ai.parseUtterance(message, merged);

  if (!liveEnabled()) {
    const local = ai.reply(data.VENUES, parsed, message, profile);
    return res.json({ live: false, source: "local", result: serialize(local) });
  }

  try {
    const result = await askModel({ message: message, history: history, brief: parsed, profile: profile, page: page, venueId: venueId });
    return res.json({ live: true, source: "anthropic", result: result });
  } catch (err) {
    const local = ai.reply(data.VENUES, parsed, message, profile);
    return res.json({ live: false, source: "local", result: serialize(local) });
  }
});

function serialize(local) {
  return {
    text: local.text,
    suggestions: local.suggestions || [],
    brief: local.brief || {},
    matches: (local.ranked || []).map(function (item) {
      return {
        id: item.venue.id,
        score: item.score,
        reasons: item.reasons,
        limits: item.limits
      };
    })
  };
}

async function askModel(ctx) {
  const ranked = ai.rankVenues(data.VENUES, ctx.brief).slice(0, 5);
  const system = [
    "You are Breeze, a calm hotel-event concierge for a Miami marketplace demo.",
    "Speak like a thoughtful host at a coastal hotel, not like a chatbot or copilot. No emojis, no markdown headings, no 'As an AI'.",
    "Venue prices, dates, and availability are SAMPLE DATA. Never say a date is booked for real. An inquiry is not a confirmed reservation.",
    "Use the planner profile (company, theme, palette, usual event) when it exists. Explain brand fit in plain language: why a room helps or fights the identity.",
    "Recommend at most three venues from the catalog. Prefer the scoring hints, but you may reorder if brand or theme clearly disagrees.",
    "If the guest has not said the event type or guest count, and the profile does not fill it, ask one short question instead of listing rooms.",
    "Return ONLY JSON with keys: text (string), suggestions (2-4 short strings), brief (object with any of type, guests, location, budget, aesthetic, theme, brandNote), matches (array of {id, score, reasons, limits}).",
    "Catalog: " + JSON.stringify(venuesForPrompt()),
    "Score hints: " + JSON.stringify(ranked.map(function (item) {
      return { id: item.venue.id, score: item.score, reasons: item.reasons, limits: item.limits };
    })),
    "Planner profile: " + JSON.stringify(ctx.profile || null),
    "Working brief: " + JSON.stringify(ctx.brief || {}),
    "Current page: " + ctx.page + (ctx.venueId ? " venue=" + ctx.venueId : "")
  ].join("\n");

  const messages = [];
  ctx.history.forEach(function (item) {
    const role = item.role === "assistant" ? "assistant" : "user";
    const text = String(item.text || "").slice(0, 1200);
    if (text) messages.push({ role: role, content: text });
  });
  messages.push({ role: "user", content: ctx.message });

  const key = String(process.env.ANTHROPIC_API_KEY || "").trim();
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 700,
      temperature: 0.4,
      system: system,
      messages: messages
    })
  });

  if (!response.ok) {
    throw new Error("model");
  }
  const payload = await response.json();
  const raw = ((payload.content || []).map(function (part) { return part.text || ""; }).join("\n") || "").trim();
  const parsed = parseJson(raw);
  if (!parsed || !parsed.text) throw new Error("shape");
  const allowed = new Set(data.VENUES.map(function (v) { return v.id; }));
  const matches = Array.isArray(parsed.matches) ? parsed.matches.filter(function (item) { return item && allowed.has(item.id); }).slice(0, 3) : [];
  return {
    text: String(parsed.text).slice(0, 1600),
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map(function (s) { return String(s).slice(0, 80); }).slice(0, 4) : [],
    brief: Object.assign({}, ctx.brief, parsed.brief || {}),
    matches: matches.map(function (item) {
      return {
        id: item.id,
        score: Math.max(1, Math.min(99, Number(item.score) || 50)),
        reasons: Array.isArray(item.reasons) ? item.reasons.map(String).slice(0, 4) : [],
        limits: Array.isArray(item.limits) ? item.limits.map(String).slice(0, 3) : []
      };
    })
  };
}

function parseJson(raw) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch (err) { return null; }
}

app.listen(PORT, "127.0.0.1", function () {
  process.stdout.write("Breeze at http://127.0.0.1:" + PORT + "\n");
});
