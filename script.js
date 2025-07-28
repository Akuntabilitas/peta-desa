// script.js

const map = L.map('map').setView([-7.5, 110.6], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const layerGroups = {
  kecamatan: L.geoJSON(null, {
    style: { color: '#333', weight: 1, fillColor: '#8ecae6', fillOpacity: 0.6 },
    onEachFeature: onEachKecamatan
  }),
  desa: L.geoJSON(null, {
    style: { color: '#333', weight: 1, fillColor: '#219ebc', fillOpacity: 0.6 },
    onEachFeature: onEachDesa
  }),
  sls: L.geoJSON(null, {
    style: { color: '#333', weight: 1, fillColor: '#023047', fillOpacity: 0.6 },
    onEachFeature: onEachSLS
  })
};

let currentLevel = 'kecamatan';
let selectedKec = null;
let selectedDesa = null;
const legendList = document.getElementById('legend-list');

function resetMap() {
  Object.values(layerGroups).forEach(layer => layer.clearLayers());
  legendList.innerHTML = '';
}

function setLegend(items, clickHandler) {
  legendList.innerHTML = '';
  items.sort((a, b) => a.code.localeCompare(b.code)).forEach(item => {
    const li = document.createElement('li');
    li.textContent = `${item.code} ${item.name}`;
    li.dataset.code = item.code;
    li.classList.add('legend-item');
    li.addEventListener('click', () => clickHandler(item.code));
    li.addEventListener('mouseover', () => highlightPolygon(item.code));
    li.addEventListener('mouseout', () => resetHighlight());
    legendList.appendChild(li);
  });
}

function highlightPolygon(code) {
  map.eachLayer(layer => {
    if (layer.feature && layer.feature.properties) {
      const props = layer.feature.properties;
      const layerCode = props.kdkec || props.kddesa || props.kdsls;
      if (layerCode === code) {
        layer.setStyle({ fillOpacity: 1, weight: 3 });
      }
    }
  });
}

function resetHighlight() {
  Object.entries(layerGroups).forEach(([key, layerGroup]) => {
    layerGroup.eachLayer(layer => {
      layer.setStyle({ fillOpacity: 0.6, weight: 1 });
    });
  });
}

function onEachKecamatan(feature, layer) {
  const { kdkec, nmkec } = feature.properties;
  layer.bindTooltip(nmkec);
  layer.on({
    click: () => loadDesa(kdkec),
    mouseover: () => highlightPolygon(kdkec),
    mouseout: () => resetHighlight()
  });
}

function onEachDesa(feature, layer) {
  const { kddesa, nmdesa } = feature.properties;
  layer.bindTooltip(nmdesa);
  layer.on({
    click: () => loadSLS(kddesa),
    mouseover: () => highlightPolygon(kddesa),
    mouseout: () => resetHighlight()
  });
}

function onEachSLS(feature, layer) {
  const { kdsls, nmsls } = feature.properties;
  layer.bindTooltip(nmsls);
  layer.on({
    click: () => zoomToLayer(layer),
    mouseover: () => highlightPolygon(kdsls),
    mouseout: () => resetHighlight()
  });
}

function zoomToLayer(layer) {
  map.fitBounds(layer.getBounds());
}

function loadKecamatan() {
  resetMap();
  currentLevel = 'kecamatan';
  selectedKec = null;
  selectedDesa = null;
  fetch('data/final_kec_202413309.geojson')
    .then(res => res.json())
    .then(data => {
      layerGroups.kecamatan.addData(data).addTo(map);
      map.fitBounds(layerGroups.kecamatan.getBounds());
      const items = data.features.map(f => ({
        code: f.properties.kdkec,
        name: f.properties.nmkec
      }));
      setLegend(items, loadDesa);
    });
}

function loadDesa(kdkec) {
  resetMap();
  currentLevel = 'desa';
  selectedKec = kdkec;
  fetch('data/final_desa_202413309.geojson')
    .then(res => res.json())
    .then(data => {
      const filtered = {
        type: 'FeatureCollection',
        features: data.features.filter(f => f.properties.kdkec === kdkec)
      };
      layerGroups.desa.addData(filtered).addTo(map);
      map.fitBounds(layerGroups.desa.getBounds());
      const items = filtered.features.map(f => ({
        code: f.properties.kddesa,
        name: f.properties.nmdesa
      }));
      setLegend(items, loadSLS);
    });
}

function loadSLS(kddesa) {
  resetMap();
  currentLevel = 'sls';
  selectedDesa = kddesa;
  fetch('data/final_sls_202413309.geojson')
    .then(res => res.json())
    .then(data => {
      const filtered = {
        type: 'FeatureCollection',
        features: data.features.filter(f => f.properties.kddesa === kddesa)
      };
      layerGroups.sls.addData(filtered).addTo(map);
      map.fitBounds(layerGroups.sls.getBounds());
      const items = filtered.features.map(f => ({
        code: f.properties.kdsls,
        name: f.properties.nmsls
      }));
      setLegend(items, code => {
        const layer = layerGroups.sls.getLayers().find(l => l.feature.properties.kdsls === code);
        if (layer) zoomToLayer(layer);
      });
    });
}

document.getElementById('back-btn').addEventListener('click', () => {
  if (currentLevel === 'sls') {
    loadDesa(selectedKec);
  } else if (currentLevel === 'desa') {
    loadKecamatan();
  }
});

loadKecamatan();
