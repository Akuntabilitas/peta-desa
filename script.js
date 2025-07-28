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

// ----------- Kecamatan ----------- //
fetch('data/final_kec_202413309.geojson')
  .then(res => res.json())
  .then(data => {
    kecLayer = L.geoJSON(data, {
      style: defaultStyle,
      onEachFeature: (feature, layer) => {
        const name = feature.properties.nmkec;
        layer.bindTooltip(name, { direction: 'center', permanent: false });

        layer.on('click', () => {
          if (selectedKecLayer) selectedKecLayer.setStyle(defaultStyle);
          selectedKecLayer = layer;
          layer.setStyle(highlightStyle);

          map.fitBounds(layer.getBounds());
          clearLayers(['desa', 'sls']);
          selectedDesaLayer = null;
          selectedSLSLayer = null;

          loadDesa(feature.properties.kdkec);
          currentLevel = 'desa';
          backBtn.hidden = false;
          updateLegend(desaLayer, 'nmdesa');
        });

        addHoverEffect(layer, () => selectedKecLayer);
      }
    }).addTo(map);
    updateLegend(kecLayer, 'nmkec');
  });

// ----------- Desa ----------- //
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
          const name = feature.properties.nmdesa;
          layer.bindTooltip(name, { direction: 'center', permanent: false });

          layer.on('click', (e) => {
            if (selectedDesaLayer) selectedDesaLayer.setStyle(defaultStyle);
            selectedDesaLayer = layer;
            layer.setStyle(highlightStyle);

            map.fitBounds(layer.getBounds());
            clearLayers(['sls']);
            selectedSLSLayer = null;

            loadSLS(feature.properties.kddesa);
            currentLevel = 'sls';
            e.originalEvent.stopPropagation();
          });

          addHoverEffect(layer, () => selectedDesaLayer);
        }
      }).addTo(map);
      updateLegend(desaLayer, 'nmdesa');
    });
}

// ----------- SLS ----------- //
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
          const name = feature.properties.nmsls;
          layer.bindTooltip(name, { direction: 'center', permanent: false });

          layer.on('click', (e) => {
            if (selectedSLSLayer) selectedSLSLayer.setStyle(defaultStyle);
            selectedSLSLayer = layer;
            layer.setStyle(highlightStyle);

            map.fitBounds(layer.getBounds());
            e.originalEvent.stopPropagation();
          });

          addHoverEffect(layer, () => selectedSLSLayer);
        }
      }).addTo(map);
      updateLegend(slsLayer, 'nmsls');
    });
}

// ----------- Util Functions ----------- //
function addHoverEffect(layer, getSelected) {
  layer.on('mouseover', () => layer.setStyle(hoverStyle));
  layer.on('mouseout', () => {
    if (layer !== getSelected()) layer.setStyle(defaultStyle);
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

function updateLegend(layerGroup, labelProp) {
  legend.innerHTML = '';
  if (!layerGroup) return;

  layerGroup.eachLayer(layer => {
    const name = layer.feature.properties[labelProp];
    const li = document.createElement('li');
    li.textContent = name;
    li.style.cursor = 'pointer';
    li.onclick = () => {
      map.fitBounds(layer.getBounds());
      layer.fire('click');
    };
    legend.appendChild(li);
  });
}

// ----------- Tombol Kembali ----------- //
function goBack() {
  if (currentLevel === 'sls') {
    clearLayers(['sls']);
    selectedSLSLayer = null;
    currentLevel = 'desa';
    updateLegend(desaLayer, 'nmdesa');
  } else if (currentLevel === 'desa') {
    clearLayers(['desa', 'sls']);
    if (selectedKecLayer) selectedKecLayer.setStyle(defaultStyle);
    selectedKecLayer = null;
    currentLevel = 'kecamatan';
    updateLegend(kecLayer, 'nmkec');
    backBtn.hidden = true;
  }
}
