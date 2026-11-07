(function (root) {
  let viewer = null;

  function mount(el, venue, sceneId) {
    destroy();
    if (!el || typeof pannellum === "undefined" || !venue || !venue.scenes || !venue.scenes.length) return;
    const first = sceneId || (venue.scenes[0] && venue.scenes[0].id);
    const scenes = {};
    venue.scenes.forEach(function (scene) {
      scenes[scene.id] = {
        title: scene.title,
        type: "equirectangular",
        panorama: scene.image,
        hfov: 100,
        minHfov: 35,
        maxHfov: 120,
        pitch: scene.pitch || 0,
        yaw: scene.yaw || 0,
        hotSpots: (scene.links || []).map(function (link) {
          return {
            pitch: link.pitch || 0,
            yaw: link.yaw || 0,
            type: "scene",
            text: link.label,
            sceneId: link.to,
            cssClass: "breeze-hotspot"
          };
        }).concat((scene.notes || []).map(function (note) {
          return {
            pitch: note.pitch || 0,
            yaw: note.yaw || 0,
            type: "info",
            text: note.title + " — " + note.text
          };
        }))
      };
    });
    viewer = pannellum.viewer(el, {
      default: {
        firstScene: first,
        sceneFadeDuration: 700,
        autoLoad: true,
        compass: false,
        mouseZoom: true,
        draggable: true,
        showFullscreenCtrl: true,
        showZoomCtrl: true
      },
      scenes: scenes
    });
  }

  function zoom(delta) {
    if (!viewer) return;
    const current = viewer.getHfov();
    viewer.setHfov(current + delta);
  }

  function destroy() {
    if (!viewer) return;
    try { viewer.destroy(); } catch (err) { /* already gone */ }
    viewer = null;
  }

  root.BreezeTour = { mount: mount, zoom: zoom, destroy: destroy };
})(typeof globalThis !== "undefined" ? globalThis : this);
