(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.BreezeAI = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const TYPES = [
    ["wedding", ["wedding", "bride", "groom", "vows"]],
    ["gala", ["gala", "fundraiser", "black-tie", "black tie"]],
    ["conference", ["conference", "summit", "offsite", "training"]],
    ["meeting", ["meeting", "board", "executive", "interview"]],
    ["networking", ["networking", "mixer", "cocktail"]],
    ["social", ["birthday", "celebration", "anniversary", "private party", "reception"]]
  ];

  const NEIGHBORHOODS = [
    "South Beach",
    "Mid-Beach",
    "Brickell Key",
    "Brickell",
    "Downtown",
    "Coral Gables",
    "Coconut Grove",
    "Edgewater"
  ];

  const AESTHETICS = ["glamorous", "classic", "romantic", "modern", "natural", "minimal", "elegant"];
  const STYLES = [
    ["rooftop", ["rooftop", "roof"]],
    ["outdoor", ["outdoor", "garden", "lawn", "outside"]],
    ["meeting", ["boardroom", "meeting room"]],
    ["conference", ["conference room"]],
    ["banquet", ["banquet"]],
    ["ballroom", ["ballroom", "salon"]]
  ];

  function clone(brief) {
    return Object.assign({}, brief || {});
  }

  function applyProfile(brief, profile) {
    const next = clone(brief);
    const p = profile || {};
    if (!next.type && p.eventType) next.type = p.eventType;
    if (!next.guests && p.guests) next.guests = Number(p.guests);
    if (!next.budget && p.budget) next.budget = Number(p.budget);
    if (!next.location && p.location) next.location = p.location;
    if (!next.aesthetic && p.aesthetic) next.aesthetic = p.aesthetic;
    if (!next.theme && p.theme) next.theme = p.theme;
    if (!next.palette && p.palette) next.palette = p.palette;
    if (!next.company && p.company) next.company = p.company;
    if (!next.brandNote) {
      const bits = [p.company, p.theme, p.notes].filter(Boolean);
      if (bits.length) next.brandNote = bits.join(" — ");
    }
    if (p.logo && !next.logo) next.logo = p.logo;
    if (p.hasLogo) next.hasLogo = true;
    return next;
  }

  function brandFit(venue, brief) {
    const reasons = [];
    const limits = [];
    let score = 0;
    const b = brief || {};
    const theme = String(b.theme || b.brandNote || "").toLowerCase();
    const modernBrand = b.palette === "ink" || b.aesthetic === "modern" || b.aesthetic === "minimal" || /tech|innovation|startup|navy|digital/.test(theme);
    const classicBrand = b.palette === "champagne" || b.aesthetic === "classic" || b.aesthetic === "romantic" || b.aesthetic === "elegant" || /ivory|romantic|gala|wedding|heritage/.test(theme);
    const coastalBrand = b.palette === "coast" || b.palette === "sage" || /ocean|coast|sage|palm|breeze/.test(theme);

    if (classicBrand) {
      if (venue.aesthetic.indexOf("classic") !== -1 || venue.aesthetic.indexOf("romantic") !== -1 || venue.aesthetic.indexOf("elegant") !== -1) {
        score += 9;
        reasons.push("The plaster, arches, and ivory light hold a " + (b.aesthetic || "classic") + " identity" + (b.company ? " for " + b.company : "") + ".");
      } else if (venue.aesthetic.indexOf("modern") !== -1) {
        score -= 3;
        limits.push("A glass-and-walnut room will fight a heritage or romantic brand unless that contrast is the point.");
      }
    }
    if (modernBrand) {
      if (venue.aesthetic.indexOf("modern") !== -1 || venue.aesthetic.indexOf("minimal") !== -1) {
        score += 9;
        reasons.push("Clean lines and a quieter palette sit next to a modern or ink-navy brand.");
      } else if (venue.aesthetic.indexOf("classic") !== -1) {
        score -= 4;
        limits.push("Historic ornament can overpower a technology or finance identity.");
      }
    }
    if (coastalBrand) {
      if (venue.amenities.indexOf("Waterfront") !== -1 || venue.aesthetic.indexOf("natural") !== -1) {
        score += 6;
        reasons.push("Water, palms, or garden light echo a coastal palette.");
      }
    }
    if (b.theme && venue.blurb) {
      score += 2;
    }
    return { score: score, reasons: reasons, limits: limits };
  }

  function parseUtterance(text, brief) {
    const next = clone(brief);
    const raw = String(text || "");
    const t = raw.toLowerCase();

    TYPES.forEach(function (pair) {
      if (pair[1].some(function (word) { return t.includes(word); })) next.type = pair[0];
    });

    NEIGHBORHOODS.slice().sort(function (a, b) { return b.length - a.length; }).forEach(function (name) {
      if (!next.location && t.includes(name.toLowerCase())) next.location = name;
    });
    if (t.includes("miami beach") && !next.location) next.location = "South Beach";
    if (/\banywhere\b|\bany neighborhood\b|\bacross miami\b/.test(t)) next.location = "";

    const guestMatch = t.match(/(\d{1,4})\s*(guest|people|attendee|pax|person)/) || t.match(/\bfor\s+(\d{2,4})\b/);
    if (guestMatch) next.guests = Number(guestMatch[1]);
    if (/\blarger\b|\bmore guests\b/.test(t) && next.guests) next.guests += 40;

    const kMatch = t.match(/\$?\s*(\d{1,3})\s*k\b/);
    const moneyMatch = t.match(/\$\s*([\d,]{3,})/);
    const underMatch = t.match(/(?:under|budget|below|around|about)\s+\$?\s*([\d,]{2,})/);
    if (kMatch) next.budget = Number(kMatch[1]) * 1000;
    else if (moneyMatch) next.budget = Number(moneyMatch[1].replace(/,/g, ""));
    else if (underMatch) next.budget = Number(underMatch[1].replace(/,/g, ""));
    if (/\bcheaper\b|\bless expensive\b|\blower budget\b/.test(t)) {
      next.budget = next.budget ? Math.round(next.budget * 0.75) : 12000;
    }

    const iso = t.match(/\d{4}-\d{2}-\d{2}/);
    const month = t.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june|july|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:,?\s*(\d{4}))?/);
    if (iso) next.date = iso[0];
    else if (month) next.date = month[0];

    const duration = t.match(/(\d+)\s*(hour|day)/);
    if (duration) next.duration = duration[1] + " " + duration[2] + (duration[1] === "1" ? "" : "s");

    STYLES.forEach(function (pair) {
      if (pair[1].some(function (word) { return t.includes(word); })) next.style = pair[0];
    });

    if (/\boutdoor\b|\boutside\b|\bgarden\b|\blawn\b/.test(t)) next.setting = "outdoor";
    else if (/\bindoor\b|\binside\b/.test(t)) next.setting = "indoor";
    else if (/\beither\b|\bindoor or outdoor\b/.test(t)) next.setting = "either";
    if (next.style === "rooftop" || next.style === "outdoor") next.setting = "outdoor";

    AESTHETICS.forEach(function (word) {
      if (t.includes(word)) next.aesthetic = word;
    });
    if (/\bformal\b|\belegant\b|\bblack-tie\b|\bblack tie\b/.test(t)) next.aesthetic = next.aesthetic || "elegant";
    if (t.includes("networking")) next.type = "networking";

    if (/\b360\b|\btour\b|\bvirtual\b/.test(t)) next.tour = true;
    if (/\baccessible\b|\bstep-free\b|\bwheelchair\b/.test(t)) next.accessible = true;
    if (/\bwaterfront\b|\bbay\b|\bocean\b/.test(t)) next.waterfront = true;

    if (/\btech\b|\binnovation\b|\bstartup\b/.test(t)) {
      next.type = next.type || "conference";
      next.aesthetic = next.aesthetic || "modern";
      next.brandNote = "Technology company, modern innovation tone.";
    }
    if (/\buniversity\b|\balumni\b|\bcampus\b/.test(t)) {
      next.type = next.type || "networking";
      next.brandNote = "University gathering, professional but welcoming.";
    }
    if (/\bfinancial\b|\bbank\b|\bexecutive\b/.test(t) && !next.type) {
      next.type = "meeting";
      next.aesthetic = next.aesthetic || "elegant";
      next.brandNote = "Financial company, restrained and formal.";
    }

    if (raw.trim().length > 40) next.freeText = raw.trim();
    return next;
  }

  function preferredLayoutIds(brief) {
    const type = brief && brief.type;
    if (type === "wedding" || type === "gala" || type === "social") return ["banquet", "cocktail", "theater"];
    if (type === "meeting") return ["boardroom", "ushape", "hollow", "classroom"];
    if (type === "conference") return ["theater", "classroom", "ushape"];
    if (type === "networking") return ["cocktail", "banquet", "theater"];
    return [];
  }

  function bestConfig(venue, brief) {
    const configs = venue.configs || [];
    const b = brief || {};
    if (!configs.length) return null;
    if (b.layout) {
      const chosen = configs.find(function (item) { return item.id === b.layout; });
      if (chosen) return chosen;
    }
    const preferred = preferredLayoutIds(b);
    const ordered = preferred.length
      ? preferred.map(function (id) { return configs.find(function (item) { return item.id === id; }); }).filter(Boolean).concat(configs)
      : configs;
    if (b.guests) {
      const fits = ordered.filter(function (item) { return item.capacity >= b.guests; });
      if (fits.length) return fits[0];
    }
    return ordered[0];
  }

  function scoreVenue(venue, brief) {
    let score = 46;
    const reasons = [];
    const limits = [];
    const b = brief || {};
    const fit = bestConfig(venue, b);

    if (b.guests) {
      if (fit && b.guests <= fit.capacity) {
        const ratio = b.guests / fit.capacity;
        if (ratio >= 0.4 && ratio <= 0.92) {
          score += 18;
          reasons.push("Capacity fits: " + b.guests + " guests in " + fit.label.toLowerCase() + " (up to " + fit.capacity + ").");
        } else {
          score += 9;
          reasons.push("The room can hold " + b.guests + " in " + fit.label.toLowerCase() + ", with space left over.");
        }
      } else {
        score -= 28;
        limits.push("Guest count is above the posted maximum of " + venue.capacity + ".");
      }
    }

    if (b.budget) {
      if (venue.priceFrom <= b.budget) {
        score += 14;
        reasons.push("Sample starting rental of $" + venue.priceFrom.toLocaleString("en-US") + " is within a $" + Number(b.budget).toLocaleString("en-US") + " rental budget.");
      } else {
        score -= 14;
        limits.push("Sample starting rental ($" + venue.priceFrom.toLocaleString("en-US") + ") is above the stated budget.");
      }
    }

    if (b.location) {
      if (venue.neighborhood.toLowerCase() === String(b.location).toLowerCase()) {
        score += 16;
        reasons.push("It is in " + venue.neighborhood + ", the neighborhood you named.");
      } else {
        score -= 6;
        limits.push("This room is in " + venue.neighborhood + ", not " + b.location + ".");
      }
    }

    if (b.type && venue.types.indexOf(b.type) !== -1) {
      score += 10;
      reasons.push("The listing is set up for " + b.type + " events.");
    } else if (b.type) {
      score -= 6;
      limits.push("It is not aimed at " + b.type + " events.");
    }

    if (b.style && venue.styles.indexOf(b.style) !== -1) {
      score += 8;
      reasons.push("The " + b.style + " format matches the request.");
    }

    if (b.setting && b.setting !== "either") {
      const ok = venue.indoor === b.setting || venue.indoor === "both" || (b.setting === "outdoor" && venue.indoor === "outdoor");
      if (ok) {
        score += 8;
        reasons.push(venue.indoor === "both" ? "You can stay inside or move outside." : "The setting matches the request.");
      } else {
        score -= 8;
        limits.push("The setting is " + venue.indoor + ".");
      }
    }

    if (b.aesthetic && venue.aesthetic.indexOf(b.aesthetic) !== -1) {
      score += 7;
      reasons.push("The room reads " + b.aesthetic + ".");
    }

    if (b.accessible && venue.amenities.indexOf("Accessible entry") !== -1) {
      score += 4;
      reasons.push("Accessible entry is listed.");
    }
    if (b.waterfront && venue.amenities.indexOf("Waterfront") !== -1) {
      score += 5;
      reasons.push("The space is on the water.");
    }
    if (b.tour && venue.tour) {
      score += 3;
      reasons.push("A sample panoramic tour is on the listing.");
    }
    const brand = brandFit(venue, b);
    score += brand.score;
    brand.reasons.forEach(function (line) { reasons.push(line); });
    brand.limits.forEach(function (line) { limits.push(line); });
    if ((b.brandNote || b.logo || b.hasLogo) && !brand.reasons.length) {
      score += 2;
      reasons.push("Your brand note is on the brief. Open the studio to preview a logo in this room.");
    }

    if (b.date && venue.blackouts && venue.blackouts.indexOf(b.date) !== -1) {
      score -= 20;
      limits.push("Sample calendar shows a hold on " + b.date + ".");
    }

    score = Math.max(6, Math.min(97, Math.round(score)));
    return { venue: venue, score: score, reasons: reasons, limits: limits, layout: fit };
  }

  function rankVenues(venues, brief) {
    return venues
      .map(function (venue) { return scoreVenue(venue, brief); })
      .sort(function (a, b) { return b.score - a.score; });
  }

  function missingQuestion(brief) {
    if (brief.type && brief.guests) return null;
    if (!brief.type) {
      return {
        ask: "What kind of event is this? A wedding, a conference, an executive meeting, a gala, or a social celebration.",
        suggestions: ["Wedding reception", "Innovation summit", "Executive meeting", "University networking reception", "Birthday celebration"]
      };
    }
    if (!brief.guests) {
      return {
        ask: "How many guests should the room hold?",
        suggestions: ["80 guests", "150 guests", "300 guests"]
      };
    }
    if (!brief.location && !brief.budget) {
      return {
        ask: "Where should it be, and what rental budget should I stay under? A neighborhood or a ceiling is enough.",
        suggestions: ["Coral Gables under $20k", "Brickell, modern", "South Beach, waterfront", "Anywhere in Miami under $12k"]
      };
    }
    return null;
  }

  function describeBrief(brief) {
    const bits = [];
    if (brief.type) bits.push(brief.type);
    if (brief.guests) bits.push(brief.guests + " guests");
    if (brief.location) bits.push(brief.location);
    if (brief.date) bits.push(brief.date);
    if (brief.duration) bits.push(brief.duration);
    if (brief.budget) bits.push("rental budget $" + Number(brief.budget).toLocaleString("en-US"));
    if (brief.style) bits.push(brief.style);
    if (brief.setting) bits.push(brief.setting);
    if (brief.aesthetic) bits.push(brief.aesthetic + " atmosphere");
    if (brief.brandNote) bits.push(brief.brandNote);
    return bits.join(", ");
  }

  function reply(venues, brief, text, profile) {
    const next = parseUtterance(text, applyProfile(brief, profile));
    const gap = missingQuestion(next);
    if (gap) {
      return {
        brief: next,
        suggestions: gap.suggestions,
        text: gap.ask + (describeBrief(next) ? " So far I have " + describeBrief(next) + "." : ""),
        ranked: []
      };
    }
    const ranked = rankVenues(venues, next).slice(0, 3);
    const lead = ranked[0];
    const names = ranked.map(function (item) {
      return item.venue.hotel + " — " + item.venue.name + " (" + item.score + " match)";
    });
    let textOut = "Here are three sample matches for " + describeBrief(next) + ". ";
    textOut += "The strongest on these demonstration listings is " + lead.venue.name + " at " + lead.venue.hotel + ". ";
    textOut += lead.reasons.slice(0, 2).join(" ");
    if (lead.limits.length) textOut += " Worth knowing: " + lead.limits[0];
    if (next.brandNote || next.theme) {
      const brandLine = (lead.reasons || []).filter(function (line) { return /brand|identity|palette|plaster|glass/.test(line.toLowerCase()); })[0];
      if (brandLine) textOut += " " + brandLine;
    }
    textOut += " Prices and dates are sample data, not live holds.";
    return {
      brief: next,
      suggestions: ["Show me something cheaper", "Only rooftops", "Add a 360 tour", "Make it more formal"],
      text: textOut,
      ranked: ranked,
      summary: names
    };
  }

  function compareSummary(picks, brief) {
    if (!picks.length) return "Save at least two rooms to compare them.";
    const ranked = picks.map(function (venue) { return scoreVenue(venue, brief || {}); });
    ranked.sort(function (a, b) { return b.score - a.score; });
    const lines = ranked.map(function (item) {
      const good = item.reasons[0] || (item.venue.neighborhood + ", up to " + item.venue.capacity + " guests.");
      const bad = item.limits[0] || ("Sample rental starts at $" + item.venue.priceFrom.toLocaleString("en-US") + ".");
      return item.venue.name + " at " + item.venue.hotel + ": " + good + " Limitation: " + bad;
    });
    const top = ranked[0];
    return "Sample read, not a booking recommendation from a hotel. If the brief holds, start with " + top.venue.name + " (" + top.score + " on this demo scale). " + lines.join(" ");
  }

  return {
    parseUtterance: parseUtterance,
    applyProfile: applyProfile,
    scoreVenue: scoreVenue,
    rankVenues: rankVenues,
    reply: reply,
    compareSummary: compareSummary,
    bestConfig: bestConfig
  };
});
