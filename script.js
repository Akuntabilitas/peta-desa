const map = L.map('map').setView([-7.5, 110.5], 10);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const defaultStyle = { weight: 1, color: '#555', fillOpacity: 0.3 };
const highlightStyle = { weight: 2, color: '#ff6600', fillOpacity: 0.6 };
const hoverStyle = { weight: 2, color: '#000', fillOpacity: 0.7 };

let currentLevel = 'kecamatan';
let currentCode = null;

let kecLayer, desaLayer, slsLayer;
const backBtn = document.getElementById('backBtn');
const legendList = document.getElementById('legend-list');

function setHoverTooltip(layer, name) {
  layer.on('mouseover', () => {
    layer.setStyle(hoverStyle);
    layer.bindTooltip(name, { permanent: false }).openTooltip();
  });
  layer.on('mouseout', () => {
    layer.setStyle(defaultStyle);
    layer.closeTooltip();
  });
}

function renderLegend(data, codeKey, nameKey, layerGroup) {
  legendList.innerHTML = '';
  data.sort((a, b) => a.properties[codeKey].localeCompare(b.properties[codeKey]));
  data.forEach(feature => {
    const li = document.createElement('li');
    li.textContent = `${feature.properties[codeKey]} ${feature.properties[nameKey]}`;
    li.onclick = () => {
      const targetLayer = layerGroup.getLayers().find(l =>
        l.feature.properties[codeKey] === feature.properties[codeKey]
      );
      if (targetLayer) {
        map.fitBounds(targetLayer.getBounds());
        targetLayer.setStyle(highlightStyle);
      }
    };
    legendList.appendChild(li);
  });
}

function loadKecamatan() {
  fetch('data/final_kec_202413309.geojson')
    .then(res => res.json())
    .then(data => {
      clearAllLayers();
      currentLevel = 'kecamatan';
      currentCode = null;
      backBtn.hidden = true;

      kecLayer = L.geoJSON(data, {
        style: defaultStyle,
        onEachFeature: (feature, layer) => {
          setHoverTooltip(layer, feature.properties.nmkec);
          layer.on('click', () => {
            currentLevel = 'desa';
            currentCode = feature.properties.kdkec;
            map.fitBounds(layer.getBounds());
            loadDesa(currentCode);
          });
        }
      }).addTo(map);

      renderLegend(data.features, 'kdkec', 'nmkec', kecLayer);
    });
}

function loadDesa(kdkec) {
  fetch('data/final_desa_202413309.geojson')
    .then(res => res.json())
    .then(data => {
      clearAllLayers(['desa', 'sls']);
      backBtn.hidden = false;

      const filtered = data.features.filter(f => f.properties.kdkec === kdkec);
      const featureCollection = { type: 'FeatureCollection', features: filtered };

      desaLayer = L.geoJSON(featureCollection, {
        style: defaultStyle,
        onEachFeature: (feature, layer) => {
          setHoverTooltip(layer, feature.properties.nmdesa);
          layer.on('click', (e) => {
            e.originalEvent.stopPropagation();
            currentLevel = 'sls';
            currentCode = feature.properties.kddesa;
            map.fitBounds(layer.getBounds());
            loadSLS(currentCode);
          });
        }
      }).addTo(map);

      renderLegend(filtered, 'kddesa', 'nmdesa', desaLayer);
    });
}

function loadSLS(kddesa) {
  fetch('data/final_sls_202413309.geojson')
    .then(res => res.json())
    .then(data => {
      clearAllLayers(['sls']);

      const filtered = data.features.filter(f => f.properties.kddesa === kddesa);
      const featureCollection = { type: 'FeatureCollection', features: filtered };

      slsLayer = L.geoJSON(featureCollection, {
        style: defaultStyle,
        onEachFeature: (feature, layer) => {
          setHoverTooltip(layer, feature.properties.nmsls);
          layer.on('click', (e) => {
            e.originalEvent.stopPropagation();
            map.fitBounds(layer.getBounds());
          });
        }
      }).addTo(map);

      renderLegend(filtered, 'kdsls', 'nmsls', slsLayer);
    });
}

function clearAllLayers(exclude = []) {
  if (!exclude.includes('kecamatan') && kecLayer) map.removeLayer(kecLayer);
  if (!exclude.includes('desa') && desaLayer) map.removeLayer(desaLayer);
  if (!exclude.includes('sls') && slsLayer) map.removeLayer(slsLayer);
}

backBtn.onclick = () => {
  if (currentLevel === 'sls') {
    loadDesa(currentCode.slice(0, 6)); // Asumsi kddesa = kdkec(6digit)+desa
    currentLevel = 'desa';
  } else if (currentLevel === 'desa') {
    loadKecamatan();
  }
};

// Mulai dari level kecamatan
loadKecamatan();
