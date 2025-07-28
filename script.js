const map = L.map('map').setView([-7.5, 110.5], 10); // sesuaikan dengan kabupaten Anda

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

// Layer groups
let kecLayer, desaLayer, slsLayer;

// Style
const highlightStyle = { weight: 3, color: '#ff7800', fillOpacity: 0.5 };
const defaultStyle = { weight: 1, color: '#555', fillOpacity: 0.3 };

// Load kecamatan
fetch('data/final_kec_202413309.geojson')
  .then(res => res.json())
  .then(data => {
    kecLayer = L.geoJSON(data, {
      style: defaultStyle,
      onEachFeature: (feature, layer) => {
        layer.on('click', () => {
          map.fitBounds(layer.getBounds());
          layer.setStyle(highlightStyle);

          // Clear previous layers
          if (desaLayer) map.removeLayer(desaLayer);
          if (slsLayer) map.removeLayer(slsLayer);

          // Show only desa in this kecamatan
          loadDesa(feature.properties.KODE_KEC);
        });
      }
    }).addTo(map);
  });

// Load desa berdasarkan kecamatan
function loadDesa(kodeKec) {
  fetch('data/final_desa_202413309.geojson')
    .then(res => res.json())
    .then(data => {
      const filtered = {
        ...data,
        features: data.features.filter(f => f.properties.KODE_KEC === kodeKec)
      };
      desaLayer = L.geoJSON(filtered, {
        style: { color: '#00a', weight: 1, fillOpacity: 0.4 },
        onEachFeature: (feature, layer) => {
          layer.on('click', (e) => {
            map.fitBounds(layer.getBounds());
            layer.setStyle(highlightStyle);
            if (slsLayer) map.removeLayer(slsLayer);
            loadSLS(feature.properties.KODE_DESA);
            e.originalEvent.stopPropagation(); // prevent bubbling
          });
        }
      }).addTo(map);
    });
}

// Load SLS berdasarkan desa
function loadSLS(kodeDesa) {
  fetch('data/final_sls_202413309.geojson')
    .then(res => res.json())
    .then(data => {
      const filtered = {
        ...data,
        features: data.features.filter(f => f.properties.KODE_DESA === kodeDesa)
      };
      slsLayer = L.geoJSON(filtered, {
        style: { color: '#0a0', weight: 1, fillOpacity: 0.3 },
        onEachFeature: (feature, layer) => {
          layer.on('click', (e) => {
            layer.setStyle({ color: '#f00', weight: 2, fillOpacity: 0.5 });
            e.originalEvent.stopPropagation();
          });
        }
      }).addTo(map);
    });
}
