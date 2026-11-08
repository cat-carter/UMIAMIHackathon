"use strict";

const path = require("path");
const express = require("express");

const app = express();
const PORT = Number(process.env.PORT) || 8000;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
const buckets = new Map();

app.disable("x-powered-by");
app.use(express.json({ limit: "200kb" }));
app.use(express.static(__dirname, {
  extensions: ["html"],
  setHeaders(res) { res.setHeader("Cache-Control", "no-store"); }
}));

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

app.get("/api/status", function (_req, res) {
  res.json({ live: liveEnabled() });
});

app.post("/api/breeze", async function (req, res) {
  const ip = String(req.ip || "local");
  if (limited(ip)) return res.status(429).json({ live: false, error: "rate" });
  if (!liveEnabled()) return res.status(503).json({ live: false, error: "offline" });

  const incoming = Array.isArray(req.body && req.body.messages) ? req.body.messages : [];
  const cleaned = incoming
    .filter(function (m) { return m && (m.role === "user" || m.role === "assistant"); })
    .map(function (m) {
      return { role: m.role, content: String(m.content || "").slice(0, 24000) };
    })
    .filter(function (m) { return m.content; })
    .slice(0, 20);

  if (!cleaned.length) return res.status(400).json({ live: false, error: "empty" });

  let system = "You are Breeza on Breeze Book. Follow the guest's instructions. Plain text, then ### and one JSON object.";
  const messages = [];
  cleaned.forEach(function (m, i) {
    if (i === 0 && m.role === "user") {
      system = m.content;
      return;
    }
    const prev = messages[messages.length - 1];
    if (prev && prev.role === m.role) prev.content += "\n" + m.content;
    else messages.push({ role: m.role, content: m.content });
  });
  if (!messages.length) messages.push({ role: "user", content: "Continue." });
  if (messages[0].role !== "user") messages.unshift({ role: "user", content: "Continue." });

  try {
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
    if (!response.ok) return res.status(502).json({ live: false, error: "model" });
    const payload = await response.json();
    const text = ((payload.content || []).map(function (part) { return part.text || ""; }).join("\n") || "").trim();
    if (!text) return res.status(502).json({ live: false, error: "empty" });
    return res.json({ live: true, text: text.slice(0, 8000) });
  } catch (err) {
    return res.status(502).json({ live: false, error: "model" });
  }
});

app.listen(PORT, "127.0.0.1", function () {
  process.stdout.write("Breeze Book at http://127.0.0.1:" + PORT + "\n");
});
