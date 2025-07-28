const map = L.map('map').setView([-7.5, 110.5], 10); // Sesuaikan koordinat tengah kabupaten

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

let kecLayer, desaLayer, slsLayer;

const highlightStyle = { weight: 3, color: '#ff7800', fillOpacity: 0.5 };
const defaultStyle = { weight: 1, color: '#555', fillOpacity: 0.3 };

// Load KECAMATAN
fetch('data/final_kec_202413309.geojson')
  .then(res => res.json())
  .then(data => {
    kecLayer = L.geoJSON(data, {
      style: defaultStyle,
      onEachFeature: (feature, layer) => {
        layer.bindTooltip(feature.properties.nmkec);
        layer.on('click', () => {
          map.fitBounds(layer.getBounds());
          resetStyles(kecLayer);
          layer.setStyle(highlightStyle);
          if (desaLayer) map.removeLayer(desaLayer);
          if (slsLayer) map.removeLayer(slsLayer);
          loadDesa(feature.properties.kdkec);
        });
      }
    }).addTo(map);
  });

// Load DESA berdasarkan kdkec
function loadDesa(kdkec) {
  fetch('data/final_desa_202413309.geojson')
    .then(res => res.json())
    .then(data => {
      const filtered = {
        ...data,
        features: data.features.filter(f => f.properties.kdkec === kdkec)
      };
      desaLayer = L.geoJSON(filtered, {
        style: { color: '#0077be', weight: 1, fillOpacity: 0.4 },
        onEachFeature: (feature, layer) => {
          layer.bindTooltip(feature.properties.nmdesa);
          layer.on('click', (e) => {
            map.fitBounds(layer.getBounds());
            resetStyles(desaLayer);
            layer.setStyle(highlightStyle);
            if (slsLayer) map.removeLayer(slsLayer);
            loadSLS(feature.properties.kddesa);
            e.originalEvent.stopPropagation();
          });
        }
      }).addTo(map);
    });
}

// Load SLS berdasarkan kddesa
function loadSLS(kddesa) {
  fetch('data/final_sls_202413309.geojson')
    .then(res => res.json())
    .then(data => {
      const filtered = {
        ...data,
        features: data.features.filter(f => f.properties.kddesa === kddesa)
      };
      slsLayer = L.geoJSON(filtered, {
        style: { color: '#00aa55', weight: 1, fillOpacity: 0.3 },
        onEachFeature: (feature, layer) => {
          layer.bindTooltip(feature.properties.nmsls);
          layer.on('click', (e) => {
            resetStyles(slsLayer);
            layer.setStyle({ color: '#f00', weight: 2, fillOpacity: 0.5 });
            e.originalEvent.stopPropagation();
          });
        }
      }).addTo(map);
    });
}

// Fungsi bantu reset style
function resetStyles(layerGroup) {
  if (layerGroup) {
    layerGroup.eachLayer(layer => layer.setStyle(defaultStyle));
  }
}
