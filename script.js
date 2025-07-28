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

// Kecamatan
fetch('data/final_kec_202413309.geojson')
  .then(res => res.json())
  .then(data => {
    kecLayer = L.geoJSON(data, {
      style: defaultStyle,
      onEachFeature: (feature, layer) => {
        const label = feature.properties.nmkec;
        const kode = feature.properties.kdkec;

        layer.on('click', () => {
          if (selectedKecLayer) selectedKecLayer.setStyle(defaultStyle);
          selectedKecLayer = layer;
          layer.setStyle(highlightStyle);
          map.fitBounds(layer.getBounds());

          clearLayers(['desa', 'sls']);
          selectedDesaLayer = null;
          selectedSLSLayer = null;

          loadDesa(kode);
          currentLevel = 'desa';
          backBtn.hidden = false;
        });

        addHoverEffect(layer);
        layer.feature.properties._bounds = layer.getBounds(); // simpan bounds
      }
    }).addTo(map);

    updateLegend(data.features, 'nmkec', 'kdkec', (kode) => {
      const feature = data.features.find(f => f.properties.kdkec === kode);
      if (feature) {
        const layer = kecLayer.getLayers().find(l => l.feature.properties.kdkec === kode);
        if (layer) {
          layer.fire('click');
        }
      }
    });
  });

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
          const kode = feature.properties.kddesa;

          layer.on('click', (e) => {
            if (selectedDesaLayer) selectedDesaLayer.setStyle(defaultStyle);
            selectedDesaLayer = layer;
            layer.setStyle(highlightStyle);

            map.fitBounds(layer.getBounds());

            clearLayers(['sls']);
            selectedSLSLayer = null;

            loadSLS(kode);
            currentLevel = 'sls';
            e.originalEvent.stopPropagation();
          });

          addHoverEffect(layer);
          layer.feature.properties._bounds = layer.getBounds();
        }
      }).addTo(map);

      updateLegend(filtered.features, 'nmdesa', 'kddesa', (kode) => {
        const feature = filtered.features.find(f => f.properties.kddesa === kode);
        if (feature) {
          const layer = desaLayer.getLayers().find(l => l.feature.properties.kddesa === kode);
          if (layer) layer.fire('click');
        }
      });
    });
}

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
          const kode = feature.properties.kdsls;

          layer.on('click', (e) => {
            if (selectedSLSLayer) selectedSLSLayer.setStyle(defaultStyle);
            selectedSLSLayer = layer;
            layer.setStyle(highlightStyle);

            map.fitBounds(layer.getBounds());
            e.originalEvent.stopPropagation();
          });

          addHoverEffect(layer);
          layer.feature.properties._bounds = layer.getBounds();
        }
      }).addTo(map);

      updateLegend(filtered.features, 'nmsls', 'kdsls', (kode) => {
        const feature = filtered.features.find(f => f.properties.kdsls === kode);
        if (feature) {
          const layer = slsLayer.getLayers().find(l => l.feature.properties.kdsls === kode);
          if (layer) layer.fire('click');
        }
      });
    });
}

// Util
function addHoverEffect(layer) {
  layer.on('mouseover', () => layer.setStyle(hoverStyle));
  layer.on('mouseout', () => {
    const selected = (layer === selectedKecLayer || layer === selectedDesaLayer || layer === selectedSLSLayer);
    if (!selected) layer.setStyle(defaultStyle);
  });
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

function updateLegend(features, nameKey, codeKey, onClick) {
  legend.innerHTML = '';
  const sorted = [...features].sort((a, b) => a.properties[codeKey].localeCompare(b.properties[codeKey]));
  sorted.forEach(f => {
    const li = document.createElement('li');
    li.textContent = `${f.properties[codeKey]} ${f.properties[nameKey]}`;
    li.onclick = () => onClick(f.properties[codeKey]);
    legend.appendChild(li);
  });
}

// Tombol kembali
function goBack() {
  if (currentLevel === 'sls') {
    clearLayers(['sls']);
    selectedSLSLayer = null;
    currentLevel = 'desa';
    if (selectedDesaLayer) map.fitBounds(selectedDesaLayer.feature.properties._bounds);
  } else if (currentLevel === 'desa') {
    clearLayers(['desa', 'sls']);
    selectedDesaLayer = null;
    selectedKecLayer = null;
    currentLevel = 'kecamatan';
    backBtn.hidden = true;
    map.fitBounds(kecLayer.getBounds());
  }
}
