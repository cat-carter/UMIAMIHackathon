(function () {
  const data = window.BreezeData;
  const ai = window.BreezeAI;
  const store = window.BreezeStore;
  const state = store.state;

  const ui = {
    filters: {
      q: "", location: "", date: "", guests: "", type: "", budget: "",
      style: "", config: "", amenity: "", setting: "", tour: ""
    },
    applyQuery: true,
    map: false,
    photo: {},
    before: {},
    video: {},
    pan: {},
    hotspot: {},
    layout: {},
    tab: "saved",
    partnerTab: "inbox",
    toast: "",
    breezeOpen: false,
    breezeWaiting: false,
    breezeLive: null
  };

  const TITLES = {
    "": "Breeze — Hotel event spaces",
    discover: "Discover venues — Breeze",
    venue: "Venue — Breeze",
    assistant: "Find my space — Breeze",
    how: "How it works — Breeze",
    account: "Sign in — Breeze",
    profile: "Your profile — Breeze",
    dashboard: "Your events — Breeze",
    compare: "Compare venues — Breeze",
    studio: "Planning studio — Breeze",
    inquire: "Booking inquiry — Breeze",
    partner: "Hotel dashboard — Breeze",
    join: "Partner with Breeze — Breeze",
    faq: "FAQs — Breeze"
  };

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function money(n) {
    return "$" + Number(n || 0).toLocaleString("en-US");
  }

  function route() {
    const raw = (location.hash || "#/").replace(/^#/, "");
    const bits = raw.split("?");
    const parts = bits[0].split("/").filter(Boolean);
    return { parts: parts, params: new URLSearchParams(bits[1] || ""), key: parts[0] || "" };
  }

  function venue(id) {
    return store.venueById(id);
  }

  function allVenues() {
    return data.VENUES.map(function (item) { return venue(item.id); });
  }

  function savedStudio(id) {
    return Object.assign({
      layout: (venue(id).configs[0] || {}).id || "banquet",
      guests: "",
      cateringId: "dinner",
      avId: "standard",
      furnitureId: "house",
      palette: "coast",
      notes: "",
      logo: "",
      inspiration: ""
    }, state.studios[id] || {});
  }

  function packageBy(list, id) {
    return list.find(function (item) { return item.id === id; }) || list[0];
  }

  function estimate(v, config) {
    const guests = Number(config.guests) || Number(state.brief.guests) || 100;
    const catering = packageBy(data.CATERING, config.cateringId);
    const av = packageBy(data.AV, config.avId);
    const furniture = packageBy(data.FURNITURE, config.furnitureId);
    const rental = Number(v.priceFrom);
    const food = catering.price * guests;
    const fee = Math.round((rental + food + av.price + furniture.price) * 0.08);
    return {
      guests: guests,
      rental: rental,
      food: food,
      av: av.price,
      furniture: furniture.price,
      fee: fee,
      total: rental + food + av.price + furniture.price + fee,
      catering: catering,
      avItem: av,
      furnitureItem: furniture
    };
  }

  function toast(message) {
    const node = document.getElementById("toast");
    if (!node) return;
    node.hidden = false;
    node.textContent = message;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { node.hidden = true; }, 2800);
  }

  function floorplan(id) {
    const seat = "#1e4d5c";
    const table = "#e5d9c6";
    const stage = "#5f725f";
    let body = "";
    if (id === "theater") {
      body = '<rect x="70" y="14" width="180" height="26" rx="4" fill="' + stage + '"></rect>';
      for (let r = 0; r < 6; r += 1) {
        for (let c = 0; c < 10; c += 1) body += '<rect x="' + (28 + c * 27) + '" y="' + (58 + r * 20) + '" width="16" height="10" rx="2" fill="' + seat + '"></rect>';
      }
    } else if (id === "classroom") {
      for (let r = 0; r < 3; r += 1) {
        body += '<rect x="50" y="' + (36 + r * 52) + '" width="220" height="18" rx="3" fill="' + table + '"></rect>';
        for (let c = 0; c < 8; c += 1) body += '<rect x="' + (58 + c * 26) + '" y="' + (58 + r * 52) + '" width="16" height="10" rx="2" fill="' + seat + '"></rect>';
      }
    } else if (id === "banquet") {
      [[70, 50], [160, 50], [250, 50], [70, 130], [160, 130], [250, 130]].forEach(function (p) {
        body += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="22" fill="' + table + '"></circle>';
        body += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="28" fill="none" stroke="' + seat + '" stroke-width="4" stroke-dasharray="3 4"></circle>';
      });
    } else if (id === "boardroom") {
      body = '<rect x="70" y="70" width="180" height="64" rx="8" fill="' + table + '"></rect>';
      for (let i = 0; i < 5; i += 1) {
        body += '<rect x="' + (84 + i * 32) + '" y="48" width="18" height="12" rx="2" fill="' + seat + '"></rect>';
        body += '<rect x="' + (84 + i * 32) + '" y="144" width="18" height="12" rx="2" fill="' + seat + '"></rect>';
      }
    } else if (id === "ushape") {
      body = '<rect x="60" y="40" width="18" height="120" fill="' + table + '"></rect><rect x="242" y="40" width="18" height="120" fill="' + table + '"></rect><rect x="60" y="142" width="200" height="18" fill="' + table + '"></rect>';
    } else if (id === "hollow") {
      body = '<rect x="70" y="40" width="180" height="16" fill="' + table + '"></rect><rect x="70" y="144" width="180" height="16" fill="' + table + '"></rect><rect x="70" y="40" width="16" height="120" fill="' + table + '"></rect><rect x="234" y="40" width="16" height="120" fill="' + table + '"></rect>';
    } else {
      [[60, 40], [140, 70], [230, 46], [90, 130], [180, 120], [250, 140]].forEach(function (p) {
        body += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="16" fill="' + table + '" stroke="' + seat + '"></circle>';
      });
    }
    const label = (data.LAYOUTS[id] || "Layout") + " sample floor plan";
    return '<svg viewBox="0 0 320 200" role="img" aria-label="' + esc(label) + '">' + body + "</svg>";
  }

  function activeLayout(v) {
    const chosen = ui.layout[v.id];
    return v.configs.find(function (item) { return item.id === chosen; }) || v.configs[0];
  }

  function card(v) {
    const held = ui.filters.date && v.blackouts.indexOf(ui.filters.date) !== -1;
    const fav = state.favorites.indexOf(v.id) !== -1;
    const compared = state.compare.indexOf(v.id) !== -1;
    return '<article class="card">' +
      '<div class="card-media"><img src="' + esc(v.images[0]) + '" alt="Sample photograph of ' + esc(v.name) + ' at ' + esc(v.hotel) + '">' +
      (v.scenes ? '<span class="badge">Walk the 360°</span>' : "") +
      '<button class="icon-btn" type="button" data-action="fav" data-id="' + esc(v.id) + '" aria-pressed="' + fav + '" aria-label="' + (fav ? "Remove" : "Save") + " " + esc(v.name) + '">♥</button></div>' +
      '<div class="card-body"><p class="kicker">' + esc(v.hotel) + "</p><h3>" + esc(v.name) + "</h3>" +
      "<p>" + esc(v.neighborhood) + " · " + esc(v.address) + "</p>" +
      '<div class="meta"><span class="tag">Up to ' + v.capacity + '</span><span class="tag">' + esc(v.configs.slice(0, 3).map(function (c) { return c.label; }).join(" · ")) + "</span></div>" +
      "<p><strong>From " + money(v.priceFrom) + "</strong> sample rental</p>" +
      "<p class=\"note\">" + esc(v.hours) + ". " + esc(v.curfew) + "</p>" +
      "<p class=\"note\">Parking " + esc(v.parking.cost) + " · " + esc(v.parking.location) + "</p>" +
      (held ? '<p class="note">Sample calendar: this date is already held.</p>' : "") +
      '<div class="card-actions"><a class="btn btn-primary btn-small" href="#/venue/' + esc(v.id) + '">View venue details</a>' +
      '<button class="btn btn-ghost btn-small" type="button" data-action="compare" data-id="' + esc(v.id) + '" aria-pressed="' + compared + '">' + (compared ? "In compare" : "Compare") + "</button></div></div></article>";
  }

  function planner() {
    return state.user && state.user.role === "planner" ? state.user : null;
  }

  function header(key) {
    const user = state.user;
    const account = user ? (user.role === "partner" ? "#/partner" : "#/dashboard") : "#/account";
    const accountLabel = user ? esc(user.name.split(" ")[0]) : "Sign in";
    function link(href, id, label) {
      return '<a href="' + href + '"' + (key === id ? ' aria-current="page"' : "") + ">" + label + "</a>";
    }
    return '<header class="site-header"><div class="wrap header-inner">' +
      '<a class="brand" href="#/"><span class="mark" aria-hidden="true"></span>Breeze</a>' +
      '<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="nav">Menu</button>' +
      '<nav class="nav" id="nav">' +
      link("#/discover", "discover", "Discover Venues") +
      link("#/how", "how", "How It Works") +
      (planner() ? link("#/profile", "profile", "Your profile") : "") +
      link(account, user && user.role === "partner" ? "partner" : (user ? "dashboard" : "account"), accountLabel) +
      '<button class="btn btn-gold btn-small" type="button" data-action="open-breeze">Booking Should Be a Breeze.</button>' +
      "</nav></div></header>";
  }

  function footer() {
    return '<footer class="site-footer"><div class="wrap footer-grid">' +
      "<div><strong>Breeze</strong><p>Demonstration studio for hotel event spaces. Coral Gables, Miami.</p><p>hello@breeze.example</p></div>" +
      '<div><p><a href="#/faq">FAQs</a></p><p><a href="#/join">Hotel partnership registration</a></p><p><a href="#/compare">Compare saved venues</a></p></div>' +
      "<div><p>Photographs were created for this demo and do not depict a specific hotel. Prices, hours, and availability are sample data.</p></div>" +
      "</div></footer>";
  }

  function shell(key, body) {
    document.title = TITLES[key] || TITLES[""];
    const banner = sessionStorage.getItem("breeze-banner") === "hide" ? "" :
      '<div class="banner">Demonstration only. Venue details, prices, tours, and availability are sample data, not live hotel inventory.' +
      '<button type="button" data-action="dismiss-banner">Dismiss</button></div>';
    return banner + header(key) + '<main id="main">' + body + "</main>" + footer();
  }

  function home() {
    const featured = allVenues().filter(function (v) { return v.featured; });
    const popular = allVenues().filter(function (v) { return v.popular; });
    const corporate = allVenues().filter(function (v) { return v.corporate; }).slice(0, 3);
    const weddings = allVenues().filter(function (v) { return v.wedding; }).slice(0, 3);
    const options = ["", "South Beach", "Mid-Beach", "Brickell", "Brickell Key", "Downtown", "Coral Gables", "Coconut Grove", "Edgewater"]
      .map(function (name) { return '<option value="' + esc(name) + '">' + (name || "Anywhere in Miami") + "</option>"; }).join("");
    return '<section class="hero"><div class="wrap"><div class="hero-frame">' +
      '<img src="images/hero-ballroom.jpg" alt="Sample evening ballroom with ivory tables and ocean windows">' +
      '<div class="hero-copy"><p class="eyebrow">Booking should be a breeze</p>' +
      "<h1>Find the Space. Visualize the Experience. Bring Your Event to Life.</h1>" +
      '<p class="lede">Discover and book exceptional hotel event spaces with AI-powered venue matching and immersive virtual tours.</p></div></div>' +
      '<form class="search-card" data-form="search"><div class="search-grid">' +
      '<label>Event location<select name="location">' + options + "</select></label>" +
      '<label>Event date<input name="date" type="date"></label>' +
      '<label>Number of guests<input name="guests" type="number" min="1" max="2000" placeholder="150"></label>' +
      '<label>Event type<select name="type"><option value="">Any</option><option>wedding</option><option>social</option><option>gala</option><option>conference</option><option>meeting</option><option>networking</option></select></label>' +
      '</div><div class="search-actions"><button class="btn btn-primary" type="submit">Explore Venues</button>' +
      '<button class="btn btn-ghost" type="button" data-action="ai-from-search">Ask Breeze</button></div></form></div></section>' +
      '<section class="section"><div class="wrap"><div class="section-head"><h2>Featured venues</h2><p>Sample Miami listings. Save a room or open the full record.</p></div><div class="cards">' +
      featured.map(card).join("") + "</div></div></section>" +
      '<section class="section" style="padding-top:0"><div class="wrap"><div class="section-head"><h2>How it works</h2></div><div class="steps">' +
      '<article class="step"><span>01</span><h3>Tell us about your event.</h3><p>Share the date, guest count, budget, neighborhood, and the feeling you want in the room.</p></article>' +
      '<article class="step"><span>02</span><h3>Explore AI-matched hotel spaces.</h3><p>Breeze sits along the bottom of every page. Tell it the event, the brand, or the feeling. It reads your planner profile when you have one.</p></article>' +
      '<article class="step"><span>03</span><h3>Customize, compare, and book your venue.</h3><p>Switch layouts, build a sample budget, and send an inquiry. A hotel confirmation is still required.</p></article>' +
      "</div></div></section>" +
      '<section class="section" style="padding-top:0"><div class="wrap"><div class="section-head"><h2>Popular event spaces</h2><a href="#/discover">See the directory</a></div><div class="cards">' + popular.map(card).join("") + "</div></div></section>" +
      '<section class="section" style="padding-top:0"><div class="wrap"><div class="section-head"><h2>Corporate meetings and conferences</h2></div><div class="cards">' + corporate.map(card).join("") + "</div></div></section>" +
      '<section class="section" style="padding-top:0"><div class="wrap"><div class="section-head"><h2>Weddings and social celebrations</h2></div><div class="cards">' + weddings.map(card).join("") + "</div></div></section>" +
      '<section class="section" style="padding-top:0"><div class="wrap"><div class="section-head"><h2>For hotel partners</h2><p>A storefront for the rooms that usually hide behind a PDF.</p></div><div class="benefits">' +
      "<article class=\"benefit panel\"><h3>Qualified inquiries</h3><p>Planners arrive with a date, a guest count, a layout, and a sample budget instead of a blank email.</p></article>" +
      "<article class=\"benefit panel\"><h3>Fewer repeated questions</h3><p>Tours, floor plans, capacities, curfews, and parking live on the listing.</p></article>" +
      "<article class=\"benefit panel\"><h3>A pipeline you can see</h3><p>Track saves, tour interactions, and inquiries in the partner dashboard.</p></article>" +
      '</div><p class="inline" style="margin-top:1rem"><a class="btn btn-primary" href="#/join">Register your hotel</a><a class="btn btn-ghost" href="#/partner">View the sample dashboard</a></p></div></section>' +
      '<section class="section" style="padding-top:0"><div class="wrap"><div class="section-head"><h2>Sample stories</h2><p>Illustrative comments for this demonstration, not verified reviews.</p></div><div class="quotes">' +
      '<figure class="quote"><p>“We stopped guessing from photographs. The layout switch showed the alumni dinner would actually fit.”</p><footer>Sample planner · university event</footer></figure>' +
      '<figure class="quote"><p>“The inquiry already had the guest count and the curfew question. That saved two emails.”</p><footer>Sample hotel sales lead</footer></figure>' +
      '<figure class="quote"><p>“Comparing the rooftop against the ballroom made the budget choice obvious before we called anyone.”</p><footer>Sample corporate planner</footer></figure>' +
      "</div></div></section>" +
      '<section class="section" style="padding-top:0"><div class="wrap"><div class="band"><div><h2>Booking should be a breeze.</h2><p>The desk along the bottom of the page is Breeze. A neighborhood, a guest count, or a color is enough to start.</p></div><button class="btn btn-primary" type="button" data-action="open-breeze">Ask Breeze</button></div></div></section>';
  }

  function filteredVenues() {
    const f = ui.filters;
    return allVenues().filter(function (v) {
      const blob = (v.hotel + " " + v.name + " " + v.neighborhood + " " + v.blurb).toLowerCase();
      if (f.q && blob.indexOf(f.q.toLowerCase()) === -1) return false;
      if (f.location && v.neighborhood !== f.location) return false;
      if (f.guests && v.capacity < Number(f.guests)) return false;
      if (f.type && v.types.indexOf(f.type) === -1) return false;
      if (f.budget === "under-10" && v.priceFrom > 10000) return false;
      if (f.budget === "under-15" && v.priceFrom > 15000) return false;
      if (f.budget === "under-25" && v.priceFrom > 25000) return false;
      if (f.budget === "over-25" && v.priceFrom < 25000) return false;
      if (f.style && v.styles.indexOf(f.style) === -1) return false;
      if (f.config && !v.configs.some(function (c) { return c.id === f.config; })) return false;
      if (f.amenity && v.amenities.indexOf(f.amenity) === -1) return false;
      if (f.setting && f.setting !== "either" && v.indoor !== f.setting && v.indoor !== "both") return false;
      if (f.tour === "yes" && !v.tour) return false;
      if (f.date && f.hideHolds === "yes" && v.blackouts.indexOf(f.date) !== -1) return false;
      return true;
    });
  }

  function discover() {
    const r = route();
    if (ui.applyQuery) {
      ui.applyQuery = false;
      r.params.forEach(function (value, key) { if (key in ui.filters || key === "hideHolds") ui.filters[key] = value; });
    }
    const list = filteredVenues();
    const sel = function (name, value) { return ui.filters[name] === value ? " selected" : ""; };
    const neighborhoods = ["", "South Beach", "Mid-Beach", "Brickell", "Brickell Key", "Downtown", "Coral Gables", "Coconut Grove", "Edgewater"];
    const map = ui.map ? '<div class="map"><p class="map-label">Sample map of Miami. Pins are demonstration locations.</p>' +
      list.map(function (v) {
        return '<a class="pin" style="left:' + v.map.x + "%;top:" + v.map.y + '%" href="#/venue/' + esc(v.id) + '">' + esc(v.hotel) + "<small>" + esc(v.name) + "</small></a>";
      }).join("") + "</div>" : "";
    const filters = '<form class="filters panel" data-form="filters"><h2>Filters</h2>' +
      '<label>Search<input name="q" value="' + esc(ui.filters.q) + '" placeholder="Hotel or room"></label>' +
      '<label>Location<select name="location">' + neighborhoods.map(function (n) { return '<option value="' + esc(n) + '"' + sel("location", n) + ">" + (n || "Any") + "</option>"; }).join("") + "</select></label>" +
      '<label>Event date<input type="date" name="date" value="' + esc(ui.filters.date) + '"></label>' +
      '<label>Guest capacity<input type="number" name="guests" min="1" value="' + esc(ui.filters.guests) + '" placeholder="Minimum the room must hold"></label>' +
      '<label>Budget range<select name="budget">' +
      '<option value=""' + sel("budget", "") + ">Any sample rental</option>" +
      '<option value="under-10"' + sel("budget", "under-10") + ">Under $10,000</option>" +
      '<option value="under-15"' + sel("budget", "under-15") + ">Under $15,000</option>" +
      '<option value="under-25"' + sel("budget", "under-25") + ">Under $25,000</option>" +
      '<option value="over-25"' + sel("budget", "over-25") + ">$25,000 and above</option></select></label>" +
      '<label>Event type<select name="type"><option value="">Any</option>' + ["wedding", "social", "gala", "conference", "meeting", "networking"].map(function (t) { return '<option' + sel("type", t) + ">" + t + "</option>"; }).join("") + "</select></label>" +
      '<label>Venue style<select name="style"><option value="">Any</option>' + ["ballroom", "rooftop", "outdoor", "conference", "meeting", "banquet"].map(function (t) { return '<option' + sel("style", t) + ">" + t + "</option>"; }).join("") + "</select></label>" +
      '<label>Room configuration<select name="config"><option value="">Any</option>' + Object.keys(data.LAYOUTS).map(function (id) { return '<option value="' + id + '"' + sel("config", id) + ">" + data.LAYOUTS[id] + "</option>"; }).join("") + "</select></label>" +
      '<label>Amenity<select name="amenity"><option value="">Any</option>' + ["Accessible entry", "In-house catering", "Waterfront", "Stage", "Valet", "Loading dock"].map(function (t) { return '<option' + sel("amenity", t) + ">" + esc(t) + "</option>"; }).join("") + "</select></label>" +
      '<label>Indoor / outdoor<select name="setting"><option value="">Any</option><option value="indoor"' + sel("setting", "indoor") + '>Indoor</option><option value="outdoor"' + sel("setting", "outdoor") + '>Outdoor</option><option value="either"' + sel("setting", "either") + ">Either</option></select></label>" +
      '<label>360° tour<select name="tour"><option value="">Any</option><option value="yes"' + sel("tour", "yes") + ">Sample tour available</option></select></label>" +
      '<label>Sample holds<select name="hideHolds"><option value="">Show held dates</option><option value="yes"' + sel("hideHolds", "yes") + ">Hide sample holds</option></select></label>" +
      '<button class="btn btn-ghost btn-small" type="button" data-action="reset-filters">Clear filters</button>' +
      '<button class="btn btn-primary btn-small" type="button" data-action="toggle-map" aria-pressed="' + ui.map + '">' + (ui.map ? "Hide map" : "Map view") + "</button></form>";
    const tray = state.compare.length ? '<div class="compare-tray"><span>' + state.compare.length + ' saved to compare</span><a class="btn btn-primary btn-small" href="#/compare">Compare side by side</a></div>' : "";
    return '<section class="page"><div class="wrap"><div class="section-head"><h1 class="page-title">Discover venues</h1><p>Eight sample hotels around Miami. Nothing here is a live calendar.</p></div>' +
      '<div class="discover-layout">' + filters + '<div>' + map +
      (list.length ? '<div class="cards">' + list.map(card).join("") + "</div>" : '<div class="panel" style="padding:1rem"><h2>No sample rooms match.</h2><p>Clear a filter or lower the guest count.</p></div>') +
      tray + "</div></div></div></section>";
  }

  function venuePage(id) {
    const v = venue(id);
    if (!v) return '<section class="page"><div class="wrap"><h1>That room is not in the sample set.</h1></div></section>';
    const photo = v.images[ui.photo[id] || 0] || v.images[0];
    const showingBefore = ui.before[id] && v.before;
    const main = showingBefore ? v.before : photo;
    const layout = activeLayout(v);
    const fav = state.favorites.indexOf(v.id) !== -1;
    const tourBlock = v.scenes ? (
      '<div class="pano-wrap"><div id="pano" class="pano" style="height:560px" role="application" aria-label="360 degree tour of ' + esc(v.name) + '. Drag to look around. Scroll or the buttons to zoom."></div>' +
      '<div class="pano-tools">' +
      '<button class="btn btn-ghost btn-small" type="button" data-action="zoom-in">Closer</button>' +
      '<button class="btn btn-ghost btn-small" type="button" data-action="zoom-out">Wider</button>' +
      "<p class=\"note\">Drag to look around. Scroll or the buttons to zoom. Click the dots to walk the salon, foyer, and courtyard.</p></div></div>"
    ) : "";
    return '<section class="page"><div class="wrap"><p class="kicker">' + esc(v.neighborhood) + "</p><div class=\"section-head\"><h1 class=\"page-title\">" + esc(v.name) + "</h1><p>" + esc(v.hotel) + " · " + esc(v.address) + "</p></div>" +
      '<div class="venue-layout"><div>' + tourBlock +
      '<div class="gallery-main' + (ui.video[id] ? " play" : "") + '"><img src="' + esc(main) + '" alt="Sample photograph of ' + esc(v.name) + '"></div>' +
      '<div class="thumbs">' + v.images.map(function (src, index) {
        return '<button type="button" data-action="photo" data-id="' + esc(v.id) + '" data-index="' + index + '" aria-current="' + (!showingBefore && (ui.photo[id] || 0) === index) + '"><img src="' + esc(src) + '" alt=""></button>';
      }).join("") + "</div>" +
      '<div class="inline" style="margin-top:0.6rem">' +
      (v.before ? '<button class="btn btn-ghost btn-small" type="button" data-action="before" data-id="' + esc(v.id) + '" aria-pressed="' + Boolean(showingBefore) + '">' + (showingBefore ? "Show event setup" : "Show cleared room") + "</button>" : "") +
      '<button class="btn btn-ghost btn-small" type="button" data-action="video" data-id="' + esc(v.id) + '" aria-pressed="' + Boolean(ui.video[id]) + '">' + (ui.video[id] ? "Stop walkthrough" : "Play sample walkthrough") + "</button></div>" +
      (ui.video[id] ? '<p class="note">Demonstration walkthrough. The photograph moves across the frame. It is not a filmed tour of a real hotel.</p>' : "") +
      "</div>" +
      '<aside class="stack"><div class="panel price-box" style="padding:1rem"><p class="kicker">Sample pricing</p><h2>From ' + money(v.priceFrom) + "</h2>" +
      "<p>Minimum spend " + money(v.minSpend) + " in this sample. This is not a quote.</p>" +
      "<p class=\"note\">" + esc(v.hours) + "</p><p class=\"note\">" + esc(v.curfew) + "</p>" +
      '<div class="inline"><a class="btn btn-primary" href="#/inquire/' + esc(v.id) + '">Request a custom quote</a>' +
      '<a class="btn btn-ghost" href="#/studio/' + esc(v.id) + '">Open the studio</a></div>' +
      '<button class="btn btn-ghost" type="button" data-action="fav" data-id="' + esc(v.id) + '" aria-pressed="' + fav + '">' + (fav ? "Saved" : "Save to favorites") + "</button>" +
      '<button class="btn btn-ghost" type="button" data-action="compare" data-id="' + esc(v.id) + '">Add to compare</button></div>' +
      '<div class="panel" style="padding:1rem"><h2>This layout</h2><div class="layout-switch">' +
      v.configs.map(function (c) {
        const on = c.id === layout.id;
        return '<button class="btn btn-small ' + (on ? "btn-primary" : "btn-ghost") + '" type="button" data-action="layout" data-id="' + esc(v.id) + '" data-layout="' + c.id + '" aria-pressed="' + on + '">' + esc(c.label) + "</button>";
      }).join("") + "</div><div class=\"floor\">" + floorplan(layout.id) + "</div>" +
      "<p><strong>" + layout.capacity + " seats</strong> in " + esc(layout.label).toLowerCase() + ".</p><p class=\"note\">" + esc(layout.detail) + "</p></div></aside></div>" +
      '<div class="section"><div class="section-head"><h2>Specifications</h2></div><div class="specs panel" style="padding:0.4rem 1rem">' +
      spec("Square footage", v.sqft.toLocaleString("en-US") + " sq ft") +
      spec("Dimensions", v.dimensions) +
      spec("Maximum occupancy", v.capacity + " guests") +
      spec("Ceiling", v.ceiling) +
      spec("Natural light", v.light) +
      spec("Catering", v.cateringNote) +
      spec("Audiovisual", v.av.join(", ")) +
      spec("Accessibility", v.access) +
      spec("Parking", v.parking.cost + ". " + v.parking.location) +
      spec("Amenities", v.amenities.join(", ")) +
      "</div><p style=\"margin-top:0.8rem\">" + esc(v.about) + "</p></div></div></section>";
  }

  function spec(label, value) {
    return "<div><span>" + esc(label) + "</span><strong>" + esc(value) + "</strong></div>";
  }

  function assistant() {
    ui.breezeOpen = true;
    const p = planner();
    return '<section class="page"><div class="wrap" style="max-width:720px"><p class="kicker">Booking should be a breeze</p><h1 class="page-title">Breeze stays with you.</h1><p>The desk along the bottom of every page is the same concierge. ' +
      (p ? "It already has your profile for " + esc(p.company || p.name) + "." : "Create a planner profile and it will remember the company, the palette, and the usual event.") +
      '</p><p class="note" style="margin-top:0.8rem">Tell it a guest count, a neighborhood, a color, or a feeling. The Palmetto House Grand Salon is the listing with a full 360° walk.</p></div></section>';
  }

  function how() {
    return '<section class="page"><div class="wrap" style="max-width:800px"><p class="kicker">How it works</p><h1 class="page-title">Three steps, then a real hotel still has to say yes.</h1><div class="steps" style="margin-top:1rem">' +
      "<article class=\"step\"><span>01</span><h3>Tell us about your event.</h3><p>Date, duration, guests, neighborhood, budget, atmosphere, and any brand files.</p></article>" +
      "<article class=\"step\"><span>02</span><h3>Explore AI-matched hotel spaces.</h3><p>Breeze reads the event, the planner profile, and the brand note, then ranks sample rooms with a reason for each.</p></article>" +
      "<article class=\"step\"><span>03</span><h3>Customize, compare, and book your venue.</h3><p>Pick a layout, estimate a budget, and send an inquiry. The inquiry is not a reservation.</p></article></div>" +
      '<p class="inline" style="margin-top:1rem"><a class="btn btn-primary" href="#/discover">Explore Venues</a><button class="btn btn-gold" type="button" data-action="open-breeze">Booking Should Be a Breeze.</button></p></div></section>';
  }

  function account() {
    if (state.user) {
      const dest = state.user.role === "partner" ? "#/partner" : "#/dashboard";
      return '<section class="page"><div class="wrap" style="max-width:720px"><h1 class="page-title">You are signed in</h1><p>' + esc(state.user.name) + " · " + esc(state.user.email) + '</p><div class="inline" style="margin-top:1rem"><a class="btn btn-primary" href="' + dest + '">Open your dashboard</a>' +
        (planner() ? '<a class="btn btn-ghost" href="#/profile">Edit profile</a>' : "") +
        '<button class="btn btn-ghost" type="button" data-action="sign-out">Sign out</button></div></div></section>';
    }
    return '<section class="page"><div class="wrap"><h1 class="page-title">Sign in / Create account</h1><p class="muted">Planner profiles stay in this browser. There is no password. Hotel partners still use the partnership desk.</p><div class="account-grid" style="margin-top:1rem">' +
      '<form class="panel stack" style="padding:1rem" data-form="signin"><h2>Sign in</h2><label>Email<input type="email" name="email" required autocomplete="username"></label><button class="btn btn-primary" type="submit">Sign in</button>' +
      '<button class="btn btn-ghost" type="button" data-action="demo-user" data-role="planner">Continue as Avery Cole, planner</button>' +
      '<button class="btn btn-ghost" type="button" data-action="demo-user" data-role="partner">Continue as Jordan Hale, hotel partner</button></form>' +
      '<form class="panel stack" style="padding:1rem" data-form="register"><h2>Create a planner profile</h2><label>Name<input name="name" required autocomplete="name"></label><label>Email<input type="email" name="email" required></label>' +
      '<label>Company<input name="company" placeholder="Optional"></label>' +
      '<button class="btn btn-primary" type="submit">Create profile</button><p class="note">You can add brand, theme, and usual event details after you save.</p></form></div></div></section>';
  }

  function profilePage() {
    const p = planner();
    if (!p) {
      return '<section class="page"><div class="wrap"><h1 class="page-title">Planner profile</h1><p>Create a planner account to keep company, theme, and usual event details. Breeze reads this on every page.</p><a class="btn btn-primary" href="#/account">Create profile</a></div></section>';
    }
    const sel = function (name, value) { return p[name] === value ? " selected" : ""; };
    return '<section class="page"><div class="wrap" style="max-width:760px"><p class="kicker">Planner</p><h1 class="page-title">Your profile</h1><p class="muted">Breeze uses this when it suggests rooms. Edit it whenever the brief changes.</p>' +
      '<form class="panel stack" style="padding:1rem;margin-top:1rem" data-form="profile">' +
      '<div class="form-grid"><label>Name<input name="name" required value="' + esc(p.name) + '"></label>' +
      '<label>Email<input type="email" name="email" required value="' + esc(p.email) + '"></label>' +
      '<label>Company<input name="company" value="' + esc(p.company || "") + '"></label>' +
      '<label>Your role<input name="title" value="' + esc(p.title || "") + '" placeholder="Planner, producer, in-house"></label>' +
      '<label>Usual event type<select name="eventType"><option value="">Not set</option>' + ["wedding", "social", "gala", "conference", "meeting", "networking"].map(function (t) { return '<option' + sel("eventType", t) + ">" + t + "</option>"; }).join("") + "</select></label>" +
      '<label>Usual guest count<input type="number" name="guests" min="1" value="' + esc(p.guests || "") + '"></label>' +
      '<label>Usual rental budget<input type="number" name="budget" min="0" value="' + esc(p.budget || "") + '"></label>' +
      '<label>Preferred neighborhood<input name="location" value="' + esc(p.location || "") + '" placeholder="Coral Gables, Brickell…"></label>' +
      '<label>Aesthetic<select name="aesthetic"><option value="">Not set</option>' + ["romantic", "classic", "elegant", "modern", "minimal", "natural", "glamorous"].map(function (t) { return '<option' + sel("aesthetic", t) + ">" + t + "</option>"; }).join("") + "</select></label>" +
      '<label>Palette<select name="palette">' + data.PALETTES.map(function (c) { return '<option value="' + c.id + '"' + sel("palette", c.id) + ">" + esc(c.name) + "</option>"; }).join("") + "</select></label></div>" +
      '<label>Brand and theme<textarea name="theme" placeholder="Ivory and sage. A university reception. A tech summit that should not feel like a ballroom.">' + esc(p.theme || "") + "</textarea></label>" +
      '<label>Notes for Breeze<textarea name="notes">' + esc(p.notes || "") + "</textarea></label>" +
      '<label>Company logo<input type="file" accept="image/*" data-upload="profile-logo"></label>' +
      (p.logo ? '<img class="profile-logo" alt="Uploaded logo" src="' + p.logo + '">' : "") +
      '<button class="btn btn-primary" type="submit">Save profile</button></form></div></section>';
  }

  function dashboard() {
    if (!state.user || state.user.role !== "planner") {
      return '<section class="page"><div class="wrap"><h1 class="page-title">Planner dashboard</h1><p>Sign in as a planner to see saved rooms and inquiries.</p><a class="btn btn-primary" href="#/account">Sign in</a></div></section>';
    }
    const mine = state.inquiries.filter(function (item) { return item.ownerEmail === state.user.email; });
    const saved = state.favorites.map(venue).filter(Boolean);
    return '<section class="page"><div class="wrap stack"><p class="kicker">Planner</p><h1 class="page-title">Hello, ' + esc(state.user.name.split(" ")[0]) + '</h1>' +
      '<p><a href="#/profile">Edit your profile</a> so Breeze keeps the company, palette, and usual event.</p>' +
      '<div class="inline"><button class="btn btn-small ' + (ui.tab === "saved" ? "btn-primary" : "btn-ghost") + '" type="button" data-action="tab" data-tab="saved">Saved venues</button>' +
      '<button class="btn btn-small ' + (ui.tab === "inquiries" ? "btn-primary" : "btn-ghost") + '" type="button" data-action="tab" data-tab="inquiries">Inquiries</button>' +
      '<button class="btn btn-small ' + (ui.tab === "messages" ? "btn-primary" : "btn-ghost") + '" type="button" data-action="tab" data-tab="messages">Messages</button>' +
      '<button class="btn btn-small ' + (ui.tab === "documents" ? "btn-primary" : "btn-ghost") + '" type="button" data-action="tab" data-tab="documents">Documents</button></div>' +
      (ui.tab === "saved" ? (saved.length ? '<div class="cards">' + saved.map(card).join("") + "</div>" : '<p>No saved rooms yet.</p>') : "") +
      (ui.tab === "inquiries" ? inquiryList(mine) : "") +
      (ui.tab === "messages" ? messageBoard(mine) : "") +
      (ui.tab === "documents" ? documents(mine) : "") +
      "</div></section>";
  }

  function inquiryList(list) {
    if (!list.length) return "<p>No inquiries yet. A request stays an inquiry until a hotel confirms the date.</p>";
    return '<div class="stack">' + list.map(function (item) {
      const v = venue(item.venueId);
      return '<article class="panel" style="padding:1rem"><h3>' + esc(v ? v.name : "Venue") + "</h3><p>" + esc(item.date) + " · " + item.guests + " guests · " + esc(item.status) + "</p><p class=\"note\">" + (item.confirmed ? "Confirmed by the hotel." : "Not a confirmed booking.") + "</p></article>";
    }).join("") + "</div>";
  }

  function messageBoard(list) {
    if (!list.length) return "<p>Messages appear here after you send an inquiry.</p>";
    return list.map(function (item) {
      const v = venue(item.venueId);
      return '<article class="panel" style="padding:1rem"><h3>' + esc(v ? v.hotel : "Hotel") + "</h3><div class=\"thread\">" +
        item.messages.map(function (msg) { return "<p><strong>" + esc(msg.name) + ":</strong> " + esc(msg.text) + "</p>"; }).join("") +
        '</div><form data-form="note" class="inline"><input type="hidden" name="id" value="' + esc(item.id) + '"><label style="flex:1">Message<textarea name="text" required></textarea></label><button class="btn btn-primary" type="submit">Send</button></form></article>';
    }).join("");
  }

  function documents(list) {
    const docs = list.filter(function (item) { return item.status === "Proposal sent"; });
    if (!docs.length) return "<p>Contracts and proposals show up here when a hotel marks an inquiry as a proposal. None of your inquiries are at that step.</p>";
    return docs.map(function (item) {
      const v = venue(item.venueId);
      return '<article class="panel" style="padding:1rem"><h3>Sample proposal · ' + esc(v.name) + '</h3><p>This is a demonstration document, not a contract. The hotel has not confirmed availability.</p><p>Date requested: ' + esc(item.date) + ". Guests: " + item.guests + ". Layout: " + esc(item.layout) + ".</p></article>";
    }).join("");
  }

  function compare() {
    const picks = state.compare.map(venue).filter(Boolean);
    const summary = ai.compareSummary(picks, state.brief || {});
    if (picks.length < 2) {
      return '<section class="page"><div class="wrap"><h1 class="page-title">Compare venues</h1><p>Save at least two rooms with Compare. You can hold three.</p><a class="btn btn-primary" href="#/discover">Discover venues</a></div></section>';
    }
    const rows = [
      ["Location", function (v) { return v.neighborhood; }],
      ["Guest capacity", function (v) { return String(v.capacity); }],
      ["Dimensions", function (v) { return v.dimensions; }],
      ["Configurations", function (v) { return v.configs.map(function (c) { return c.label + " (" + c.capacity + ")"; }).join(", "); }],
      ["Sample rental", function (v) { return "From " + money(v.priceFrom); }],
      ["Minimum spend", function (v) { return money(v.minSpend); }],
      ["Amenities", function (v) { return v.amenities.join(", "); }],
      ["Catering", function (v) { return v.cateringNote; }],
      ["Audiovisual", function (v) { return v.av.join(", "); }],
      ["360° tour", function (v) { return v.scenes ? "Walkable 360° on the listing" : "Not listed"; }],
      ["Suitability", function (v) { return ai.scoreVenue(v, state.brief || {}).score + " on the demo scale"; }]
    ];
    return '<section class="page"><div class="wrap stack"><h1 class="page-title">Side by side</h1><div class="panel" style="padding:1rem"><h2>Sample summary</h2><p>' + esc(summary) + "</p></div>" +
      '<div class="table-wrap"><table><thead><tr><th>Criteria</th>' + picks.map(function (v) { return "<th>" + esc(v.hotel) + "<br>" + esc(v.name) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      rows.map(function (row) {
        return "<tr><th>" + row[0] + "</th>" + picks.map(function (v) { return "<td>" + esc(row[1](v)) + "</td>"; }).join("") + "</tr>";
      }).join("") +
      "<tr><th></th>" + picks.map(function (v) { return '<td><button class="btn btn-ghost btn-small" type="button" data-action="compare" data-id="' + esc(v.id) + '">Remove</button></td>'; }).join("") + "</tr></tbody></table></div></div></section>";
  }

  function studio(id) {
    const v = venue(id);
    if (!v) return '<section class="page"><div class="wrap"><h1>Choose a venue first.</h1></div></section>';
    const config = savedStudio(id);
    const est = estimate(v, config);
    const palette = data.PALETTES.find(function (item) { return item.id === config.palette; }) || data.PALETTES[0];
    const layout = v.configs.find(function (item) { return item.id === config.layout; }) || v.configs[0];
    return '<section class="page"><div class="wrap"><p class="kicker">Planning studio</p><div class="section-head"><h1 class="page-title">' + esc(v.name) + "</h1><p>Estimates update in this browser. They are not a hotel proposal.</p></div>" +
      '<form class="studio-grid" data-form="studio" data-id="' + esc(v.id) + '"><div class="stack"><div class="brand-frame" style="border-color:' + palette.colors[0] + '"><img src="' + esc(v.images[0]) + '" alt="Sample room with your palette as a frame">' +
      (config.logo ? '<img class="logo-float" alt="Uploaded company logo" src="' + config.logo + '">' : "") + "</div>" +
      "<div class=\"floor\">" + floorplan(layout.id) + "</div><p><strong>" + layout.capacity + "</strong> seats in this layout. " + esc(layout.detail) + "</p>" +
      (config.inspiration ? '<img src="' + config.inspiration + '" alt="Uploaded inspiration" style="border-radius:16px;max-height:180px;object-fit:cover">' : "") +
      "</div><div class=\"panel stack\" style=\"padding:1rem\">" +
      '<label>Seating<select name="layout">' + v.configs.map(function (c) { return '<option value="' + c.id + '"' + (c.id === config.layout ? " selected" : "") + ">" + esc(c.label) + " · " + c.capacity + "</option>"; }).join("") + "</select></label>" +
      '<label>Guests for the estimate<input name="guests" type="number" min="1" value="' + esc(config.guests || est.guests) + '"></label>' +
      '<label>Catering<select name="cateringId">' + data.CATERING.map(function (c) { return '<option value="' + c.id + '"' + (c.id === config.cateringId ? " selected" : "") + ">" + esc(c.label) + " · " + money(c.price) + "</option>"; }).join("") + "</select></label>" +
      '<label>Audiovisual<select name="avId">' + data.AV.map(function (c) { return '<option value="' + c.id + '"' + (c.id === config.avId ? " selected" : "") + ">" + esc(c.label) + " · " + money(c.price) + "</option>"; }).join("") + "</select></label>" +
      '<label>Furniture<select name="furnitureId">' + data.FURNITURE.map(function (c) { return '<option value="' + c.id + '"' + (c.id === config.furnitureId ? " selected" : "") + ">" + esc(c.label) + " · " + money(c.price) + "</option>"; }).join("") + "</select></label>" +
      '<label>Palette<select name="palette">' + data.PALETTES.map(function (c) { return '<option value="' + c.id + '"' + (c.id === config.palette ? " selected" : "") + ">" + esc(c.name) + "</option>"; }).join("") + "</select></label>" +
      '<div class="swatches">' + palette.colors.map(function (color) { return '<span class="swatch" style="background:' + color + '"></span>'; }).join("") + "</div>" +
      '<label>Special requirements<textarea name="notes">' + esc(config.notes) + "</textarea></label>" +
      '<label>Company logo<input type="file" accept="image/*" data-upload="studio-logo" data-id="' + esc(v.id) + '"></label>' +
      '<label>Inspiration image<input type="file" accept="image/*" data-upload="studio-inspiration" data-id="' + esc(v.id) + '"></label>' +
      '<ul class="budget"><li><span>Sample rental</span><span>' + money(est.rental) + "</span></li>" +
      "<li><span>" + esc(est.catering.label) + " × " + est.guests + "</span><span>" + money(est.food) + "</span></li>" +
      "<li><span>" + esc(est.avItem.label) + "</span><span>" + money(est.av) + "</span></li>" +
      "<li><span>" + esc(est.furnitureItem.label) + "</span><span>" + money(est.furniture) + "</span></li>" +
      "<li><span>Sample service fee 8%</span><span>" + money(est.fee) + "</span></li>" +
      "<li><strong>Estimated total</strong><strong>" + money(est.total) + "</strong></li></ul>" +
      "<p class=\"note\">Minimum spend on the listing is " + money(v.minSpend) + ". Tax is not included. Saving keeps this plan on this browser.</p>" +
      '<button class="btn btn-primary" type="submit">Save configuration</button><a class="btn btn-ghost" href="#/inquire/' + esc(v.id) + '">Use this in an inquiry</a></div></form></div></section>';
  }

  function inquire(id) {
    const v = venue(id);
    if (!v) return '<section class="page"><div class="wrap"><h1>Choose a venue first.</h1></div></section>';
    const config = savedStudio(id);
    const brief = state.brief || {};
    if (ui.sent === id) {
      return '<section class="page"><div class="wrap" style="max-width:720px"><p class="kicker">Inquiry received</p><h1 class="page-title">The hotel has your request.</h1><p>This is not a confirmed booking. ' + esc(v.hotel) + " still has to check the date and accept the reservation. You can follow the thread from your dashboard.</p><a class=\"btn btn-primary\" href=\"#/dashboard\">Go to the dashboard</a></div></section>";
    }
    return '<section class="page"><div class="wrap" style="max-width:760px"><p class="kicker">' + esc(v.hotel) + "</p><h1 class=\"page-title\">Request " + esc(v.name) + "</h1><p class=\"muted\">Sending this form creates an inquiry. It does not reserve the room.</p>" +
      '<form class="panel stack" style="padding:1rem;margin-top:1rem" data-form="inquire" data-id="' + esc(v.id) + '">' +
      '<div class="form-grid"><label>Name<input name="name" required value="' + esc(state.user ? state.user.name : "") + '"></label>' +
      '<label>Email<input type="email" name="email" required value="' + esc(state.user ? state.user.email : "") + '"></label>' +
      '<label>Phone<input name="phone" autocomplete="tel"></label>' +
      '<label>Event date<input type="date" name="date" required value="' + esc(brief.date && /^\d{4}-\d{2}-\d{2}$/.test(brief.date) ? brief.date : "") + '"></label>' +
      '<label>Start<input type="time" name="start" value="18:00"></label><label>End<input type="time" name="end" value="23:00"></label>' +
      '<label>Guests<input type="number" name="guests" min="1" required value="' + esc(config.guests || brief.guests || "") + '"></label>' +
      '<label>Seating<select name="layout">' + v.configs.map(function (c) { return '<option value="' + c.id + '"' + (c.id === config.layout ? " selected" : "") + ">" + esc(c.label) + "</option>"; }).join("") + "</select></label></div>" +
      '<label>Catering and other needs<textarea name="notes">' + esc(config.notes || brief.freeText || "") + "</textarea></label>" +
      '<button class="btn btn-primary" type="submit">Submit inquiry</button></form></div></section>';
  }

  function partner() {
    const user = state.user;
    if (!user || user.role !== "partner") {
      return '<section class="page"><div class="wrap"><h1 class="page-title">Hotel partner dashboard</h1><p>Sign in as a hotel partner to see the sample pipeline. Jordan Hale opens The Palmetto House.</p><a class="btn btn-primary" href="#/account">Sign in</a></div></section>';
    }
    const hotelId = user.hotelId || "palmetto";
    const v = venue(hotelId);
    const leads = state.inquiries.filter(function (item) { return item.venueId === hotelId; });
    const analytics = data.ANALYTICS[hotelId];
    const views = analytics.views;
    const inquiryCount = leads.length;
    return '<section class="page"><div class="wrap stack"><p class="kicker">' + esc(v.hotel) + '</p><h1 class="page-title">Partner dashboard</h1>' +
      '<div class="inline"><button class="btn btn-small ' + (ui.partnerTab === "inbox" ? "btn-primary" : "btn-ghost") + '" data-action="partner-tab" data-tab="inbox" type="button">Inquiries</button>' +
      '<button class="btn btn-small ' + (ui.partnerTab === "listing" ? "btn-primary" : "btn-ghost") + '" data-action="partner-tab" data-tab="listing" type="button">Listing</button>' +
      '<button class="btn btn-small ' + (ui.partnerTab === "analytics" ? "btn-primary" : "btn-ghost") + '" data-action="partner-tab" data-tab="analytics" type="button">Analytics</button></div>' +
      (ui.partnerTab === "inbox" ? partnerInbox(leads, v) : "") +
      (ui.partnerTab === "listing" ? partnerListing(v) : "") +
      (ui.partnerTab === "analytics" ? partnerAnalytics(analytics, views, inquiryCount) : "") +
      "</div></section>";
  }

  function partnerInbox(leads, v) {
    if (!leads.length) return "<p>No inquiries for " + esc(v.name) + " yet.</p>";
    return leads.map(function (item) {
      return '<article class="panel" style="padding:1rem"><h3>' + esc(item.name) + "</h3><p>" + esc(item.date) + " · " + item.guests + " guests · " + esc(item.layout) + " · " + esc(item.status) + "</p><p>" + esc(item.notes) + "</p>" +
        '<div class="thread">' + item.messages.map(function (msg) { return "<p><strong>" + esc(msg.name) + ":</strong> " + esc(msg.text) + "</p>"; }).join("") + "</div>" +
        '<form class="inline" data-form="hotel-reply"><input type="hidden" name="id" value="' + esc(item.id) + '"><label style="flex:1">Reply<textarea name="text" required></textarea></label>' +
        '<button class="btn btn-primary" type="submit">Send reply</button>' +
        '<button class="btn btn-ghost" type="button" data-action="proposal" data-id="' + esc(item.id) + '">Mark proposal sent</button></form>' +
        '<p class="note">Marking a proposal does not confirm the booking.</p></article>';
    }).join("");
  }

  function partnerListing(v) {
    return '<form class="panel stack" style="padding:1rem" data-form="listing" data-id="' + esc(v.id) + '"><h2>Manage ' + esc(v.name) + "</h2><p class=\"note\">Edits stay in this browser and update the sample listing.</p>" +
      '<label>Sample starting rental<input type="number" name="priceFrom" min="0" value="' + esc(v.priceFrom) + '"></label>' +
      '<label>Posted maximum occupancy<input type="number" name="capacity" min="1" value="' + esc(v.capacity) + '"></label>' +
      '<label>Curfew<textarea name="curfew">' + esc(v.curfew) + "</textarea></label>" +
      "<p>Photographs, the sample tour, and floor plans are already on the public listing. A production version would upload replacements here.</p>" +
      '<button class="btn btn-primary" type="submit">Save listing</button><a href="#/venue/' + esc(v.id) + '">View public page</a></form>';
  }

  function partnerAnalytics(analytics, views, inquiryCount) {
    const heights = [70, 48, 62, 36, 80, 44];
    return '<div class="stat-grid"><article class="stat"><strong>' + views.toLocaleString("en-US") + '</strong><span>Sample page views</span></article>' +
      '<article class="stat"><strong>' + analytics.tours.toLocaleString("en-US") + "</strong><span>Sample tour interactions</span></article>" +
      '<article class="stat"><strong>' + analytics.saves + "</strong><span>Sample saves</span></article>" +
      '<article class="stat"><strong>' + inquiryCount + "</strong><span>Inquiries in this browser</span></article>" +
      '<article class="stat"><strong>' + Math.round(analytics.conversion * 100) + "%</strong><span>Sample inquiry-to-booking rate</span></article>" +
      '<article class="stat"><strong>' + money(analytics.revenue) + "</strong><span>Illustrated revenue, not live bookings</span></article></div>" +
      '<div class="panel" style="padding:1rem"><h2>Sample engagement</h2><div class="bars" aria-hidden="true">' + heights.map(function (h) { return '<span style="height:' + h + '%"></span>'; }).join("") + "</div>" +
      "<p class=\"note\">The bars are a static illustration. The inquiry count above includes records stored in this browser, including the seeded Palmetto examples.</p></div>";
  }

  function join() {
    if (ui.joined) return '<section class="page"><div class="wrap"><h1 class="page-title">Registration saved in this browser.</h1><p>A production version would send this to the Breeze partnerships team. Nothing was emailed.</p></div></section>';
    return '<section class="page"><div class="wrap" style="max-width:720px"><h1 class="page-title">Hotel partnership</h1><p class="muted">Tell us about the rooms you want on the sample marketplace.</p>' +
      '<form class="panel stack" style="padding:1rem;margin-top:1rem" data-form="join"><label>Hotel name<input name="hotel" required></label><label>Contact name<input name="contact" required></label>' +
      '<label>Email<input type="email" name="email" required></label><label>Neighborhood<input name="neighborhood" required></label>' +
      '<label>Event spaces<textarea name="rooms" required></textarea></label><button class="btn btn-primary" type="submit">Submit registration</button></form></div></section>';
  }

  function faq() {
    const items = [
      ["Is an inquiry a confirmed booking?", "No. The hotel has to check the date and accept the reservation. The dashboard says so until that happens."],
      ["Are the prices and calendars live?", "No. Every rate, curfew, and blackout date is sample data for this prototype."],
      ["Do the photographs show real hotels?", "No. They were generated for Breeze and are not pictures of the named sample properties."],
      ["Does Breeze use a live model?", "When an Anthropic key is present it does. If the key is not set, Breeze uses the local matcher on the same sample inventory. Prices and dates stay sample data either way."],
      ["Where is the assistant?", "Along the bottom of every page. It is a desk, not a chat bubble. It reads a planner profile when you have one."],
      ["Can a hotel join?", "Use the partnership form. It stores the registration in this browser only."]
    ];
    return '<section class="page"><div class="wrap" style="max-width:760px"><h1 class="page-title">FAQs</h1><div class="faq" style="margin-top:1rem">' +
      items.map(function (item) { return "<details><summary>" + item[0] + "</summary><p>" + item[1] + "</p></details>"; }).join("") +
      "</div></div></section>";
  }

  function greeting() {
    const p = planner();
    if (p && (p.company || p.theme || p.eventType)) {
      return "I have your profile" + (p.company ? " for " + p.company : "") + ". " +
        [p.eventType, p.guests ? p.guests + " guests" : "", p.location, p.theme].filter(Boolean).join(" · ") +
        ". What should we place?";
    }
    return "Tell Breeze about the event. A neighborhood, a guest count, a color, or a feeling is enough.";
  }

  function breezeMatches(message) {
    return (message.scores || []).map(function (item) {
      const v = venue(item.id);
      if (!v) return "";
      return '<article class="match"><img src="' + esc(v.images[0]) + '" alt=""><div><p class="score">' + item.score + "</p><h3>" + esc(v.name) + "</h3><p>" + esc(v.hotel) + " · " + esc(v.neighborhood) + "</p><p>" + esc((item.reasons || []).slice(0, 2).join(" ")) + "</p>" +
        (item.limits && item.limits[0] ? "<p class=\"note\">" + esc(item.limits[0]) + "</p>" : "") +
        '<div class="inline"><a class="btn btn-primary btn-small" href="#/venue/' + esc(v.id) + '">View details</a>' +
        (v.scenes ? '<a class="btn btn-ghost btn-small" href="#/venue/' + esc(v.id) + '">Open the 360°</a>' : "") +
        "</div></div></article>";
    }).join("");
  }

  function renderBreeze() {
    const root = document.getElementById("breeze");
    if (!root) return;
    const open = ui.breezeOpen;
    const messages = state.messages.length ? state.messages : [{ role: "assistant", text: greeting(), suggestions: ["A romantic wedding for 150 in Coral Gables", "A modern innovation summit, navy brand", "Executive meeting for 12 downtown"] }];
    const bubbles = messages.map(function (message) {
      const chips = (message.suggestions || []).map(function (chip) {
        return '<button class="btn btn-ghost btn-small" type="button" data-action="chip" data-text="' + esc(chip) + '">' + esc(chip) + "</button>";
      }).join("");
      return '<div class="bubble ' + message.role + '"><p>' + esc(message.text) + "</p>" +
        (breezeMatches(message) ? '<div class="stack" style="margin-top:0.55rem">' + breezeMatches(message) + "</div>" : "") +
        (chips ? '<div class="suggestions" style="margin-top:0.45rem">' + chips + "</div>" : "") + "</div>";
    }).join("");
    root.className = "breeze-dock" + (open ? " open" : "");
    root.innerHTML = (open ? '<div class="breeze-sheet" id="breeze-sheet">' + bubbles + (ui.breezeWaiting ? '<div class="breeze-tide" aria-hidden="true"></div>' : "") + "</div>" : "") +
      '<form class="breeze-bar" data-form="breeze"><button class="breeze-word" type="button" data-action="toggle-breeze" aria-expanded="' + open + '">Breeze</button>' +
      '<input id="composer" name="text" autocomplete="off" placeholder="Tell Breeze about the event…">' +
      '<button class="btn btn-ghost btn-small" type="button" data-action="voice">Speak</button>' +
      '<button class="btn btn-primary btn-small" type="submit">Send</button></form>';
    const sheet = document.getElementById("breeze-sheet");
    if (sheet) sheet.scrollTop = sheet.scrollHeight;
  }

  function afterRender() {
    const r = route();
    const pano = document.getElementById("pano");
    if (pano) ui.breezeOpen = false;
    if (pano && r.parts[1]) {
      const v = venue(r.parts[1]);
      if (v && v.scenes) window.BreezeTour.mount(pano, v);
      else window.BreezeTour.destroy();
    } else {
      window.BreezeTour.destroy();
    }
    renderBreeze();
  }

  function render() {
    const r = route();
    const key = r.key;
    let body = home();
    if (key === "discover") body = discover();
    else if (key === "venue") body = venuePage(r.parts[1]);
    else if (key === "assistant") body = assistant();
    else if (key === "how") body = how();
    else if (key === "account") body = account();
    else if (key === "profile") body = profilePage();
    else if (key === "dashboard") body = dashboard();
    else if (key === "compare") body = compare();
    else if (key === "studio") body = studio(r.parts[1]);
    else if (key === "inquire") body = inquire(r.parts[1]);
    else if (key === "partner") body = partner();
    else if (key === "join") body = join();
    else if (key === "faq") body = faq();
    else if (key) body = '<section class="page"><div class="wrap"><h1>That page is not part of this demo.</h1><a href="#/">Back home</a></div></section>';
    document.getElementById("app").innerHTML = shell(key === "dashboard" ? "account" : key, body);
    if (ui.restoreFocus) {
      const node = document.querySelector(ui.restoreFocus);
      if (node) node.focus();
      ui.restoreFocus = "";
    }
    afterRender();
  }

  function toggleFav(id) {
    const index = state.favorites.indexOf(id);
    if (index === -1) state.favorites.push(id);
    else state.favorites.splice(index, 1);
    store.save();
  }

  function toggleCompare(id) {
    const index = state.compare.indexOf(id);
    if (index === -1) {
      if (state.compare.length >= 3) {
        toast("Compare holds three rooms. Remove one first.");
        return;
      }
      state.compare.push(id);
    } else state.compare.splice(index, 1);
    store.save();
  }

  function readForm(form) {
    const data = {};
    new FormData(form).forEach(function (value, key) { data[key] = String(value); });
    return data;
  }

  function signIn(email) {
    const found = state.users.find(function (user) { return user.email.toLowerCase() === email.toLowerCase(); });
    if (!found) {
      toast("No demo account uses that email. Create a planner profile, or use a sample sign-in.");
      return;
    }
    state.user = store.hydrateUser(found);
    if (state.user.role === "planner") {
      state.brief = ai.applyProfile(state.brief || {}, window.BreezeCatalog.publicProfile(state.user));
    }
    store.save();
    location.hash = found.role === "partner" ? "#/partner" : "#/profile";
  }

  function ensureDemo(role) {
    if (role === "partner") signIn("jordan@example.com");
    else signIn("avery@example.com");
  }

  function speak(text) {
    if (!state.speak || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  }

  function pageContext() {
    const r = route();
    return { page: r.key || "home", venueId: r.key === "venue" ? r.parts[1] || "" : "" };
  }

  function applyResult(clean, result, live) {
    state.brief = result.brief || state.brief;
    state.messages.push({
      role: "assistant",
      text: result.text,
      suggestions: result.suggestions || [],
      scores: result.matches || (result.ranked || []).map(function (item) {
        return { id: item.venue.id, score: item.score, reasons: item.reasons, limits: item.limits };
      }),
      live: live
    });
    store.save();
    ui.breezeWaiting = false;
    ui.breezeLive = live;
    renderBreeze();
    speak(result.text);
  }

  function ask(text) {
    const clean = String(text || "").trim();
    if (!clean) return;
    ui.breezeOpen = true;
    state.messages.push({ role: "user", text: clean });
    ui.breezeWaiting = true;
    store.save();
    renderBreeze();
    const profile = window.BreezeCatalog.publicProfile(planner());
    const ctx = pageContext();
    const fallback = function () {
      const local = ai.reply(allVenues(), state.brief, clean, profile);
      applyResult(clean, {
        text: local.text,
        suggestions: local.suggestions,
        brief: local.brief,
        ranked: local.ranked
      }, false);
    };
    fetch("/api/breeze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: clean,
        history: state.messages.slice(-8).map(function (item) { return { role: item.role, text: item.text }; }),
        brief: state.brief,
        profile: profile,
        page: ctx.page,
        venueId: ctx.venueId
      })
    }).then(function (res) {
      if (!res.ok) throw new Error("http");
      return res.json();
    }).then(function (payload) {
      if (!payload || !payload.result || !payload.result.text) throw new Error("shape");
      applyResult(clean, payload.result, Boolean(payload.live));
    }).catch(fallback);
  }

  function listen() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast("Voice input is not available in this browser. Type the note instead.");
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.onresult = function (event) {
      const said = event.results[0][0].transcript;
      const box = document.getElementById("composer");
      if (box) box.value = said;
      ask(said);
    };
    rec.onerror = function () { toast("The microphone did not start. You can type the note instead."); };
    try { rec.start(); toast("Listening…"); } catch (err) { toast("The microphone did not start."); }
  }

  function readFile(file, cb) {
    if (!file || !/^image\//.test(file.type)) {
      toast("Choose an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = function () { cb(String(reader.result || "")); };
    reader.readAsDataURL(file);
  }

  document.addEventListener("click", function (event) {
    const btn = event.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (action === "dismiss-banner") sessionStorage.setItem("breeze-banner", "hide");
    if (action === "fav") toggleFav(id);
    if (action === "compare") toggleCompare(id);
    if (action === "toggle-map") ui.map = !ui.map;
    if (action === "reset-filters") ui.filters = { q: "", location: "", date: "", guests: "", type: "", budget: "", style: "", config: "", amenity: "", setting: "", tour: "" };
    if (action === "photo") { ui.photo[id] = Number(btn.dataset.index); ui.before[id] = false; }
    if (action === "before") ui.before[id] = !ui.before[id];
    if (action === "video") ui.video[id] = !ui.video[id];
    if (action === "layout") ui.layout[id] = btn.dataset.layout;
    if (action === "hotspot") {
      const v = venue(id);
      if (v && v.hotspots) ui.hotspot[id] = v.hotspots[Number(btn.dataset.index)];
    }
    if (action === "chip") { ask(btn.dataset.text); return; }
    if (action === "voice") { listen(); return; }
    if (action === "open-breeze") { ui.breezeOpen = true; renderBreeze(); const box = document.getElementById("composer"); if (box) box.focus(); return; }
    if (action === "toggle-breeze") { ui.breezeOpen = !ui.breezeOpen; renderBreeze(); return; }
    if (action === "zoom-in") { window.BreezeTour.zoom(-12); return; }
    if (action === "zoom-out") { window.BreezeTour.zoom(12); return; }
    if (action === "speak") { state.speak = !state.speak; store.save(); }
    if (action === "tab") ui.tab = btn.dataset.tab;
    if (action === "partner-tab") ui.partnerTab = btn.dataset.tab;
    if (action === "sign-out") {
      state.user = null;
      store.save();
      if ((location.hash || "").startsWith("#/account")) render();
      else location.hash = "#/account";
      return;
    }
    if (action === "demo-user") { ensureDemo(btn.dataset.role); return; }
    if (action === "ai-from-search") {
      const form = document.querySelector("[data-form='search']");
      const fields = readForm(form);
      const sentence = [fields.type, fields.guests ? fields.guests + " guests" : "", fields.location, fields.date].filter(Boolean).join(", ");
      ui.breezeOpen = true;
      if (sentence) ask(sentence);
      else renderBreeze();
      return;
    }
    if (action === "proposal") {
      const item = state.inquiries.find(function (entry) { return entry.id === btn.dataset.id; });
      if (item) {
        item.status = "Proposal sent";
        item.confirmed = false;
        item.messages.push({ from: "hotel", name: state.user.name, text: "A sample proposal is ready in your documents. The date is still not confirmed.", at: new Date().toISOString() });
        store.save();
        toast("Marked as a proposal. The booking is still unconfirmed.");
      }
    }
    if (["fav", "compare", "toggle-map", "reset-filters", "photo", "before", "video", "layout", "hotspot", "chip", "speak", "tab", "partner-tab", "dismiss-banner", "proposal"].indexOf(action) !== -1) render();
  });

  document.addEventListener("submit", function (event) {
    const form = event.target.closest("form");
    if (!form) return;
    event.preventDefault();
    const kind = form.dataset.form;
    const fields = readForm(form);
    if (kind === "search") {
      ui.applyQuery = true;
      const params = new URLSearchParams();
      ["location", "date", "guests", "type"].forEach(function (key) { if (fields[key]) params.set(key, fields[key]); });
      location.hash = "#/discover?" + params.toString();
      return;
    }
    if (kind === "filters") return;
    if (kind === "assistant" || kind === "breeze") { ask(fields.text); return; }
    if (kind === "signin") { signIn(fields.email); return; }
    if (kind === "register") {
      const user = store.hydrateUser({
        name: fields.name,
        email: fields.email,
        role: "planner",
        company: fields.company || ""
      });
      store.persistUser(user);
      state.user = user;
      state.brief = ai.applyProfile(state.brief || {}, window.BreezeCatalog.publicProfile(user));
      store.save();
      location.hash = "#/profile";
      return;
    }
    if (kind === "profile") {
      if (!planner()) return;
      const next = store.hydrateUser(Object.assign({}, state.user, fields, { role: "planner", logo: state.user.logo || "" }));
      store.persistUser(next);
      state.brief = ai.applyProfile(state.brief || {}, window.BreezeCatalog.publicProfile(next));
      store.save();
      toast("Profile saved. Breeze will use it on every page.");
      render();
      return;
    }
    if (kind === "studio") {
      const id = form.dataset.id;
      const current = savedStudio(id);
      state.studios[id] = Object.assign(current, fields);
      store.save();
      toast("Configuration saved in this browser.");
      render();
      return;
    }
    if (kind === "inquire") {
      const id = "inq-" + Date.now();
      state.inquiries.push({
        id: id,
        venueId: form.dataset.id,
        ownerEmail: fields.email,
        name: fields.name,
        email: fields.email,
        phone: fields.phone || "",
        date: fields.date,
        start: fields.start,
        end: fields.end,
        guests: Number(fields.guests),
        layout: fields.layout,
        notes: fields.notes,
        status: "Inquiry received",
        confirmed: false,
        created: new Date().toISOString(),
        messages: [{ from: "planner", name: fields.name, text: fields.notes || "Inquiry submitted from the listing.", at: new Date().toISOString() }]
      });
      if (!state.user) state.user = { name: fields.name, email: fields.email, role: "planner" };
      store.save();
      ui.sent = form.dataset.id;
      render();
      return;
    }
    if (kind === "note" || kind === "hotel-reply") {
      const item = state.inquiries.find(function (entry) { return entry.id === fields.id; });
      if (item && fields.text.trim()) {
        item.messages.push({
          from: kind === "hotel-reply" ? "hotel" : "planner",
          name: state.user ? state.user.name : "Planner",
          text: fields.text.trim(),
          at: new Date().toISOString()
        });
        store.save();
        toast("Message saved in this browser.");
      }
      render();
      return;
    }
    if (kind === "listing") {
      state.venueEdits[form.dataset.id] = {
        priceFrom: Number(fields.priceFrom),
        capacity: Number(fields.capacity),
        curfew: fields.curfew
      };
      store.save();
      toast("Listing updated in this browser.");
      render();
      return;
    }
    if (kind === "join") {
      state.partnerLeads.push(fields);
      store.save();
      ui.joined = true;
      render();
    }
  });

  document.addEventListener("change", function (event) {
    const form = event.target.closest("[data-form='filters']");
    if (form) {
      ui.filters = Object.assign(ui.filters, readForm(form));
      render();
      return;
    }
    const studioForm = event.target.closest("[data-form='studio']");
    if (studioForm && event.target.name) {
      const id = studioForm.dataset.id;
      const current = savedStudio(id);
      current[event.target.name] = event.target.value;
      state.studios[id] = current;
      store.save();
      render();
    }
  });

  document.addEventListener("change", function (event) {
    const input = event.target.closest("[data-upload]");
    if (!input || !input.files || !input.files[0]) return;
    readFile(input.files[0], function (url) {
      const kind = input.dataset.upload;
      if (kind === "logo") state.brief.logo = url;
      if (kind === "inspiration") state.brief.inspiration = url;
      if (kind === "profile-logo" && planner()) {
        state.user.logo = url;
        store.persistUser(state.user);
      }
      if (kind === "studio-logo" || kind === "studio-inspiration") {
        const current = savedStudio(input.dataset.id);
        if (kind === "studio-logo") current.logo = url;
        else current.inspiration = url;
        state.studios[input.dataset.id] = current;
      }
      state.brief.brandNote = state.brief.brandNote || "Brand files uploaded with the brief.";
      store.save();
      toast("Image saved with this plan.");
      render();
    });
  });

  let drag = null;
  document.addEventListener("pointerdown", function (event) {
    const tour = event.target.closest("[data-tour]");
    if (!tour || event.target.closest(".hotspot")) return;
    drag = { id: tour.dataset.tour, x: event.clientX, start: ui.pan[tour.dataset.tour] || -18 };
    tour.setPointerCapture(event.pointerId);
  });
  document.addEventListener("pointermove", function (event) {
    if (!drag) return;
    const delta = (event.clientX - drag.x) / 8;
    const next = Math.max(-55, Math.min(0, drag.start + delta));
    ui.pan[drag.id] = next;
    const strip = document.querySelector('[data-strip="' + drag.id + '"]');
    if (strip) strip.style.transform = "translateX(" + next + "%)";
  });
  document.addEventListener("pointerup", function () { drag = null; });
  document.addEventListener("keydown", function (event) {
    const tour = event.target.closest("[data-tour]");
    if (!tour) return;
    const id = tour.dataset.tour;
    const current = ui.pan[id] || -18;
    if (event.key === "ArrowRight") ui.pan[id] = Math.max(-55, current - 6);
    else if (event.key === "ArrowLeft") ui.pan[id] = Math.min(0, current + 6);
    else return;
    event.preventDefault();
    const strip = document.querySelector('[data-strip="' + id + '"]');
    if (strip) strip.style.transform = "translateX(" + ui.pan[id] + "%)";
  });

  document.addEventListener("click", function (event) {
    const toggle = event.target.closest(".menu-toggle");
    if (!toggle) return;
    const nav = document.getElementById("nav");
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  window.addEventListener("hashchange", function () {
    ui.applyQuery = true;
    if (route().key !== "assistant") ui.breezeOpen = false;
    render();
  });

  if (!location.hash) location.hash = "#/";
  render();
})();
