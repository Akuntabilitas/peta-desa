let map = L.map('map').setView([-7.5, 110.6], 10);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles © Esri'
}).addTo(map);

const manualClusterLayer = L.layerGroup();

let currentLevel = 'kabupaten';
let selectedKecamatan = null;
let selectedDesa = null;
let selectedSLS = null;
let mode = 'wilayah';
let slsZoomed = false;

let layers = { kecamatan: null, desa: null, sls: null };
let geojsonData = { kecamatan: null, desa: null, sls: null };

let taggingData = [];
let slsMarkerLayer = L.layerGroup();
map.addLayer(slsMarkerLayer);

// Ambil data GeoJSON
fetch('data/final_kec_202413309.geojson').then(res => res.json()).then(data => geojsonData.kecamatan = data);
fetch('data/final_desa_202413309.geojson').then(res => res.json()).then(data => geojsonData.desa = data);
fetch('data/final_sls_202413309.geojson').then(res => res.json()).then(data => geojsonData.sls = data);

// Ambil data tagging
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
    showKecamatan();
  }
});

function clearMap() {
  Object.values(layers).forEach(l => l && map.removeLayer(l));
}
function clearTagging() {
  slsMarkerLayer.clearLayers();
  map.eachLayer(layer => {
    if (layer instanceof L.Marker && layer.options.icon && layer.options.icon.options.className === 'custom-cluster-icon') {
      map.removeLayer(layer);
    }
  });
}

function showKecamatan() {
  clearMap(); clearTagging();
  currentLevel = 'kecamatan';
  updateLegend(geojsonData.kecamatan.features, 'kdkec', 'nmkec');

  layers.kecamatan = L.geoJSON(geojsonData.kecamatan, {
    style: { color: '#1e1affff', weight: 1, fillOpacity: 0.2 },
    onEachFeature: (feature, layer) => {
      layer.bindTooltip(feature.properties.nmkec, { sticky: true });
      layer.on({
        click: () => {
          selectedKecamatan = feature.properties.kdkec;
          selectedDesa = null;
          showDesa();
        },
        mouseover: () => highlightFeature(layer),
        mouseout: () => resetHighlight(layer)
      });
    }
  }).addTo(map);

  map.fitBounds(layers.kecamatan.getBounds(), {
    paddingTopLeft: [0, 0],
    paddingBottomRight: [300, 0]
  });

  if (mode === 'wilayah') showTaggingForWilayah(null, null, null, 3);
}

function showDesa() {
  clearMap(); clearTagging();
  currentLevel = 'desa';
  const filtered = geojsonData.desa.features.filter(f => f.properties.kdkec === selectedKecamatan);
  updateLegend(filtered, 'kddesa', 'nmdesa');

  layers.desa = L.geoJSON({ type: 'FeatureCollection', features: filtered }, {
    style: { color: '#2a9d8f', weight: 1, fillOpacity: 0.3 },
    onEachFeature: (feature, layer) => {
      layer.bindTooltip(feature.properties.nmdesa, { sticky: true });
      layer.on({
        click: () => {
          selectedDesa = feature.properties.kddesa;
          selectedSLS = null;
          showSLS();
        },
        mouseover: () => highlightFeature(layer),
        mouseout: () => resetHighlight(layer)
      });
    }
  }).addTo(map);

  map.fitBounds(layers.desa.getBounds(), {
    paddingTopLeft: [0, 0],
    paddingBottomRight: [300, 0]
  });

  if (mode === 'wilayah') showTaggingForWilayah(selectedKecamatan, null, null, 6);
}

function showSLS() {
  clearMap(); clearTagging();
  currentLevel = 'sls';
  const filtered = geojsonData.sls.features.filter(f =>
    f.properties.kdkec === selectedKecamatan &&
    f.properties.kddesa === selectedDesa
  );
  updateLegend(filtered, 'kdsls', 'nmsls');

  layers.sls = L.geoJSON({ type: 'FeatureCollection', features: filtered }, {
    style: { color: '#e76f51', weight: 2, fillOpacity: 0 },
    onEachFeature: (feature, layer) => {
      layer.bindTooltip(feature.properties.nmsls, { sticky: true });
      layer.on({
        click: () => {
          selectedSLS = feature.properties.kdsls;
          slsZoomed = true;
          map.fitBounds(layer.getBounds(), {
            paddingBottomRight: [300, 0]
          });
          showTaggingForWilayah(selectedKecamatan, selectedDesa, selectedSLS, 6, false);
        },
        mouseover: () => highlightFeature(layer),
        mouseout: () => resetHighlight(layer)
      });
    }
  }).addTo(map);

  map.fitBounds(layers.sls.getBounds(), {
    paddingTopLeft: [0, 0],
    paddingBottomRight: [300, 0]
  });

  if (mode === 'wilayah') showTaggingForWilayah(selectedKecamatan, selectedDesa, null, 8);
}

function showTaggingForWilayah(kdkec = null, kddesa = null, kdsls = null, radius = 5, useCluster = true) {
  clearTagging();
manualClusterLayer.clearLayers();

  // Zoom ke satu SLS, tampilkan titik individu + label
  if (!useCluster) {
    taggingData.filter(t =>
      (!kdkec || t.kdkec === kdkec) &&
      (!kddesa || t.kddesa === kddesa) &&
      (!kdsls || t.kdsls === kdsls)
    ).forEach(t => {
      if (!isNaN(t.lat) && !isNaN(t.lng)) {
        const marker = L.circleMarker([t.lat, t.lng], {
          radius,
          color: '#ff5722',
          fillOpacity: 0.8
        }).bindPopup(`<b>${t.nama}</b><br>PPL: ${t.PPL}<br>PML: ${t.PML}`);

        marker.bindTooltip(t.nama || 'Tanpa Nama', {
          permanent: true,
          direction: 'bottom',
          className: 'tagging-label'
        });

        slsMarkerLayer.addLayer(marker);
      }
    });
    map.addLayer(slsMarkerLayer);
    return;
  }

  // Cluster manual berdasarkan kode wilayah
  const groupByCode = {};
  taggingData.filter(t =>
    (!kdkec || t.kdkec === kdkec) &&
    (!kddesa || t.kddesa === kddesa) &&
    (!kdsls || t.kdsls === kdsls)
  ).forEach(t => {
    if (!isNaN(t.lat) && !isNaN(t.lng)) {
      let kode = currentLevel === 'kecamatan' ? t.kdkec :
                 currentLevel === 'desa' ? t.kddesa :
                 currentLevel === 'sls' ? t.kdsls : 'all';

      if (!groupByCode[kode]) groupByCode[kode] = [];
      groupByCode[kode].push(t);
    }
  });

  Object.entries(groupByCode).forEach(([kode, titikList]) => {
    const group = L.featureGroup();

    titikList.forEach(t => {
      const marker = L.marker([t.lat, t.lng]).bindPopup(`${t.nama}`);
      group.addLayer(marker);
    });
    map.addLayer(manualClusterLayer);

// Cari layer poligon berdasarkan kode dan level
let layerGroup = layers[currentLevel];
let matchedLayer = null;
if (layerGroup && layerGroup.eachLayer) {
  layerGroup.eachLayer(l => {
    const prop = l.feature?.properties;
    if (prop) {
      const matchKode =
        (currentLevel === 'kecamatan' && prop.kdkec === kode) ||
        (currentLevel === 'desa' && prop.kddesa === kode) ||
        (currentLevel === 'sls' && prop.kdsls === kode);
      if (matchKode) matchedLayer = l;
    }
  });
}

let center;

if (matchedLayer) {
  const polygon = matchedLayer.feature;
  if (polygon && polygon.geometry) {
    const point = turf.pointOnFeature(polygon);
    center = L.latLng(point.geometry.coordinates[1], point.geometry.coordinates[0]);
  } else {
    center = matchedLayer.getBounds().getCenter();
  }
} else {
  // fallback: gunakan center dari titik tagging
  const bounds = group.getBounds();
  if (!bounds.isValid()) return;
  center = bounds.getCenter();
}



const namaWilayah =
  currentLevel === 'kecamatan'
    ? matchedLayer?.feature?.properties?.nmkec
    : currentLevel === 'desa'
    ? matchedLayer?.feature?.properties?.nmdesa
    : matchedLayer?.feature?.properties?.nmsls || '';

const manualCluster = L.marker(center, {
  icon: L.divIcon({
    html: `
      <div class="cluster-wrapper">
        <div class="cluster-manual">${titikList.length}</div>
        <div class="cluster-label">${namaWilayah}</div>
      </div>
    `,
    className: '', // biarkan kosong agar tidak menggeser
    iconSize: null // biarkan null agar auto-scale
  })
});



    manualCluster.on('click', () => {
      if (currentLevel === 'kecamatan') {
        selectedKecamatan = kode;
        selectedDesa = null;
        showDesa();
      } else if (currentLevel === 'desa') {
        selectedDesa = kode;
        selectedSLS = null;
        showSLS();
      } else if (currentLevel === 'sls') {
  selectedSLS = kode;
  slsZoomed = true;
  showTaggingForWilayah(selectedKecamatan, selectedDesa, selectedSLS, 6, false);

  // Zoom ke poligon SLS yang sesuai
  const slsLayerGroup = layers['sls'];
  if (slsLayerGroup && slsLayerGroup.eachLayer) {
    slsLayerGroup.eachLayer(l => {
      const prop = l.feature?.properties;
      if (prop?.kdsls === kode) {
        map.fitBounds(l.getBounds());
      }
    });
  }
}

    });

    manualClusterLayer.addLayer(manualCluster);
  });
}


function highlightFeature(layer) {
  layer.setStyle({ weight: 3, color: '#2196f3', fillOpacity: 0.6 });
  layer.bringToFront();
}
function resetHighlight(layer) {
  const style = currentLevel === 'kecamatan' ? { color: '#1e1affff', weight: 1, fillOpacity: 0.2 } :
                 currentLevel === 'desa' ? { color: '#2a9d8f', weight: 1, fillOpacity: 0.3 } :
                 { color: '#e76f51', weight: 2, fillOpacity: 0 };
  layer.setStyle(style);
}
function findLayerByFeature(feature) {
  const group = layers[currentLevel];
  let found = null;
  if (group && group.eachLayer) {
    group.eachLayer(layer => {
      if (JSON.stringify(layer.feature.properties) === JSON.stringify(feature.properties)) {
        found = layer;
      }
    });
  }
  return found;
}
function updateLegend(features, codeProp, nameProp) {
  const list = document.getElementById('legend-list');
  list.innerHTML = '';
  features.sort((a, b) => a.properties[codeProp].localeCompare(b.properties[codeProp]))
    .forEach(f => {
      const li = document.createElement('li');
      li.className = 'legend-item';
      li.textContent = `(${f.properties[codeProp]}) ${f.properties[nameProp]}`;
      li.addEventListener('click', () => {
        if (currentLevel === 'kecamatan') {
          selectedKecamatan = f.properties.kdkec; showDesa();
        } else if (currentLevel === 'desa') {
          selectedDesa = f.properties.kddesa; showSLS();
        } else if (currentLevel === 'sls') {
          selectedSLS = f.properties.kdsls;
          const layer = findLayerByFeature(f);
          if (layer) {
            map.fitBounds(layer.getBounds(), { paddingBottomRight: [300, 0] });
            showTaggingForWilayah(selectedKecamatan, selectedDesa, selectedSLS, 6, false);
          }
        }
      });
      list.appendChild(li);
    });
}

document.getElementById('back-btn').addEventListener('click', () => {
  if (currentLevel === 'sls') {
    if (slsZoomed) {
      slsZoomed = false;
      selectedSLS = null;
      showSLS();
    } else {
      selectedSLS = null;
      showDesa();
    }
  } else if (currentLevel === 'desa') {
    selectedDesa = null;
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

function populatePetugasDropdown() {
  const pmlSet = new Set(), pplSet = new Set();
  taggingData.forEach(t => {
    if (t.PML) pmlSet.add(t.PML);
    if (t.PPL) pplSet.add(t.PPL);
  });
  const pmlSelect = document.getElementById('pml-select');
  const pplSelect = document.getElementById('ppl-select');
  pmlSet.forEach(n => pmlSelect.append(new Option(n, n)));
  pplSet.forEach(n => pplSelect.append(new Option(n, n)));
}

document.getElementById('pml-select').addEventListener('change', e => {
  const nama = e.target.value;
  if (nama) showTaggingFiltered(t => t.PML === nama, 5);
});
document.getElementById('ppl-select').addEventListener('change', e => {
  const nama = e.target.value;
  if (nama) showTaggingFiltered(t => t.PPL === nama, 5);
});

function showTaggingFiltered(filterFn, radius = 5) {
  clearTagging();
  taggingData.filter(filterFn).forEach(t => {
    if (!isNaN(t.lat) && !isNaN(t.lng)) {
      const marker = L.circleMarker([t.lat, t.lng], {
        radius,
        color: '#ff5722',
        fillOpacity: 0.8
      }).bindPopup(`<b>${t.nama}</b><br>PPL: ${t.PPL}<br>PML: ${t.PML}`);
      slsMarkerLayer.addLayer(marker);
    }
  });
  map.addLayer(slsMarkerLayer);
}
