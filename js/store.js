(function (root) {
  const KEY = "breeze-demo-v1";

  const seedInquiries = [
    {
      id: "inq-demo-1",
      venueId: "palmetto",
      ownerEmail: "elena@example.com",
      name: "Elena Voss",
      email: "elena@example.com",
      phone: "305-555-0148",
      date: "2026-12-12",
      start: "18:00",
      end: "23:00",
      guests: 180,
      layout: "banquet",
      catering: "Seated dinner",
      notes: "University alumni reception. Need a step-free path and a small stage for remarks.",
      status: "Inquiry received",
      confirmed: false,
      created: "2026-11-02T15:00:00.000Z",
      messages: [
        { from: "planner", name: "Elena Voss", text: "Can the hotel hold the date while we confirm the speaker?", at: "2026-11-02T15:04:00.000Z" }
      ]
    },
    {
      id: "inq-demo-2",
      venueId: "palmetto",
      ownerEmail: "marcus@example.com",
      name: "Marcus Adeyemi",
      email: "marcus@example.com",
      phone: "305-555-0190",
      date: "2027-02-06",
      start: "09:00",
      end: "16:00",
      guests: 220,
      layout: "theater",
      catering: "Coffee and conference",
      notes: "Nonprofit board summit. Asking for a daytime proposal.",
      status: "Proposal sent",
      confirmed: false,
      created: "2026-10-28T13:20:00.000Z",
      messages: [
        { from: "hotel", name: "Palmetto House", text: "We sent a sample proposal. The date is not confirmed until you accept it and we counter-sign.", at: "2026-10-29T16:10:00.000Z" }
      ]
    }
  ];

  function blank() {
    return {
      user: null,
      users: [
        { name: "Avery Cole", email: "avery@example.com", role: "planner" },
        { name: "Jordan Hale", email: "jordan@example.com", role: "partner", hotelId: "palmetto" }
      ],
      favorites: [],
      compare: [],
      brief: {},
      messages: [],
      inquiries: seedInquiries,
      studios: {},
      venueEdits: {},
      partnerLeads: [],
      speak: false
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const parsed = JSON.parse(raw);
      return Object.assign(blank(), parsed, {
        users: parsed.users && parsed.users.length ? parsed.users : blank().users,
        inquiries: parsed.inquiries || seedInquiries
      });
    } catch (err) {
      return blank();
    }
  }

  const state = load();

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      const copy = Object.assign({}, state);
      if (copy.brief) copy.brief = Object.assign({}, copy.brief, { logo: "", inspiration: "" });
      copy.studios = {};
      try { localStorage.setItem(KEY, JSON.stringify(copy)); } catch (again) { /* keep the session in memory */ }
    }
  }

  function venueById(id) {
    const base = root.BreezeData.VENUES.find(function (venue) { return venue.id === id; });
    if (!base) return null;
    const edit = state.venueEdits[id] || {};
    const merged = Object.assign({}, base, edit);
    merged.parking = base.parking;
    merged.configs = base.configs;
    merged.images = base.images;
    return merged;
  }

  root.BreezeStore = { state: state, save: save, venueById: venueById, blank: blank };
})(typeof globalThis !== "undefined" ? globalThis : this);
