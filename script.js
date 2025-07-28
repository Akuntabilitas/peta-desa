const map = L.map('map').setView([-7.5, 110.5], 10);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Global layers
let kecLayer, desaLayer, slsLayer;
let selectedKecLayer = null;
let selectedDesaLayer = null;
let selectedSLSLayer = null;

let currentLevel = 'kecamatan';

const defaultStyle = {
  weight: 1,
  color: '#555',
  fillOpacity: 0.3
};

const highlightStyle = {
  weight: 3,
  color: '#ff7800',
  fillOpacity: 0.7
};

const hoverStyle = {
  weight: 2,
  color: '#000',
  fillOpacity: 0.9
};

// UI
const backBtn = document.getElementById('backBtn');

// ----------- Load Kecamatan -----------
fetch('data/final_kec_202413309.geojson')
  .then(res => res.json())
  .then(data => {
    kecLayer = L.geoJSON(data, {
      style: defaultStyle,
      onEachFeature: (feature, layer) => {
        const label = feature.properties.nmkec;
        layer._label = L.tooltip({ permanent: true, direction: 'center', className: 'label' })
          .setContent(label)
          .setLatLng(layer.getBounds().getCenter());
        map.addLayer(layer._label);

        layer.on('click', () => {
          if (selectedKecLayer) selectedKecLayer.setStyle(defaultStyle);
          selectedKecLayer = layer;
          layer.setStyle(highlightStyle);

          map.fitBounds(layer.getBounds());

          clearLayers(['desa', 'sls']);
          clearLabels(['kecamatan', 'desa', 'sls']);
          selectedDesaLayer = null;
          selectedSLSLayer = null;

          loadDesa(feature.properties.kdkec);
          currentLevel = 'desa';
          backBtn.hidden = false;
        });

        layer.on('mouseover', () => {
          layer.setStyle(hoverStyle);
        });

        layer.on('mouseout', () => {
          if (layer !== selectedKecLayer) layer.setStyle(defaultStyle);
        });
      }
    }).addTo(map);
  });

// ----------- Load Desa -----------
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
          const label = feature.properties.nmdesa;
          layer._label = L.tooltip({ permanent: true, direction: 'center', className: 'label' })
            .setContent(label)
            .setLatLng(layer.getBounds().getCenter());
          map.addLayer(layer._label);

          layer.on('click', (e) => {
            if (selectedDesaLayer) selectedDesaLayer.setStyle(defaultStyle);
            selectedDesaLayer = layer;
            layer.setStyle(highlightStyle);

            map.fitBounds(layer.getBounds());

            clearLayers(['sls']);
            clearLabels(['sls']);
            selectedSLSLayer = null;

            loadSLS(feature.properties.kddesa);
            currentLevel = 'sls';
            e.originalEvent.stopPropagation();
          });

          layer.on('mouseover', () => {
            layer.setStyle(hoverStyle);
          });

          layer.on('mouseout', () => {
            if (layer !== selectedDesaLayer) layer.setStyle(defaultStyle);
          });
        }
      }).addTo(map);
    });
}

// ----------- Load SLS -----------
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
          const label = feature.properties.nmsls;
          layer._label = L.tooltip({ permanent: true, direction: 'center', className: 'label' })
            .setContent(label)
            .setLatLng(layer.getBounds().getCenter());
          map.addLayer(layer._label);

          layer.on('click', (e) => {
            if (selectedSLSLayer) selectedSLSLayer.setStyle(defaultStyle);
            selectedSLSLayer = layer;
            layer.setStyle(highlightStyle);

            map.fitBounds(layer.getBounds());
            e.originalEvent.stopPropagation();
          });

          layer.on('mouseover', () => {
            layer.setStyle(hoverStyle);
          });

          layer.on('mouseout', () => {
            if (layer !== selectedSLSLayer) layer.setStyle(defaultStyle);
          });
        }
      }).addTo(map);
    });
}

// ----------- Clear Layers -----------
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

// ----------- Clear Labels -----------
function clearLabels(levels) {
  const layers = [kecLayer, desaLayer, slsLayer];
  for (let lyr of layers) {
    if (!lyr) continue;
    lyr.eachLayer(layer => {
      if (layer._label) {
        map.removeLayer(layer._label);
        layer._label = null;
      }
    });
  }
}

// ----------- Tombol Kembali -----------
function goBack() {
  if (currentLevel === 'sls') {
    clearLayers(['sls']);
    clearLabels(['sls']);
    selectedSLSLayer = null;
    currentLevel = 'desa';
  } else if (currentLevel === 'desa') {
    clearLayers(['desa', 'sls']);
    clearLabels(['desa', 'sls']);
    if (selectedKecLayer) {
      selectedKecLayer.setStyle(defaultStyle);
      selectedKecLayer = null;
    }
    currentLevel = 'kecamatan';
    backBtn.hidden = true;
  }
}
