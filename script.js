// Inisialisasi peta
const map = L.map('map').setView([-7.5, 110.6], 10); // sesuaikan koordinat awal

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Global state
let currentLevel = 'kecamatan'; // level awal
let selectedKecamatan = null;
let selectedDesa = null;

let kecamatanLayer, desaLayer, slsLayer;
let legendList = document.getElementById("legendList");
let legendTitle = document.getElementById("legendTitle");

// Tombol kembali
document.getElementById("backBtn").onclick = () => {
  if (currentLevel === 'desa') {
    loadKecamatan();
  } else if (currentLevel === 'sls') {
    loadDesa(selectedKecamatan);
  }
};

// Fungsi hover label
function onEachFeature(feature, layer, level) {
  layer.on({
    mouseover: function (e) {
      const layer = e.target;
      layer.setStyle({ weight: 3, color: '#2a7be4', fillOpacity: 0.6 });
      const nama = feature.properties[`nm${level}`];
      layer.bindTooltip(nama, { permanent: false, direction: 'top' }).openTooltip();
      highlightLegendItem(feature.properties[`kd${level}`]);
    },
    mouseout: function (e) {
      geojson.resetStyle(e.target);
      layer.closeTooltip();
      clearHighlightLegend();
    }
  });
}

// Fungsi membuat legenda interaktif
function updateLegend(features, level) {
  legendList.innerHTML = "";
  legendTitle.textContent = `Daftar ${level[0].toUpperCase() + level.slice(1)}`;
  const sorted = [...features].sort((a, b) =>
    a.properties[`kd${level}`].localeCompare(b.properties[`kd${level}`])
  );
  sorted.forEach(f => {
    const li = document.createElement("li");
    const kode = f.properties[`kd${level}`];
    const nama = f.properties[`nm${level}`];
    li.textContent = `${kode} ${nama}`;
    li.dataset.kode = kode;
    li.onclick = () => {
      if (level === "kecamatan") {
        selectedKecamatan = kode;
        loadDesa(kode);
      } else if (level === "desa") {
        selectedDesa = kode;
        loadSLS(kode);
      }
    };
    li.onmouseover = () => highlightPolygonByCode(kode, level);
    li.onmouseout = () => clearHighlightMap();
    legendList.appendChild(li);
  });
}

// Fungsi untuk highlight dari legenda ke peta
function highlightPolygonByCode(code, level) {
  const layerGroup = level === 'kecamatan' ? kecamatanLayer :
                     level === 'desa' ? desaLayer : slsLayer;
  layerGroup.eachLayer(layer => {
    if (layer.feature.properties[`kd${level}`] === code) {
      layer.setStyle({ weight: 3, color: '#2a7be4', fillOpacity: 0.6 });
    }
  });
}

function clearHighlightMap() {
  if (kecamatanLayer) kecamatanLayer.resetStyle();
  if (desaLayer) desaLayer.resetStyle();
  if (slsLayer) slsLayer.resetStyle();
}

function highlightLegendItem(code) {
  [...legendList.children].forEach(li => {
    li.style.backgroundColor = li.dataset.kode === code ? '#e6f0ff' : '';
  });
}

function clearHighlightLegend() {
  [...legendList.children].forEach(li => li.style.backgroundColor = '');
}

// Load GeoJSON
function loadGeoJSON(url, style, level, callback) {
  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (level === 'kecamatan') {
        if (kecamatanLayer) map.removeLayer(kecamatanLayer);
        kecamatanLayer = L.geoJSON(data, {
          style,
          onEachFeature: (f, l) => {
            l.on('click', () => {
              selectedKecamatan = f.properties.kdkec;
              loadDesa(f.properties.kdkec);
            });
            onEachFeature(f, l, "kec");
          }
        }).addTo(map);
        map.fitBounds(kecamatanLayer.getBounds());
        currentLevel = "kecamatan";
        updateLegend(data.features, "kecamatan");
      }

      if (level === 'desa') {
        if (desaLayer) map.removeLayer(desaLayer);
        const filtered = {
          type: "FeatureCollection",
          features: data.features.filter(f => f.properties.kdkec === selectedKecamatan)
        };
        desaLayer = L.geoJSON(filtered, {
          style,
          onEachFeature: (f, l) => {
            l.on('click', () => {
              selectedDesa = f.properties.kddesa;
              loadSLS(f.properties.kddesa);
            });
            onEachFeature(f, l, "desa");
          }
        }).addTo(map);
        map.fitBounds(desaLayer.getBounds());
        currentLevel = "desa";
        updateLegend(filtered.features, "desa");
      }

      if (level === 'sls') {
        if (slsLayer) map.removeLayer(slsLayer);
        const filtered = {
          type: "FeatureCollection",
          features: data.features.filter(f => f.properties.kddesa === selectedDesa)
        };
        slsLayer = L.geoJSON(filtered, {
          style,
          onEachFeature: (f, l) => {
            onEachFeature(f, l, "sls");
          }
        }).addTo(map);
        map.fitBounds(slsLayer.getBounds());
        currentLevel = "sls";
        updateLegend(filtered.features, "sls");
      }

      if (callback) callback();
    });
}

// Style masing-masing level
const kecStyle = { color: "#444", weight: 1.5, fillColor: "#E0F7FA", fillOpacity: 0.5 };
const desaStyle = { color: "#666", weight: 1.5, fillColor: "#B2EBF2", fillOpacity: 0.5 };
const slsStyle =  { color: "#888", weight: 1.5, fillColor: "#80DEEA", fillOpacity: 0.5 };

// Fungsi load per level
function loadKecamatan() {
  selectedKecamatan = null;
  selectedDesa = null;
  if (desaLayer) map.removeLayer(desaLayer);
  if (slsLayer) map.removeLayer(slsLayer);
  loadGeoJSON("data/final_kec_202413309.geojson", kecStyle, "kecamatan");
}

function loadDesa(kdkec) {
  if (slsLayer) map.removeLayer(slsLayer);
  loadGeoJSON("data/final_desa_202413309.geojson", desaStyle, "desa");
}

function loadSLS(kddesa) {
  loadGeoJSON("data/final_sls_202413309.geojson", slsStyle, "sls");
}

// Mulai dari kecamatan
loadKecamatan();
