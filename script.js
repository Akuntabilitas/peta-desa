const map = L.map('map').setView([-7.5, 110.6], 10);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
}).addTo(map);

const defaultStyle = {
  color: '#555',
  weight: 1,
  fillOpacity: 0.2,
};

const highlightStyle = {
  color: '#007bff',
  weight: 2,
  fillOpacity: 0.5,
};

let currentLevel = 'kecamatan';
let selectedKecLayer = null;
let selectedDesaLayer = null;
let selectedSLSLayer = null;

let kecLayer, desaLayer, slsLayer;

let visibleKecLabel = false;
let visibleDesaLabel = false;
let visibleSLSLabel = false;

const backBtn = document.getElementById('backBtn');

// Fungsi Tambah Label ke Layer
function addLabels(layerGroup, namaField) {
  layerGroup.eachLayer(layer => {
    const nama = layer.feature.properties[namaField];
    const center = layer.getBounds().getCenter();
    const label = L.tooltip({
      permanent: true,
      direction: 'center',
      className: 'label',
      opacity: 0.8,
    })
      .setContent(nama)
      .setLatLng(center);
    layer.bindTooltip(label);
    layer._label = label;
  });
}

// Fungsi Clear Layer
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

// Fungsi Clear Label
function clearLabels(levels) {
  if (levels.includes('kecamatan') && kecLayer) {
    kecLayer.eachLayer(l => {
      if (l._label) map.removeLayer(l._label);
    });
    visibleKecLabel = false;
  }
  if (levels.includes('desa') && desaLayer) {
    desaLayer.eachLayer(l => {
      if (l._label) map.removeLayer(l._label);
    });
    visibleDesaLabel = false;
  }
  if (levels.includes('sls') && slsLayer) {
    slsLayer.eachLayer(l => {
      if (l._label) map.removeLayer(l._label);
    });
    visibleSLSLabel = false;
  }
}

// Load Kecamatan
fetch('kecamatan.geojson')
  .then(res => res.json())
  .then(data => {
    kecLayer = L.geoJson(data, {
      style: defaultStyle,
      onEachFeature: (feature, layer) => {
        addLabels(kecLayer = L.geoJson(data));
        layer.on('click', () => {
          if (selectedKecLayer && selectedKecLayer._label) {
            map.removeLayer(selectedKecLayer._label);
          }

          if (selectedKecLayer) selectedKecLayer.setStyle(defaultStyle);
          selectedKecLayer = layer;
          layer.setStyle(highlightStyle);

          clearLayers(['desa', 'sls']);
          clearLabels(['desa', 'sls', 'kecamatan']);

          if (layer._label) map.addLayer(layer._label);

          map.fitBounds(layer.getBounds());

          loadDesa(feature.properties.kdkec);
          currentLevel = 'desa';
          backBtn.hidden = false;
        });
        layer.on('mouseover', () => layer.setStyle(highlightStyle));
        layer.on('mouseout', () => {
          if (layer !== selectedKecLayer) layer.setStyle(defaultStyle);
        });
      },
    }).addTo(map);

    addLabels(kecLayer, 'nmkec');
    visibleKecLabel = true;
  });

// Load Desa
function loadDesa(kdkec) {
  fetch(`desa_${kdkec}.geojson`)
    .then(res => res.json())
    .then(data => {
      desaLayer = L.geoJson(data, {
        style: defaultStyle,
        onEachFeature: (feature, layer) => {
          const nama = feature.properties.nmdesa;
          const center = layer.getBounds().getCenter();
          const label = L.tooltip({
            permanent: true,
            direction: 'center',
            className: 'label',
            opacity: 0.8,
          })
