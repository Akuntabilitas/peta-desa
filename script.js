let map = L.map('map').setView([-7.5, 110.6], 10);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '© OpenStreetMap'
}).addTo(map);

let currentLevel = 'kecamatan';
let selectedKecamatan = null;
let selectedDesa = null;
let selectedSLS = null;

let layers = {
  kecamatan: null,
  desa: null,
  sls: null
};

let geojsonData = {
  kecamatan: null,
  desa: null,
  sls: null
};

let labelLayers = []; // <- untuk menyimpan label kode di tengah

fetch('data/final_kec_202413309.geojson')
  .then(res => res.json())
  .then(data => {
    geojsonData.kecamatan = data;
    showKecamatan();
  });

fetch('data/final_desa_202413309.geojson')
  .then(res => res.json())
  .then(data => geojsonData.desa = data);

fetch('data/final_sls_202413309.geojson')
  .then(res => res.json())
  .then(data => geojsonData.sls = data);

function showKecamatan() {
  clearMap();
  currentLevel = 'kecamatan';
  updateLegend(geojsonData.kecamatan.features, 'kdkec', 'nmkec');

  layers.kecamatan = L.geoJSON(geojsonData.kecamatan, {
    style: { color: '#333', weight: 1, fillOpacity: 0.2 },
    onEachFeature: (feature, layer) => {
      layer.bindTooltip(feature.properties.nmkec, { sticky: true });
      layer.on({
        click: () => {
          selectedKecamatan = feature.properties.kdkec;
          showDesa();
        },
        mouseover: () => highlightFeature(layer),
        mouseout: () => resetHighlight(layer)
      });

      addCenterLabel(feature, feature.properties.kdkec);
    }
  }).addTo(map);

  map.fitBounds(layers.kecamatan.getBounds());
}

function showDesa() {
  clearMap();
  currentLevel = 'desa';

  let filtered = geojsonData.desa.features.filter(f => f.properties.kdkec === selectedKecamatan);
  updateLegend(filtered, 'kddesa', 'nmdesa');

  layers.desa = L.geoJSON({ type: 'FeatureCollection', features: filtered }, {
    style: { color: '#2a9d8f', weight: 1, fillOpacity: 0.3 },
    onEachFeature: (feature, layer) => {
      layer.bindTooltip(feature.properties.nmdesa, { sticky: true });
      layer.on({
        click: () => {
          selectedDesa = feature.properties.kddesa;
          showSLS();
        },
        mouseover: () => highlightFeature(layer),
        mouseout: () => resetHighlight(layer)
      });

      addCenterLabel(feature, feature.properties.kddesa);
    }
  }).addTo(map);

  map.fitBounds(layers.desa.getBounds());
}

function showSLS() {
  clearMap();
  currentLevel = 'sls';

  let filtered = geojsonData.sls.features.filter(f =>
    f.properties.kdkec === selectedKecamatan && f.properties.kddesa === selectedDesa
  );
  updateLegend(filtered, 'kdsls', 'nmsls');

  layers.sls = L.geoJSON({ type: 'FeatureCollection', features: filtered }, {
    style: { color: '#e76f51', weight: 1, fillOpacity: 0.4 },
    onEachFeature: (feature, layer) => {
      layer.bindTooltip(feature.properties.nmsls, { sticky: true });
      layer.on({
        click: () => {
          selectedSLS = feature.properties.kdsls;
          map.fitBounds(layer.getBounds());
        },
        mouseover: () => highlightFeature(layer),
        mouseout: () => resetHighlight(layer)
      });

      addCenterLabel(feature, feature.properties.kdsls);
    }
  }).addTo(map);

  map.fitBounds(layers.sls.getBounds());
}

function clearMap() {
  Object.values(layers).forEach(l => l && map.removeLayer(l));
  labelLayers.forEach(l => map.removeLayer(l)); // hapus semua label teks
  labelLayers = [];
}

function updateLegend(features, codeProp, nameProp) {
  const list = document.getElementById('legend-list');
  list.innerHTML = '';
  const sorted = [...features].sort((a, b) => a.properties[codeProp].localeCompare(b.properties[codeProp]));

  sorted.forEach(f => {
    const li = document.createElement('li');
    li.className = 'legend-item';
    li.innerText = `(${f.properties[codeProp]}) ${f.properties[nameProp]}`;

    li.addEventListener('mouseover', () => {
      const layer = findLayerByFeature(f);
      if (layer) highlightFeature(layer);
    });

    li.addEventListener('mouseout', () => {
      const layer = findLayerByFeature(f);
      if (layer) resetHighlight(layer);
    });

    li.addEventListener('click', () => {
      if (currentLevel === 'kecamatan') {
        selectedKecamatan = f.properties.kdkec;
        showDesa();
      } else if (currentLevel === 'desa') {
        selectedDesa = f.properties.kddesa;
        showSLS();
      } else if (currentLevel === 'sls') {
        selectedSLS = f.properties.kdsls;
        const layer = findLayerByFeature(f);
        if (layer) map.fitBounds(layer.getBounds());
      }
    });

    list.appendChild(li);
  });
}

function findLayerByFeature(feature) {
  let layerGroup = layers[currentLevel];
  let found = null;
  layerGroup.eachLayer(layer => {
    if (JSON.stringify(layer.feature.properties) === JSON.stringify(feature.properties)) {
      found = layer;
    }
  });
  return found;
}

function highlightFeature(layer) {
  layer.setStyle({ weight: 3, color: '#2196f3', fillOpacity: 0.6 });
  layer.bringToFront();
}

function resetHighlight(layer) {
  let style = { weight: 1, fillOpacity: 0.3 };

  if (currentLevel === 'kecamatan') {
    style.color = '#333';
    style.fillOpacity = 0.2;
  } else if (currentLevel === 'desa') {
    style.color = '#2a9d8f';
  } else if (currentLevel === 'sls') {
    style.color = '#e76f51';
    style.fillOpacity = 0.4;
  }

  layer.setStyle(style);
}

// Fungsi untuk menampilkan label kode wilayah di tengah poligon
function addCenterLabel(feature, text) {
  const center = getPolygonCenter(feature.geometry);
  if (!center) return;

  const area = turf.area(feature); // butuh turf.js
  let fontSize = 14;
  if (area < 100000) fontSize = 10;
  if (area < 30000) fontSize = 8;
  if (area < 10000) fontSize = 6;
  if (area < 3000) fontSize = 0; // terlalu kecil, jangan tampilkan

  if (fontSize > 0) {
    const label = L.marker(center, {
      icon: L.divIcon({
        className: 'label-text',
        html: `<div style="font-size:${fontSize}px;font-weight:bold;color:#000;text-shadow: 1px 1px 2px #fff;">${text}</div>`,
        iconSize: [100, 20],
        iconAnchor: [50, 10]
      }),
      interactive: false
    }).addTo(map);
    labelLayers.push(label);
  }
}

// Hitung titik tengah dari Polygon atau MultiPolygon
function getPolygonCenter(geometry) {
  try {
    const center = turf.center(geometry).geometry.coordinates;
    return [center[1], center[0]]; // [lat, lng]
  } catch (e) {
    return null;
  }
}

document.getElementById('back-btn').addEventListener('click', () => {
  if (currentLevel === 'sls') {
    showDesa();
  } else if (currentLevel === 'desa') {
    showKecamatan();
  }
});
