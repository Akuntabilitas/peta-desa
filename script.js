const map = L.map('map').setView([-7.5, 110.5], 10);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Global state
let kecLayer, desaLayer, slsLayer;
let selectedKecLayer = null;
let selectedDesaLayer = null;
let selectedSLSLayer = null;

let currentLevel = 'kecamatan';

const defaultStyle = { weight: 1, color: '#555', fillOpacity: 0.3 };
const highlightStyle = { weight: 3, color: '#ff7800', fillOpacity: 0.5 };

const backBtn = document.getElementById('backBtn');
const info = document.getElementById('info');

function setLevel(level) {
  currentLevel = level;
  document.body.className = `level-${level}`;
}

// Load Kecamatan
fetch('data/final_kec_202413309.geojson')
  .then(res => res.json())
  .then(data => {
    kecLayer = L.geoJSON(data, {
      style: defaultStyle,
      onEachFeature: (feature, layer) => {
        const label = feature.properties.nmkec;
        layer.bindTooltip(label, {
          permanent: true,
          direction: 'center',
          className: 'label label-kecamatan'
        });

        layer.on('click', (e) => {
          if (selectedKecLayer) selectedKecLayer.setStyle(defaultStyle);
          selectedKecLayer = layer;
          layer.setStyle(highlightStyle);

          map.fitBounds(layer.getBounds());

          clearLayers(['desa', 'sls']);
          selectedDesaLayer = null;
          selectedSLSLayer = null;

          loadDesa(feature.properties.kdkec);
          setLevel('desa');
          backBtn.hidden = false;
          info.innerText = `Kecamatan: ${label}`;
          e.originalEvent.stopPropagation();
        });
      }
    }).addTo(map);

    setLevel('kecamatan');
  });

// Load Desa
function loadDesa(kdkec) {
  fetch('data/final_desa_202413309.geojson')
    .then(res => res.json())
    .then(data => {
      const filtered = {
        ...data,
        features: data.features.filter(f => f.properties.kdkec === kdkec)
      };

      if (filtered.features.length === 0) {
        alert("Tidak ada desa untuk kecamatan ini.");
        return;
      }

      desaLayer = L.geoJSON(filtered, {
        style: defaultStyle,
        onEachFeature: (feature, layer) => {
          layer.bindTooltip(feature.properties.nmdesa, {
            permanent: true,
            direction: 'center',
            className: 'label label-desa'
          });

          layer.on('click', (e) => {
            if (selectedDesaLayer) selectedDesaLayer.setStyle(defaultStyle);
            selectedDesaLayer = layer;
            layer.setStyle(highlightStyle);

            map.fitBounds(layer.getBounds());

            clearLayers(['sls']);
            selectedSLSLayer = null;

            loadSLS(feature.properties.kddesa);
            setLevel('sls');
            info.innerText = `Desa: ${feature.properties.nmdesa}`;
            e.originalEvent.stopPropagation();
          });
        }
      }).addTo(map);
    });
}

// Load SLS
function loadSLS(kddesa) {
  fetch('data/final_sls_202413309.geojson')
    .then(res => res.json())
    .then(data => {
      const filtered = {
        ...data,
        features: data.features.filter(f => f.properties.kddesa === kddesa)
      };

      if (filtered.features.length === 0) {
        alert("Tidak ada SLS untuk desa ini.");
        return;
      }

      slsLayer = L.geoJSON(filtered, {
        style: defaultStyle,
        onEachFeature: (feature, layer) => {
          layer.bindTooltip(feature.properties.nmsls, {
            permanent: true,
            direction: 'center',
            className: 'label label-sls'
          });

          layer.on('click', (e) => {
            if (selectedSLSLayer) selectedSLSLayer.setStyle(defaultStyle);
            selectedSLSLayer = layer;
            layer.setStyle(highlightStyle);

            map.fitBounds(layer.getBounds());
            info.innerText = `SLS: ${feature.properties.nmsls}`;
            e.originalEvent.stopPropagation();
          });
        }
      }).addTo(map);
    });
}

// Clear layer by level
function clearLayers(levels) {
  if (levels.includes('desa') && desaLayer) {
    map.removeLayer(desaLayer);
    desaLayer = null;
  }
  if (levels.includes('sls') && slsLayer) {
    map.removeLayer(slsLayer);
    slsLayer = null;
  }
}

// Tombol kembali
function goBack() {
  if (currentLevel === 'sls') {
    clearLayers(['sls']);
    selectedSLSLayer = null;
    setLevel('desa');
    info.innerText = `Kecamatan: ${selectedKecLayer.feature.properties.nmkec} > Desa: ${selectedDesaLayer.feature.properties.nmdesa}`;
  } else if (currentLevel === 'desa') {
    clearLayers(['desa', 'sls']);
    if (selectedKecLayer) selectedKecLayer.setStyle(defaultStyle);
    selectedKecLayer = null;
    selectedDesaLayer = null;
    setLevel('kecamatan');
    backBtn.hidden = true;
    info.innerText = 'Klik wilayah untuk memperbesar';
  }
}
