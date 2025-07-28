const map = L.map('map').setView([-7.5, 110.5], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let currentLevel = 'kecamatan';
let selectedKecamatan = null;
let selectedDesa = null;

let kecLayer, desaLayer, slsLayer;
const backBtn = document.getElementById('backBtn');
const legend = document.getElementById('legend');

// Styles
const defaultStyle = { weight: 1, color: '#555', fillOpacity: 0.3 };
const highlightStyle = { weight: 3, color: '#ff7800', fillOpacity: 0.7 };
const hoverStyle = { weight: 2, color: '#000', fillOpacity: 0.9 };

// Label hover
function bindHoverLabel(layer, labelText) {
  layer.bindTooltip(labelText, {
    permanent: false,
    direction: 'center',
    className: 'label'
  });
}

// ------------ KECAMATAN ------------
fetch('data/final_kec_202413309.geojson')
  .then(res => res.json())
  .then(data => {
    kecLayer = L.geoJSON(data, {
      style: defaultStyle,
      onEachFeature: (feature, layer) => {
        const { kdkec, nmkec } = feature.properties;
        bindHoverLabel(layer, `${kdkec} ${nmkec}`);

        layer.on('click', () => {
          selectedKecamatan = feature;
          map.fitBounds(layer.getBounds());
          if (desaLayer) map.removeLayer(desaLayer);
          if (slsLayer) map.removeLayer(slsLayer);
          if (kecLayer) kecLayer.eachLayer(l => l.setStyle(defaultStyle));
          layer.setStyle(highlightStyle);

          loadDesa(kdkec);
          updateLegendDesa(kdkec);
          currentLevel = 'desa';
          backBtn.hidden = false;
        });
      }
    }).addTo(map);

    updateLegendKecamatan(data.features);
  });

function updateLegendKecamatan(features) {
  legend.innerHTML = '';
  backBtn.hidden = true;

  const sorted = [...features].sort((a, b) => a.properties.kdkec.localeCompare(b.properties.kdkec));
  sorted.forEach(f => {
    const { kdkec, nmkec } = f.properties;
    const li = document.createElement('li');
    li.textContent = `${kdkec} ${nmkec}`;
    li.onclick = () => {
      const target = kecLayer.getLayers().find(l => l.feature.properties.kdkec === kdkec);
      target.fire('click');
    };
    legend.appendChild(li);
  });
}

// ------------ DESA ------------
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
          const { kddesa, nmdesa } = feature.properties;
          bindHoverLabel(layer, `${kddesa} ${nmdesa}`);

          layer.on('click', (e) => {
            selectedDesa = feature;
            map.fitBounds(layer.getBounds());
            if (slsLayer) map.removeLayer(slsLayer);
            if (desaLayer) desaLayer.eachLayer(l => l.setStyle(defaultStyle));
            layer.setStyle(highlightStyle);

            loadSLS(kddesa);
            updateLegendSLS(kddesa);
            currentLevel = 'sls';
            e.originalEvent.stopPropagation();
          });
        }
      }).addTo(map);
    });
}

function updateLegendDesa(kdkec) {
  fetch('data/final_desa_202413309.geojson')
    .then(res => res.json())
    .then(data => {
      const sorted = data.features
        .filter(f => f.properties.kdkec === kdkec)
        .sort((a, b) => a.properties.kddesa.localeCompare(b.properties.kddesa));

      legend.innerHTML = '';
      sorted.forEach(f => {
        const { kddesa, nmdesa } = f.properties;
        const li = document.createElement('li');
        li.textContent = `${kddesa} ${nmdesa}`;
        li.onclick = () => {
          const target = desaLayer.getLayers().find(l => l.feature.properties.kddesa === kddesa);
          target.fire('click');
        };
        legend.appendChild(li);
      });
    });
}

// ------------ SLS ------------
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
          const { kdsls, nmsls } = feature.properties;
          bindHoverLabel(layer, `${kdsls} ${nmsls}`);
        }
      }).addTo(map);
    });
}

function updateLegendSLS(kddesa) {
  fetch('data/final_sls_202413309.geojson')
    .then(res => res.json())
    .then(data => {
      const sorted = data.features
        .filter(f => f.properties.kddesa === kddesa)
        .sort((a, b) => a.properties.kdsls.localeCompare(b.properties.kdsls));

      legend.innerHTML = '';
      sorted.forEach(f => {
        const { kdsls, nmsls } = f.properties;
        const li = document.createElement('li');
        li.textContent = `${kdsls} ${nmsls}`;
        legend.appendChild(li); // Tidak ada event klik karena tidak perlu zoom lagi
      });
    });
}

// ------------ BACK FUNCTION ------------
backBtn.onclick = () => {
  if (currentLevel === 'sls') {
    map.removeLayer(slsLayer);
    slsLayer = null;
    currentLevel = 'desa';
    updateLegendDesa(selectedKecamatan.properties.kdkec);
    const layer = desaLayer.getLayers().find(l => l.feature.properties.kddesa === selectedDesa.properties.kddesa);
    if (layer) map.fitBounds(layer.getBounds());
  } else if (currentLevel === 'desa') {
    map.removeLayer(desaLayer);
    desaLayer = null;
    map.removeLayer(slsLayer);
    slsLayer = null;
    currentLevel = 'kecamatan';
    updateLegendKecamatan(kecLayer.toGeoJSON().features);
    const layer = kecLayer.getLayers().find(l => l.feature.properties.kdkec === selectedKecamatan.properties.kdkec);
    if (layer) map.fitBounds(layer.getBounds());
    backBtn.hidden = true;
  }
};
