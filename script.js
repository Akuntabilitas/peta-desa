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

// untuk menampung label-label aktif
let labelLayerGroup = L.layerGroup().addTo(map);

// UI
const backBtn = document.getElementById('backBtn');

// -- FUNGSI: Tambah label di tengah polygon
function addLabelToPolygon(feature, text, className) {
  const center = L.geoJSON(feature).getBounds().getCenter();
  const label = L.marker(center, {
    icon: L.divIcon({
      className: `label-icon ${className}`,
      html: text,
      iconSize: null
    }),
    interactive: false
  });
  labelLayerGroup.addLayer(label);
}

// -- FUNGSI: Hapus semua label
function clearLabels() {
  labelLayerGroup.clearLayers();
}

// -- KECAMATAN
fetch('data/final_kec_202413309.geojson')
  .then(res => res.json())
  .then(data => {
    kecLayer = L.geoJSON(data, {
      style: defaultStyle,
      onEachFeature: (feature, layer) => {
        layer.on('click', () => {
          if (selectedKecLayer) selectedKecLayer.setStyle(defaultStyle);
          selectedKecLayer = layer;
          layer.setStyle(highlightStyle);

          map.fitBounds(layer.getBounds());
          clearLayers(['desa', 'sls']);
          clearLabels();
          selectedDesaLayer = null;
          selectedSLSLayer = null;

          currentLevel = 'desa';
          backBtn.hidden = false;

          loadDesa(feature.properties.kdkec);
        });
      }
    }).addTo(map);

    clearLabels();
    data.features.forEach(f =>
      addLabelToPolygon(f, f.properties.nmkec, 'label-kec')
    );
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
          layer.on('click', (e) => {
            if (selectedDesaLayer) selectedDesaLayer.setStyle(defaultStyle);
            selectedDesaLayer = layer;
            layer.setStyle(highlightStyle);

            map.fitBounds(layer.getBounds());

            clearLayers(['sls']);
            clearLabels();
            selectedSLSLayer = null;

            currentLevel = 'sls';
            loadSLS(feature.properties.kddesa);

            e.originalEvent.stopPropagation();
          });
        }
      }).addTo(map);

      clearLabels();
      filtered.features.forEach(f =>
        addLabelToPolygon(f, f.properties.nmdesa, 'label-desa')
      );
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
          layer.on('click', (e) => {
            if (selectedSLSLayer) selectedSLSLayer.setStyle(defaultStyle);
            selectedSLSLayer = layer;
            layer.setStyle(highlightStyle);

            map.fitBounds(layer.getBounds());
            e.originalEvent.stopPropagation();
          });
        }
      }).addTo(map);

      clearLabels();
      filtered.features.forEach(f =>
        addLabelToPolygon(f, f.properties.nmsls, 'label-sls')
      );
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
    clearLabels();
    selectedSLSLayer = null;
    currentLevel = 'desa';

    // tampilkan ulang label desa
    desaLayer.eachLayer(l =>
      addLabelToPolygon(l.feature, l.feature.properties.nmdesa, 'label-desa')
    );
  } else if (currentLevel === 'desa') {
    clearLayers(['desa', 'sls']);
    clearLabels();
    if (selectedKecLayer) {
      selectedKecLayer.setStyle(defaultStyle);
      selectedKecLayer = null;
    }
    selectedDesaLayer = null;
    selectedSLSLayer = null;
    currentLevel = 'kecamatan';
    backBtn.hidden = true;

    // tampilkan ulang label kecamatan
    kecLayer.eachLayer(l =>
      addLabelToPolygon(l.feature, l.feature.properties.nmkec, 'label-kec')
    );
  }
}
