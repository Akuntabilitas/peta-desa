const map = L.map('map').setView([-7.5, 110.5], 10); // Sesuaikan titik tengah kabupaten Anda

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Global layers
let kecLayer, desaLayer, slsLayer;
let selectedKecLayer = null;
let selectedDesaLayer = null;
let selectedSLSLayer = null;

// Style
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
          // Reset previous highlight
          if (selectedKecLayer) selectedKecLayer.setStyle(defaultStyle);
          selectedKecLayer = layer;
          layer.setStyle(highlightStyle);

          map.fitBounds(layer.getBounds());

          // Remove old layers
          if (desaLayer) map.removeLayer(desaLayer);
          if (slsLayer) map.removeLayer(slsLayer);
          selectedDesaLayer = null;
          selectedSLSLayer = null;

          loadDesa(feature.properties.kdkec);
        });
      }
    }).addTo(map);
  });

// Load DESA dalam kecamatan tertentu
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
          layer.bindTooltip(feature.properties.nmdesa);
          layer.on('click', (e) => {
            // Reset desa highlight
            if (selectedDesaLayer) selectedDesaLayer.setStyle(defaultStyle);
            selectedDesaLayer = layer;
            layer.setStyle(highlightStyle);

            map.fitBounds(layer.getBounds());

            // Remove old SLS
            if (slsLayer) map.removeLayer(slsLayer);
            selectedSLSLayer = null;

            loadSLS(feature.properties.kddesa);

            e.originalEvent.stopPropagation(); // Jangan trigger event di layer di bawahnya
          });
        }
      }).addTo(map);
    });
}

// Load SLS dalam desa tertentu
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
          layer.bindTooltip(feature.properties.nmsls);
          layer.on('click', (e) => {
            // Reset SLS highlight
            if (selectedSLSLayer) selectedSLSLayer.setStyle(defaultStyle);
            selectedSLSLayer = layer;
            layer.setStyle(highlightStyle);

            map.fitBounds(layer.getBounds());
            e.originalEvent.stopPropagation();
          });
        }
      }).addTo(map);
    });
}
