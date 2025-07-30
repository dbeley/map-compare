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
  history.replaceState(null, '', url);
}

const params = new URLSearchParams(window.location.search);
const pos1 = parsePosition(params.get('map1')) || {lat: 0, lng: 0, zoom: 2};
const pos2 = parsePosition(params.get('map2')) || pos1;
syncZoom = params.get('sync') !== '0';

const map1 = L.map('map1').setView([pos1.lat, pos1.lng], pos1.zoom);
const map2 = L.map('map2').setView([pos2.lat, pos2.lng], pos2.zoom);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map1);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map2);

const drawnItems1 = new L.FeatureGroup();
map1.addLayer(drawnItems1);
const drawnItems2 = new L.FeatureGroup();
map2.addLayer(drawnItems2);

const drawControl = new L.Control.Draw({
  edit: {
    featureGroup: drawnItems1
  }
});
map1.addControl(drawControl);

map1.on(L.Draw.Event.CREATED, function (event) {
  const layer = event.layer;
  drawnItems1.addLayer(layer);
  const geo = layer.toGeoJSON();
  const clone = L.geoJSON(geo);
  drawnItems2.addLayer(clone);
});

function clearDrawings() {
  drawnItems1.clearLayers();
  drawnItems2.clearLayers();
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

map1.on('moveend zoomend', function () {
  if (syncZoom) syncMap2();
  updateUrl();
});

map2.on('moveend zoomend', function () {
  if (syncZoom) syncMap1();
  updateUrl();
});

const toggleBtn = document.getElementById('toggle-sync');
function updateToggleText() {
  toggleBtn.textContent = syncZoom ? 'Unsync zoom' : 'Sync zoom';
}
updateToggleText();

toggleBtn.addEventListener('click', function () {
  syncZoom = !syncZoom;
  if (syncZoom) {
    syncMap2();
  }
  updateToggleText();
  updateUrl();
});
