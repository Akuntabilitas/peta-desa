let map = L.map('map').setView([-7.5, 110.6], 10);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '© OpenStreetMap'
}).addTo(map);

let currentLevel = 'kecamatan';
let selectedKecamatan = null;
let selectedDesa = null;
let selectedSLS = null;
let mode = 'wilayah';

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

let taggingData = [];
let taggingLayer = L.layerGroup().addTo(map);

// Load GeoJSON
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

function clearMap() {
  Object.values(layers).forEach(l => l && map.removeLayer(l));
}

function clearTagging() {
  taggingLayer.clearLayers();
}

function showKecamatan() {
  clearMap();
  clearTagging();
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
    }
  }).addTo(map);

  map.fitBounds(layers.kecamatan.getBounds());

  if (mode === 'wilayah') {
    showTaggingForWilayah(null, null, null, 3);
  }
}

function showDesa() {
  clearMap();
  clearTagging();
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
    }
  }).addTo(map);

  map.fitBounds(layers.desa.getBounds());

  if (mode === 'wilayah') {
    showTaggingForWilayah(selectedKecamatan, null, null, 6);
  }
}

function showSLS() {
  clearMap();
  clearTagging();
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
    }
  }).addTo(map);

  map.fitBounds(layers.sls.getBounds());

  if (mode === 'wilayah') {
    showTaggingForWilayah(selectedKecamatan, selectedDesa, null, 8);
  }
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
    style.color = '#333'; style.fillOpacity = 0.2;
  } else if (currentLevel === 'desa') {
    style.color = '#2a9d8f';
  } else if (currentLevel === 'sls') {
    style.color = '#e76f51'; style.fillOpacity = 0.4;
  }
  layer.setStyle(style);
}

document.getElementById('back-btn').addEventListener('click', () => {
  if (currentLevel === 'sls') {
    showDesa();
  } else if (currentLevel === 'desa') {
    showKecamatan();
  }
});

document.getElementById('mode-select').addEventListener('change', e => {
  mode = e.target.value;
  document.getElementById('petugas-panel').style.display = mode === 'petugas' ? 'block' : 'none';
  clearTagging();
  if (mode === 'wilayah') {
    if (currentLevel === 'kecamatan') showKecamatan();
    else if (currentLevel === 'desa') showDesa();
    else if (currentLevel === 'sls') showSLS();
  }
});

document.getElementById('pml-select').addEventListener('change', e => {
  const nama = e.target.value;
  if (nama) showTaggingFiltered(t => t.PML === nama, 5);
});

document.getElementById('ppl-select').addEventListener('change', e => {
  const nama = e.target.value;
  if (nama) showTaggingFiltered(t => t.PPL === nama, 5);
});

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRW8AQ8pnphA7YgQsORfiKTby634f9trawHVLG5AspGbkY4G5A6vMfqwkiUQEztS8gYs1GuMJF_w766/pub?gid=0&single=true&output=csv';

Papa.parse(CSV_URL, {
  download: true,
  header: true,
  complete: results => {
    taggingData = results.data.map(t => ({
      lat: parseFloat(t.latitude),
      lng: parseFloat(t.longitude),
      nama: t.nama || t.nm_project || 'Tanpa Nama',
      PML: t.PML,
      PPL: t.PPL,
      kdkec: t.kdkec,
      kddesa: t.kddesa,
      kdsls: t.kdsls
    }));
    populatePetugasDropdown();
  }
});

function populatePetugasDropdown() {
  const pmlSet = new Set();
  const pplSet = new Set();
  taggingData.forEach(t => {
    if (t.PML) pmlSet.add(t.PML);
    if (t.PPL) pplSet.add(t.PPL);
  });

  const pmlSelect = document.getElementById('pml-select');
  const pplSelect = document.getElementById('ppl-select');

  pmlSet.forEach(nama => {
    const opt = document.createElement('option');
    opt.value = opt.text = nama;
    pmlSelect.appendChild(opt);
  });

  pplSet.forEach(nama => {
    const opt = document.createElement('option');
    opt.value = opt.text = nama;
    pplSelect.appendChild(opt);
  });
}

function showTaggingFiltered(filterFn, radius = 5) {
  clearTagging();
  taggingData.filter(filterFn).forEach(t => {
    if (!isNaN(t.lat) && !isNaN(t.lng)) {
      L.circleMarker([t.lat, t.lng], {
        radius: radius,
        color: '#ff5722',
        fillOpacity: 0.8
      })
      .bindPopup(`<b>${t.nama}</b><br>PPL: ${t.PPL}<br>PML: ${t.PML}`)
      .addTo(taggingLayer);
    }
  });
}

function showTaggingForWilayah(kdkec = null, kddesa = null, kdsls = null, radius = 5) {
  showTaggingFiltered(t =>
    (!kdkec || t.kdkec === kdkec) &&
    (!kddesa || t.kddesa === kddesa) &&
    (!kdsls || t.kdsls === kdsls),
    radius
  );
}
