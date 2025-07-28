const map = L.map('map').setView([-7.5, 110.5], 10); // Sesuaikan pusat kabupaten

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Global Layers & State
let kecLayer, desaLayer, slsLayer;
let selectedKecLayer = null;
let selectedDesaLayer = null;
let selectedSLSLayer = null;

let currentLevel = 'kecamatan'; // ['kecamatan', 'desa', 'sls']

const defaultStyle = { weight: 1, color: '#555', fillOpacity: 0.3 };
const highlightStyle = { weight: 3, color: '#ff7800', fillOpacity: 0.5 };

// UI
const backBtn = document.getElementById('backBtn');
const info = document.getElementById('info');

// Load KECAMATAN
fetch('data/final_kec_202413309.geojson')
  .then(res => res.json())
  .then(data => {
    kecLayer = L.geoJSON(data, {
      style: defaultStyle,
      onEachFeature: (feature, layer) => {
        const label = feature.properties.nmkec;
        // Label hanya permanen di level 'kecamatan'
        layer.bindTooltip(label, { permanent: (currentLevel === 'kecamatan'), direction: 'center', className: 'label' });

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

          // Perbarui semua tooltip kecamatan agar tidak permanen saat beralih level
          kecLayer.eachLayer(l => {
            if (l.getTooltip()) {
              l.unbindTooltip(); // Lepas tooltip lama
              l.bindTooltip(l.feature.properties.nmkec, { permanent: false, direction: 'center', className: 'label' }); // Bind ulang tanpa permanen
            }
          });
        });
      }
    }).addTo(map);
  });

// Load DESA
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
          // Label hanya permanen di level 'desa'
          layer.bindTooltip(feature.properties.nmdesa, { permanent: (currentLevel === 'desa'), direction: 'center', className: 'label' });

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

            // Perbarui semua tooltip desa agar tidak permanen saat beralih level
            desaLayer.eachLayer(l => {
              if (l.getTooltip()) {
                l.unbindTooltip();
                l.bindTooltip(l.feature.properties.nmdesa, { permanent: false, direction: 'center', className: 'label' });
              }
            });
          });
        }
      }).addTo(map);
    });
}

// Load SLS
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
          // Label hanya permanen di level 'sls'
          layer.bindTooltip(feature.properties.nmsls, { permanent: (currentLevel === 'sls'), direction: 'center', className: 'label' });

          layer.on('click', (e) => {
            if (selectedSLSLayer) selectedSLSLayer.setStyle(defaultStyle);
            selectedSLSLayer = layer;
            layer.setStyle(highlightStyle);

            map.fitBounds(layer.getBounds());
            e.originalEvent.stopPropagation();
            // Di level SLS, tidak ada transisi ke level selanjutnya, jadi tidak perlu memperbarui tooltip di sini.
          });
        }
      }).addTo(map);
    });
}

// Clear layer by level
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

// Tombol kembali
function goBack() {
  if (currentLevel === 'sls') {
    clearLayers(['sls']);
    selectedSLSLayer = null;
    currentLevel = 'desa';

    // Saat kembali ke desa, pastikan label desa aktif kembali
    if (desaLayer) {
      desaLayer.eachLayer(l => {
        if (l.getTooltip()) {
          l.unbindTooltip();
          l.bindTooltip(l.feature.properties.nmdesa, { permanent: true, direction: 'center', className: 'label' });
        }
      });
    }

  } else if (currentLevel === 'desa') {
    clearLayers(['desa', 'sls']);
    selectedDesaLayer = null;
    if (selectedKecLayer) selectedKecLayer.setStyle(defaultStyle); // Reset style kecamatan yang sebelumnya dipilih
    selectedKecLayer = null; // Hapus referensi ke kecamatan yang dipilih
    currentLevel = 'kecamatan';
    backBtn.hidden = true;

    // Saat kembali ke kecamatan, pastikan label kecamatan aktif kembali
    if (kecLayer) {
      kecLayer.eachLayer(l => {
        if (l.getTooltip()) {
          l.unbindTooltip();
          l.bindTooltip(l.feature.properties.nmkec, { permanent: true, direction: 'center', className: 'label' });
        }
      });
    }
  }
}
