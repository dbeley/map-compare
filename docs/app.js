let syncZoom = true;
let movingMap1 = false;
let movingMap2 = false;

function parsePosition(param) {
  if (!param) return null;
  const parts = param.split(',').map(Number);
  if (parts.length === 3 && parts.every(p => !isNaN(p))) {
    return {lat: parts[0], lng: parts[1], zoom: parts[2]};
  }
  return null;
}

function updateUrl() {
  const url = new URL(window.location);
  const c1 = map1.getCenter();
  const z1 = map1.getZoom();
  const c2 = map2.getCenter();
  const z2 = map2.getZoom();
  url.searchParams.set('map1', `${c1.lat.toFixed(4)},${c1.lng.toFixed(4)},${z1}`);
  url.searchParams.set('map2', `${c2.lat.toFixed(4)},${c2.lng.toFixed(4)},${z2}`);
  url.searchParams.set('sync', syncZoom ? '1' : '0');
  url.searchParams.set('layer', currentLayer);
  history.replaceState(null, '', url);
}

const params = new URLSearchParams(window.location.search);
const pos1 = parsePosition(params.get('map1')) || {lat: 0, lng: 0, zoom: 2};
const pos2 = parsePosition(params.get('map2')) || pos1;
syncZoom = params.get('sync') !== '0';
let currentLayer = params.get('layer') === 'satellite' ? 'satellite' : 'map';

const map1 = L.map('map1').setView([pos1.lat, pos1.lng], pos1.zoom);
const map2 = L.map('map2').setView([pos2.lat, pos2.lng], pos2.zoom);

const osm1 = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
});
const osm2 = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
});
const sat1 = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles © Esri'
});
const sat2 = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles © Esri'
});

let baseLayer1;
let baseLayer2;

function setLayer(type) {
  if (baseLayer1) map1.removeLayer(baseLayer1);
  if (baseLayer2) map2.removeLayer(baseLayer2);
  if (type === 'satellite') {
    baseLayer1 = sat1;
    baseLayer2 = sat2;
  } else {
    baseLayer1 = osm1;
    baseLayer2 = osm2;
  }
  baseLayer1.addTo(map1);
  baseLayer2.addTo(map2);
  currentLayer = type;
  document.getElementById('layer-select').value = type;
  updateUrl();
}

setLayer(currentLayer);

const drawnItems1 = new L.FeatureGroup();
map1.addLayer(drawnItems1);
const drawnItems2 = new L.FeatureGroup();
map2.addLayer(drawnItems2);
const handles1 = new L.FeatureGroup();
map1.addLayer(handles1);
const handles2 = new L.FeatureGroup();
map2.addLayer(handles2);

const drawControl = new L.Control.Draw({
  edit: { featureGroup: drawnItems1, edit: false, remove: true },
  draw: {
    polyline: {},
    polygon: {},
    rectangle: {},
    marker: false,
    circle: false,
    circlemarker: false
  }
});
map1.addControl(drawControl);

function subtractLatLngs(latlngs, center, map) {
  const zoom = map.getZoom();
  if (!Array.isArray(latlngs)) {
    const p1 = map.project(latlngs, zoom);
    const p2 = map.project(center, zoom);
    return L.point(p1.x - p2.x, p1.y - p2.y);
  }
  if (latlngs.length && Array.isArray(latlngs[0])) {
    return latlngs.map(ll => subtractLatLngs(ll, center, map));
  }
  return latlngs.map(ll => {
    const p1 = map.project(ll, zoom);
    const p2 = map.project(center, zoom);
    return L.point(p1.x - p2.x, p1.y - p2.y);
  });
}

function addLatLngs(offsets, center, map) {
  const zoom = map.getZoom();
  if (!Array.isArray(offsets)) {
    const p = map.project(center, zoom).add(offsets);
    return map.unproject(p, zoom);
  }
  if (offsets.length && Array.isArray(offsets[0])) {
    return offsets.map(o => addLatLngs(o, center, map));
  }
  return offsets.map(o => {
    const p = map.project(center, zoom).add(o);
    return map.unproject(p, zoom);
  });
}

function getLayerCenterLatLng(layer) {
  if (layer.getBounds) {
    return layer.getBounds().getCenter();
  }
  return layer.getLatLng();
}

function applyGeometry(layer, center, offsets, map) {
  if (layer.getLatLngs) {
    layer.setLatLngs(addLatLngs(offsets, center, map));
  } else {
    layer.setLatLng(center);
  }
}

function computeOffsets(layer, center, map) {
  if (layer.getLatLngs) {
    return subtractLatLngs(layer.getLatLngs(), center, map);
  }
  return null;
}

function createDragHandle(center) {
  const icon = L.divIcon({className: 'drag-handle', iconSize: [16, 16]});
  return L.marker(center, {icon, draggable: true, interactive: true});
}

const shapePairs = [];

function updateAllShapes() {
  shapePairs.forEach(p => {
    // keep layer1 geometry fixed relative to its stored center
    applyGeometry(p.layer1, p.center1, p.offsets, map1);

    // recompute the center of the second layer so it stays at the same
    // screen offset from the current map center
    p.center2 = addLatLngs(p.offset2, map2.getCenter(), map2);
    applyGeometry(p.layer2, p.center2, p.offsets, map2);

    if (p.handle2 !== p.layer2) {
      p.handle2.setLatLng(p.center2);
    }
  });
}

function createPair(layer) {
  const center1 = getLayerCenterLatLng(layer);
  const offsets = computeOffsets(layer, center1, map1);
  const center2 = map2.getCenter();
  const offset2 = subtractLatLngs(center2, map2.getCenter(), map2);
  let layer2;
  if (layer.getLatLngs) {
    layer2 = L.polygon(addLatLngs(offsets, center2, map2), layer.options);
  } else {
    layer2 = L.marker(center2, Object.assign({}, layer.options, {draggable: true}));
  }
  const handle1 = layer.getLatLngs ? createDragHandle(center1) : layer;
  const handle2 = layer2.getLatLngs ? createDragHandle(center2) : layer2;
  if (layer.getLatLngs) handles1.addLayer(handle1);
  if (layer2.getLatLngs) handles2.addLayer(handle2);

  const pair = {layer1: layer, layer2, center1, center2, offsets, handle1, handle2, offset2};

  if (!layer.getLatLngs) {
    layer.on('drag', () => { pair.center1 = getLayerCenterLatLng(layer); });
    layer2.on('drag', () => {
      pair.center2 = getLayerCenterLatLng(layer2);
      pair.offset2 = subtractLatLngs(pair.center2, map2.getCenter(), map2);
    });
  }

  if (handle1 !== layer) {
    handle1.on('drag', () => {
      pair.center1 = handle1.getLatLng();
      applyGeometry(layer, pair.center1, pair.offsets, map1);
    });
  }
  if (handle2 !== layer2) {
    handle2.on('drag', () => {
      pair.center2 = handle2.getLatLng();
      pair.offset2 = subtractLatLngs(pair.center2, map2.getCenter(), map2);
      applyGeometry(layer2, pair.center2, pair.offsets, map2);
    });
  }

  return pair;
}

map1.on(L.Draw.Event.CREATED, e => {
  const layer = e.layer;
  drawnItems1.addLayer(layer);
  if (layer instanceof L.Marker) layer.options.draggable = true;
  const pair = createPair(layer);
  drawnItems2.addLayer(pair.layer2);
  shapePairs.push(pair);
});

map1.on('draw:deleted', e => {
  e.layers.eachLayer(layer => {
    const idx = shapePairs.findIndex(p => p.layer1 === layer);
    if (idx !== -1) {
      drawnItems2.removeLayer(shapePairs[idx].layer2);
      if (shapePairs[idx].handle1 !== shapePairs[idx].layer1) {
        handles1.removeLayer(shapePairs[idx].handle1);
      }
      if (shapePairs[idx].handle2 !== shapePairs[idx].layer2) {
        handles2.removeLayer(shapePairs[idx].handle2);
      }
      shapePairs.splice(idx, 1);
    }
  });
});

map2.on('draw:deleted', e => {
  e.layers.eachLayer(layer => {
    const idx = shapePairs.findIndex(p => p.layer2 === layer);
    if (idx !== -1) {
      drawnItems1.removeLayer(shapePairs[idx].layer1);
      if (shapePairs[idx].handle1 !== shapePairs[idx].layer1) {
        handles1.removeLayer(shapePairs[idx].handle1);
      }
      if (shapePairs[idx].handle2 !== shapePairs[idx].layer2) {
        handles2.removeLayer(shapePairs[idx].handle2);
      }
      shapePairs.splice(idx, 1);
    }
  });
});

function clearDrawings() {
  drawnItems1.clearLayers();
  drawnItems2.clearLayers();
  handles1.clearLayers();
  handles2.clearLayers();
  shapePairs.length = 0;
}

document.getElementById('clear').addEventListener('click', clearDrawings);

function syncMap2() {
  if (movingMap1) return;
  movingMap2 = true;
  map2.setZoom(map1.getZoom());
  movingMap2 = false;
}

function syncMap1() {
  if (movingMap2) return;
  movingMap1 = true;
  map1.setZoom(map2.getZoom());
  movingMap1 = false;
}

map1.on('moveend zoomend', () => {
  if (syncZoom) syncMap2();
  updateAllShapes();
  updateUrl();
});

map2.on('moveend zoomend', () => {
  if (syncZoom) syncMap1();
  updateAllShapes();
  updateUrl();
});

// keep shapes visible while the user pans or zooms
map2.on('move zoom', () => {
  updateAllShapes();
});

const toggleBtn = document.getElementById('toggle-sync');
function updateToggleText() {
  toggleBtn.textContent = syncZoom ? 'Zoom synced' : 'Zoom unsynced';
}
updateToggleText();

toggleBtn.addEventListener('click', () => {
  syncZoom = !syncZoom;
  if (syncZoom) {
    syncMap2();
  }
  updateToggleText();
  updateUrl();
});

document.getElementById('layer-select').addEventListener('change', e => {
  setLayer(e.target.value);
});
