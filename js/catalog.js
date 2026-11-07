(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.BreezeCatalog = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function compact(venues) {
    return venues.map(function (v) {
      return {
        id: v.id,
        hotel: v.hotel,
        name: v.name,
        neighborhood: v.neighborhood,
        blurb: v.blurb,
        capacity: v.capacity,
        configs: (v.configs || []).map(function (c) { return { id: c.id, label: c.label, capacity: c.capacity }; }),
        priceFrom: v.priceFrom,
        minSpend: v.minSpend,
        hours: v.hours,
        curfew: v.curfew,
        parking: v.parking,
        amenities: v.amenities,
        cateringNote: v.cateringNote,
        av: v.av,
        access: v.access,
        indoor: v.indoor,
        styles: v.styles,
        types: v.types,
        aesthetic: v.aesthetic,
        tour: Boolean(v.tour),
        flagshipTour: Boolean(v.scenes && v.scenes.length)
      };
    });
  }

  function publicProfile(user) {
    if (!user || user.role !== "planner") return null;
    return {
      name: user.name || "",
      company: user.company || "",
      title: user.title || "",
      eventType: user.eventType || "",
      guests: user.guests || "",
      budget: user.budget || "",
      location: user.location || "",
      aesthetic: user.aesthetic || "",
      theme: user.theme || "",
      palette: user.palette || "",
      notes: user.notes || "",
      hasLogo: Boolean(user.logo)
    };
  }

  return { compact: compact, publicProfile: publicProfile };
});
