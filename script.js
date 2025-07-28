const map = L.map('map').setView([-7.5, 110.5], 10);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let kecLayer, desaLayer, slsLayer;
let selectedKecLayer = null, selectedDesaLayer = null, selectedSLSLayer = null;
let currentLevel = 'kecamatan';

const defaultStyle = { weight: 1, color: '#555', fillOpacity: 0.3 };
const highlightStyle = { weight: 3, color: '#ff7800', fillOpacity: 0.7 };
const hoverStyle = { weight: 2, color: '#000', fillOpacity: 0.9 };

const backBtn = document.getElementById('backBtn');
const legend = document.getElementById('legend');

function updateLegend(items, onClick) {
  legend.innerHTML = '';
  items.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item.label;
    li.onclick = () => onClick(item.layer);
    legend.appendChild(li);
  });
}

// ----------- Kecamatan -----------

fetch('data/final_kec_202413309.geojson')
  .then(res => res.json())
  .then(data => {
    const items = [];

    kecLayer = L.geoJSON(data, {
      style: defaultStyle,
      onEachFeature: (feature, layer) => {
        layer.on('mouseover', () => layer.setStyle(hoverStyle));
        layer.on('mouseout', () => {
          if (layer !== selectedKecLayer) layer.setStyle(defaultStyle);
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

        items.push({ label: feature.properties.nmkec, layer });
      }
    }).addTo(map);

    updateLegend(items, (layer) => {
      map.fitBounds(layer.getBounds());
      layer.fire('click');
    });
  });

// ----------- Desa -----------

function loadDesa(kdkec) {
  fetch('data/final_desa_202413309.geojson')
    .then(res => res.json())
    .then(data => {
      const filtered = {
        ...data,
        features: data.features.filter(f => f.properties.kdkec === kdkec)
      };

      const items = [];

      desaLayer = L.geoJSON(filtered, {
        style: defaultStyle,
        onEachFeature: (feature, layer) => {
          layer.on('mouseover', () => layer.setStyle(hoverStyle));
          layer.on('mouseout', () => {
            if (layer !== selectedDesaLayer) layer.setStyle(defaultStyle);
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

          items.push({ label: feature.properties.nmdesa, layer });
        }
      }).addTo(map);

      updateLegend(items, (layer) => {
        map.fitBounds(layer.getBounds());
        layer.fire('click');
      });
    });
}

// ----------- SLS -----------

function loadSLS(kddesa) {
  fetch('data/final_sls_202413309.geojson')
    .then(res => res.json())
    .then(data => {
      const filtered = {
        ...data,
        features: data.features.filter(f => f.properties.kddesa === kddesa)
      };

      const items = [];

      slsLayer = L.geoJSON(filtered, {
        style: defaultStyle,
        onEachFeature: (feature, layer) => {
          layer.on('mouseover', () => layer.setStyle(hoverStyle));
          layer.on('mouseout', () => {
            if (layer !== selectedSLSLayer) layer.setStyle(defaultStyle);
          });

          layer.on('click', (e) => {
            if (selectedSLSLayer) selectedSLSLayer.setStyle(defaultStyle);
            selectedSLSLayer = layer;
            layer.setStyle(highlightStyle);
            map.fitBounds(layer.getBounds());
            e.originalEvent.stopPropagation();
          });

          items.push({ label: feature.properties.nmsls, layer });
        }
      }).addTo(map);

      updateLegend(items, (layer) => {
        map.fitBounds(layer.getBounds());
        layer.fire('click');
      });
    });
}

// ----------- Tombol Kembali -----------

function goBack() {
  if (currentLevel === 'sls') {
    clearLayers(['sls']);
    selectedSLSLayer = null;
    currentLevel = 'desa';
  } else if (currentLevel === 'desa') {
    clearLayers(['desa', 'sls']);
    selectedDesaLayer = null;
    selectedKecLayer.setStyle(defaultStyle);
    selectedKecLayer = null;
    currentLevel = 'kecamatan';
    backBtn.hidden = true;
  }
}

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
