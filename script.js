showSpinner();
let map = L.map('map').setView([-7.5, 110.6], 10);
map.zoomControl.setPosition('bottomleft');
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
// Buat sekali saat load data awal
const slsIndex = [];

if (layers['sls']) {
  layers['sls'].eachLayer(layer => {
    const prop = layer.feature?.properties;
    if (prop?.kdkec && prop?.kddesa && prop?.kdsls) {
      slsIndex.push({
        kode: {
          kdkec: prop.kdkec,
          kddesa: prop.kddesa,
          kdsls: prop.kdsls
        },
        layer: layer
      });
    }
  });
}

function getSLSLayerByCode(kdkec, kddesa, kdsls) {
  return slsIndex.find(p =>
    p.kode.kdkec === kdkec &&
    p.kode.kddesa === kddesa &&
    p.kode.kdsls === kdsls
  )?.layer || null;
}

map.addLayer(slsMarkerLayer);
// Ambil data GeoJSON
fetch('data/final_kec_202413309.geojson').then(res => res.json()).then(data => geojsonData.kecamatan = data);
fetch('data/final_desa_202413309.geojson').then(res => res.json()).then(data => geojsonData.desa = data);
fetch('data/final_sls_202413309.geojson')
  .then(res => res.json())
  .then(data => {
    geojsonData.sls = data;

    // Bangun indeks untuk getSLSLayerByCode
    layers.sls = L.geoJSON(geojsonData.sls);
    layers.sls.eachLayer(layer => {
      const prop = layer.feature?.properties;
      if (prop?.kdkec && prop?.kddesa && prop?.kdsls) {
        slsIndex.push({
          kode: {
            kdkec: prop.kdkec,
            kddesa: prop.kddesa,
            kdsls: prop.kdsls
          },
          layer: layer
        });
      }
    });
  });


// Ambil data tagging
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRW8AQ8pnphA7YgQsORfiKTby634f9trawHVLG5AspGbkY4G5A6vMfqwkiUQEztS8gYs1GuMJF_w766/pub?gid=0&single=true&output=csv';
Papa.parse(CSV_URL, {
  download: true,
  header: true,
  complete: results => {
    taggingData = results.data.map(t => {
      const lat = parseFloat(t.latitude);
      const lng = parseFloat(t.longitude);

      const dataTitik = {
        lat,
        lng,
        nama: t.nama || t.nm_project || 'Tanpa Nama',
        PML: t.PML,
        PPL: t.PPL,
        kdkec: t.kdkec,
        kddesa: t.kddesa,
        kdsls: t.kdsls,
        tipe_landmark: t.tipe_landmark?.trim() || 'Lainnya',
        isNyasar: false // default
      };
      return dataTitik;
    });
    // Hitung isNyasar untuk semua titik saat awal
taggingData.forEach(t => {
  if (!t.lat || !t.lng || !t.kdkec || !t.kddesa || !t.kdsls) return;

  const matchedSLS = getSLSLayerByCode(t.kdkec, t.kddesa, t.kdsls);
  if (!matchedSLS?.feature?.geometry) return;

  try {
    const turfPoint = turf.point([parseFloat(t.lng), parseFloat(t.lat)]);
    const geom = matchedSLS.feature.geometry;
    let polygon = null;

    if (geom.type === 'Polygon') {
      polygon = turf.polygon(geom.coordinates);
    } else if (geom.type === 'MultiPolygon') {
      polygon = turf.multiPolygon(geom.coordinates);
    }

    if (polygon) {
      const nearest = turf.nearestPointOnLine(turf.polygonToLine(polygon), turfPoint);
      const dist = turf.distance(turfPoint, nearest, { units: 'meters' });
      t.isNyasar = dist > 50;
    }
  } catch (err) {
    console.warn("Gagal memproses polygon SLS untuk nyasar:", err);
  }
});


    populatePetugasDropdown();
    showKecamatan();
    hideSpinner();
  }
});


let kategoriMode = 'wilkerstat'; // default

document.getElementById('toggle-kategori').addEventListener('change', e => {
  kategoriMode = e.target.checked ? 'konsentrasi' : 'wilkerstat';
  document.getElementById('label-kategori').textContent = kategoriMode === 'konsentrasi'
    ? 'Wilayah Konsentrasi'
    : 'Batas Wilkerstat';

  clearTagging();

  if (kategoriMode === 'wilkerstat') {
    if (currentLevel === 'kecamatan') {
      showTaggingForWilayah(null, null, null, 3, true);
    } else if (currentLevel === 'desa') {
      showTaggingForWilayah(selectedKecamatan, null, null, 6, true);
    } else if (currentLevel === 'sls') {
      if (slsZoomed && selectedSLS) {
        showTaggingForWilayah(selectedKecamatan, selectedDesa, selectedSLS, 6, false); // INDIVIDU
      } else {
        showTaggingForWilayah(selectedKecamatan, selectedDesa, null, 8, true); // CLUSTER
      }
    }
  } else {
    // KONSENTRASI
    if (currentLevel === 'kecamatan') {
      showKonsentrasiIcons(null, null, null);
    } else if (currentLevel === 'desa') {
      showKonsentrasiIcons(selectedKecamatan, null, null);
    } else if (currentLevel === 'sls') {
      if (slsZoomed && selectedSLS) {
        showKonsentrasiIcons(selectedKecamatan, selectedDesa, selectedSLS); // 1 SLS
      } else {
        showKonsentrasiIcons(selectedKecamatan, selectedDesa, null); // Semua SLS di desa
      }
    }
  }
});


function showKonsentrasiIcons(kdkec = null, kddesa = null, kdsls = null) {
  clearTagging();

  const kategori = [
    'Mall', 'Pertokoan', 'Pasar',
    'Gedung Perkantoran', 'Kawasan Industri/Sentra Industri',
    'Tempat Rekreasi', 'Pelabuhan', 'Bandara', 'Terminal', 'Stasiun'
  ];

  taggingData.filter(t =>
    kategori.includes(t.tipe_landmark) &&
    (!kdkec || t.kdkec === kdkec) &&
    (!kddesa || t.kddesa === kddesa) &&
    (!kdsls || t.kdsls === kdsls)
  ).forEach(t => {
    if (!isNaN(t.lat) && !isNaN(t.lng)) {
        // Hitung apakah titik nyasar terhadap poligon SLS yang sesuai
  let isNyasar = false;
  const key = `${t.kdkec}-${t.kddesa}-${t.kdsls}`;
  const geom = slsIndex[key];
      const jenis = ikonLandmark[t.tipe_landmark] || { icon: '❓', color: '#999' };
      const icon = L.divIcon({
        html: `<div style="font-size: 18px; color: ${jenis.color}; text-align: center;">${jenis.icon}</div>`,
        className: 'tipe-landmark-icon',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([t.lat, t.lng], { icon }).bindPopup(
        `<b>${t.nama}</b><br>PPL: ${t.PPL}<br>PML: ${t.PML}<br>Jenis: ${t.tipe_landmark}`
      );

      slsMarkerLayer.addLayer(marker);
    }
  });

  map.addLayer(slsMarkerLayer);
}

function clearMap() {
  Object.values(layers).forEach(l => l && map.removeLayer(l));
}
function clearTagging() {
  slsMarkerLayer.clearLayers();

  if (map.hasLayer(manualClusterLayer)) {
    map.removeLayer(manualClusterLayer);
  }

  map.eachLayer(layer => {
    if (layer instanceof L.Marker && layer.options.icon && layer.options.icon.options.className === 'custom-cluster-icon') {
      map.removeLayer(layer);
    }
  });
}

const ikonLandmark = {
  'Batas SLS' : { icon: '🔴', color: '#ff9800' },
  'Batas Segmen': { icon: '⚪', color: '#ff9800' },
  'Mall': { icon: '🏬', color: '#ff9800' },
  'Pertokoan': { icon: '🏪', color: '#9c27b0' },
  'Pasar': { icon: '🛒', color: '#f44336' },
  'Gedung Perkantoran': { icon: '🏢', color: '#ff9800' },
  'Kawasan Industri/Sentra Industri': { icon: '🏭', color: '#9c27b0' },
  'Tempat Rekreasi': { icon: '🎡', color: '#f44336' },
  'Pelabuhan': { icon: '🚢', color: '#ff9800' },
  'Bandara': { icon: '✈️', color: '#9c27b0' },
  'Terminal': { icon: '🚌', color: '#f44336' },
  'Stasiun': { icon: '🚆', color: '#f44336' }
};
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

  if (kategoriMode === 'wilkerstat') {
  showTaggingForWilayah(null, null, null, 3, true); // hanya batas
} else {
  showKonsentrasiIcons(null, null, null); // ikon langsung
}
setNav(); // default semua wilayah
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
  if (kategoriMode === 'wilkerstat') {
  showTaggingForWilayah(selectedKecamatan, null, null, 6, true); // hanya batas
} else {
  showKonsentrasiIcons(selectedKecamatan, null, null); // ikon langsung
}
setNav('kecamatan', {
    nmkec: getNamaKecamatan(selectedKecamatan)
  });
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
        setNav('sls', {
  nmkec: getNamaKecamatan(selectedKecamatan),
  nmdesa: getNamaDesa(selectedKecamatan, selectedDesa),
  nmsls: getNamaSLS(selectedKecamatan, selectedDesa, selectedSLS)
});

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
  if (kategoriMode === 'wilkerstat') {
  showTaggingForWilayah(selectedKecamatan, selectedDesa, null, 8, true); // hanya batas
} else {
  showKonsentrasiIcons(selectedKecamatan, selectedDesa, null); // ikon langsung
}
setNav('desa', {
  nmkec: getNamaKecamatan(selectedKecamatan),
  nmdesa: getNamaDesa(selectedKecamatan, selectedDesa)
});

}

function showTaggingForWilayah(kdkec = null, kddesa = null, kdsls = null, radius = 5, useCluster = true) {
  clearTagging();
  
manualClusterLayer.clearLayers();
// Bangun indeks poligon SLS hanya sekali
if (Object.keys(slsIndex).length === 0 && layers.sls && layers.sls.eachLayer) {
  layers.sls.eachLayer(l => {
    const prop = l.feature?.properties;
    const geom = l.feature?.geometry;
    if (prop && geom && geom.coordinates?.length) {
      const key = `${prop.kdkec}-${prop.kddesa}-${prop.kdsls}`;
      slsIndex[key] = geom;
    }
  });
}

  // Zoom ke satu SLS, tampilkan titik individu + label
  if (!useCluster) {
    taggingData.filter(t =>
  (!kdkec || t.kdkec === kdkec) &&
  (!kddesa || t.kddesa === kddesa) &&
  (!kdsls || t.kdsls === kdsls)
).forEach(t => {
  if (!isNaN(t.lat) && !isNaN(t.lng)) {
    const jenis = ikonLandmark[t.tipe_landmark] || { icon: '❓', color: '#999' };

    const icon = L.divIcon({
      html: `
        <div style="
          font-size: 18px;
          text-align: center;
          line-height: 1;
          color: ${jenis.color};
        ">${jenis.icon}</div>
      `,
      className: 'tipe-landmark-icon',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const marker = L.marker([t.lat, t.lng], { icon }).bindPopup(
      `<b>${t.nama}</b><br>PPL: ${t.PPL}<br>PML: ${t.PML}<br>Jenis: ${t.tipe_landmark}`
    );

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
      if (!t.isNyasar) {  // agar tidak dihitung 2x
  const matchedSLS = getSLSLayerByCode(t.kdkec, t.kddesa, t.kdsls);
  if (matchedSLS?.feature?.geometry) {
    try {
      const point = turf.point([t.lng, t.lat]);
      const poly = matchedSLS.feature;
      const isInside = turf.booleanPointInPolygon(point, poly);

      if (!isInside) {
        t.isNyasar = true;
      }
    } catch (err) {
      console.warn("Gagal memproses polygon SLS untuk nyasar:", err);
    }
  }
}

    }
  });
  
  // === [1] Preprocess Indexing Layer SLS ===
const slsLayerGroup = layers['sls'];

if (slsLayerGroup) {
  slsLayerGroup.eachLayer(l => {
    const props = l.feature?.properties;
    if (!props) return;
    const key = `${props.kdkec}-${props.kddesa}-${props.kdsls}`;
    slsIndex[key] = l;
  });
}

// === [2] Tandai isNyasar untuk tiap titik tagging ===
taggingData.forEach(t => {
  if (!t.lat || !t.lng || !t.kdkec || !t.kddesa || !t.kdsls) return;

  const key = `${t.kdkec}-${t.kddesa}-${t.kdsls}`;
  const matchedLayer = slsIndex[key];
  let isNyasar = false;

  try {
    if (matchedLayer?.feature?.geometry) {
      const turfPoint = turf.point([parseFloat(t.lng), parseFloat(t.lat)]);
      const geom = matchedLayer.feature.geometry;
      let polygon = null;

      if (geom.type === 'Polygon') {
        polygon = turf.polygon(geom.coordinates);
      } else if (geom.type === 'MultiPolygon') {
        polygon = turf.multiPolygon(geom.coordinates);
      }

  if (polygon) {
  const nearest = turf.nearestPointOnLine(turf.polygonToLine(polygon), turfPoint);
  const dist = turf.distance(turfPoint, nearest, { units: 'meters' });
  t.jarakKeBatas = dist;
  isNyasar = dist > 20;
}
    }
  } catch (err) {
    console.warn("Gagal memproses polygon SLS untuk nyasar:", err);
  }

  t.isNyasar = isNyasar;
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

function isKonsentrasiEkonomi(tipe) {
  const list = [
    'Mall', 'Pasar', 'Pertokoan', 'Gedung Perkantoran',
    'Kawasan Industri/Sentra Industri', 'Tempat Rekreasi',
    'Pelabuhan', 'Bandara', 'Terminal', 'Stasiun'
  ];
  return list.includes(tipe);
}



const namaWilayah =
  currentLevel === 'kecamatan'
    ? matchedLayer?.feature?.properties?.nmkec
    : currentLevel === 'desa'
    ? matchedLayer?.feature?.properties?.nmdesa
    : matchedLayer?.feature?.properties?.nmsls || '';

const jumlahBatasSLS = titikList.filter(t => t.tipe_landmark === 'Batas SLS').length;
const jumlahBatasSegmen = titikList.filter(t => t.tipe_landmark === 'Batas Segmen').length;
const jumlahEkonomi = titikList.filter(t => isKonsentrasiEkonomi(t.tipe_landmark)).length;
const jumlahNyasar = titikList.filter(t => t.isNyasar).length;

const nyasarLabelHTML = jumlahNyasar > 0
  ? `<div class="cluster-label">
       <span class="nyasar-label has-nyasar">⚠️${jumlahNyasar} > 20m dari batas </span>
     </div>`
  : '';
const manualCluster = L.marker(center, {
  icon: L.divIcon({
    html: `
      <div class="cluster-box">
        <span class="sls-count">${jumlahBatasSLS}</span> /
        <span class="segmen-count">${jumlahBatasSegmen}</span> /
        <span class="konsentrasi-count">${jumlahEkonomi}</span>
      </div>
      ${nyasarLabelHTML}
      <div class="cluster-label"><b>${namaWilayah}</b></div>
    `,
    className: '',
    iconSize: [100, 40]
  })
});


manualCluster.bindTooltip(
  `<div>${namaWilayah}</div>Batas SLS: ${jumlahBatasSLS}<br>Batas Segmen: ${jumlahBatasSegmen}<br>Wilayah Konsentrasi: ${jumlahEkonomi}`,
  { direction: 'top', permanent: false, className: 'cluster-tooltip' }
);




    manualCluster.on('click', () => {
  if (currentLevel === 'kecamatan') {
    selectedKecamatan = kode;
    selectedDesa = null;       // reset desa
    selectedSLS = null;        // reset sls
    showDesa();
  } else if (currentLevel === 'desa') {
    selectedDesa = kode;
    selectedSLS = null;        // reset sls
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

function setNav(level, data = {}) {
  const nav = document.getElementById("simple-nav");

  const semua = `<span onclick="showKecamatan()">KAB BOYOLALI</span>`;
  const kec = `<span onclick="showDesa()">${data.nmkec || 'Kecamatan'}</span>`;
  const desa = `<span onclick="showSLS()">${data.nmdesa || 'Desa'}</span>`;
  const sls = `SLS ${data.nmsls || data.kdsls || ''}`; // hanya teks, tidak bisa diklik

  if (level === 'kecamatan') {
    nav.innerHTML = `${semua} › ${data.nmkec}`;
  } else if (level === 'desa') {
    nav.innerHTML = `${semua} › ${kec} › ${data.nmdesa}`;
  } else if (level === 'sls') {
    nav.innerHTML = `${semua} › ${kec} › ${desa} › ${sls}`;
  } else {
    nav.innerHTML = semua;
  }
}



function getNamaKecamatan(kdkec) {
  const f = geojsonData.kecamatan.features.find(f => f.properties.kdkec === kdkec);
  return f ? f.properties.nmkec : '';
}

function getNamaKecamatan(kdkec) {
  const kec = geojsonData.kecamatan.features.find(f => f.properties.kdkec === kdkec);
  return kec ? kec.properties.nmkec : '';
}

function getNamaDesa(kdkec, kddesa) {
  const desa = geojsonData.desa.features.find(f =>
    f.properties.kdkec === kdkec && f.properties.kddesa === kddesa
  );
  return desa ? desa.properties.nmdesa : '';
}

function getNamaSLS(kdkec, kddesa, kdsls) {
  const sls = geojsonData.sls.features.find(f =>
    f.properties.kdkec === kdkec &&
    f.properties.kddesa === kddesa &&
    f.properties.kdsls === kdsls
  );
  return sls ? sls.properties.nmsls : '';
}

function showSpinner() {
  document.getElementById('loading-spinner').classList.remove('hidden');
}

function hideSpinner() {
  document.getElementById('loading-spinner').classList.add('hidden');
}

function exportTitikNyasar() {
  const nyasar = taggingData.filter(t => t.isNyasar && t.lat && t.lng);

  if (nyasar.length === 0) {
    alert("Tidak ada titik nyasar yang ditemukan.");
    return;
  }

  const headers = [
    "kdkec", "nmkec", "kddesa","nmdesa", "kdsls","nmsls", "PML","PPL", "jarak_meter"
  ];

  const rows = nyasar.map(t => [
    t.kdkec,
    getNamaKecamatan(t.kdkec),
    t.kddesa,
    getNamaDesa(t.kdkec, t.kddesa),
    t.kdsls,
    getNamaSLS(t.kdkec, t.kddesa, t.kdsls),
    t.PML,
    t.PPL,
    t.jarakKeBatas || ''
  ]);

  const csvContent = "data:text/csv;charset=utf-8," +
    [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "titik nyasar.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

const btnExport = document.getElementById("btn-export-nyasar");
const popupExport = document.getElementById("popup-export");
const closePopup = document.getElementById("close-popup");

btnExport.addEventListener("click", () => {
  popupExport.classList.toggle("show");
  populateKecamatanDropdown();
  populateDesaDropdown();
});

closePopup.addEventListener("click", () => {
  popupExport.classList.remove("show");
});

// Populate Kecamatan Dropdown
function populateKecamatanDropdown() {
  const select = document.getElementById("filter-kec");
  select.innerHTML = `<option value="">Semua Kecamatan</option>`;
  geojsonData.kecamatan.features.forEach(f => {
    const opt = document.createElement("option");
    opt.value = f.properties.kdkec;
    opt.textContent = f.properties.nmkec;
    select.appendChild(opt);
  });
}

// Populate Desa Dropdown
function populateDesaDropdown(selectedKec = "") {
  const select = document.getElementById("filter-desa");
  select.innerHTML = `<option value="">Semua Desa</option>`;
  geojsonData.desa.features
    .filter(f => !selectedKec || f.properties.kdkec === selectedKec)
    .forEach(f => {
      const opt = document.createElement("option");
      opt.value = f.properties.kddesa;
      opt.textContent = f.properties.nmdesa;
      select.appendChild(opt);
    });
}

// Update Desa saat Kecamatan dipilih
document.getElementById("filter-kec").addEventListener("change", function () {
  const selectedKec = this.value;
  populateDesaDropdown(selectedKec);
});

// Download file
document.getElementById("download-filtered").addEventListener("click", () => {
  const selectedKec = document.getElementById("filter-kec").value;
  const selectedDesa = document.getElementById("filter-desa").value;

  const filtered = taggingData.filter(t => {
    if (!t.isNyasar) return false;
    if (selectedKec && t.kdkec !== selectedKec) return false;
    if (selectedDesa && t.kddesa !== selectedDesa) return false;
    return true;
  });

  // Export to CSV
  let csv = "kdkec,kddesa,kdsls,nmkec,nmdesa,nmsls,lat,lng\n";
  filtered.forEach(t => {
    csv += [
      t.kdkec,
      t.kddesa,
      t.kdsls,
      getNamaKecamatan(t.kdkec),
      getNamaDesa(t.kdkec, t.kddesa),
      getNamaSLS(t.kdkec, t.kddesa, t.kdsls),
      t.lat,
      t.lng
    ].join(",") + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "tagging-nyasar.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  popupExport.classList.remove("show");
});

