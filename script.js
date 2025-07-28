const map = L.map('map').setView([-7.5, 110.5], 10);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let kecLayer, desaLayer, slsLayer;
let selectedKecLayer = null;
let selectedDesaLayer = null;
let selectedSLSLayer = null;

let currentLevel = 'kecamatan';
const defaultStyle = { weight: 1, color: '#555', fillOpacity: 0.3 };
const highlightStyle = { weight: 3, color: '#ff7800', fillOpacity: 0.5 };

const backBtn = document.getElementById('backBtn');

// -- KECAMATAN
fetch('data/final_kec_202413309.geojson')
  .then(res => res.json())
  .then(data => {
    kecLayer = L.geoJSON(data, {
      style: defaultStyle,
      onEachFeature: (feature, layer) => {
        layer.bindTooltip(feature.properties.nmkec, {
          permanent: true,
          direction: 'center',
          className: 'label-tooltip'
        });

        layer.on('click', () => {
          if (selectedKecLayer) selectedKecLayer.setStyle(defaultStyle);
          selectedKecLayer = layer;
          layer.setStyle(highlightStyle);

          map.fitBounds(layer.getBounds());
          clearLayers(['desa', 'sls']);
          selectedDesaLayer = null;
          selectedSLSLayer = null;

          currentLevel = 'desa';
          backBtn.hidden = false;

          loadDesa(feature.properties.kdkec);
        });
      }
    }).addTo(map);
  });

// -- DESA
function loadDesa(kdkec) {
  fetch('data/final_desa_202413309.geojson')
    .then(res => res.json())
    .then(data => {
      const filtered = {
        ...data,
        features: data.features.filter(f => f.properties.kdkec === kdkec)
      };

      desaLayer = L.geoJSON(filtered, {
        style: defaultStyle,
        onEachFeature: (feature, layer) => {
          layer.bindTooltip(feature.properties.nmdesa, {
            permanent: true,
            direction: 'center',
            className: 'label-tooltip'
          });

          layer.on('click', (e) => {
            if (selectedDesaLayer) selectedDesaLayer.setStyle(defaultStyle);
            selectedDesaLayer = layer;
            layer.setStyle(highlightStyle);

            map.fitBounds(layer.getBounds());

            clearLayers(['sls']);
            selectedSLSLayer = null;

            currentLevel = 'sls';
            loadSLS(feature.properties.kddesa);

            e.originalEvent.stopPropagation();
          });
        }
      }).addTo(map);
    });
}

// -- SLS
function loadSLS(kddesa) {
  fetch('data/final_sls_202413309.geojson')
    .then(res => res.json())
    .then(data => {
      const filtered = {
        ...data,
        features: data.features.filter(f => f.properties.kddesa === kddesa)
      };

      slsLayer = L.geoJSON(filtered, {
        style: defaultStyle,
        onEachFeature: (feature, layer) => {
          layer.bindTooltip(feature.properties.nmsls, {
            permanent: true,
            direction: 'center',
            className: 'label-tooltip'
          });

          layer.on('click', (e) => {
            if (selectedSLSLayer) selectedSLSLayer.setStyle(defaultStyle);
            selectedSLSLayer = layer;
            layer.setStyle(highlightStyle);

            map.fitBounds(layer.getBounds());
            e.originalEvent.stopPropagation();
          });
        }
      }).addTo(map);
    });
}

// -- Bersihkan layer berdasarkan level
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

// -- BACK button logic
function goBack() {
  if (currentLevel === 'sls') {
    clearLayers(['sls']);
    selectedSLSLayer = null;
    currentLevel = 'desa';
  } else if (currentLevel === 'desa') {
    clearLayers(['desa', 'sls']);
    if (selectedKecLayer) {
      selectedKecLayer.setStyle(defaultStyle);
      selectedKecLayer = null;
    }
    selectedDesaLayer = null;
    selectedSLSLayer = null;
    currentLevel = 'kecamatan';
    backBtn.hidden = true;
  }
}
