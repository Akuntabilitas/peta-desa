const map = L.map('map').setView([-7.5, 110.5], 10);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Global Layers & State
let kecLayer, desaLayer, slsLayer;
let selectedKecLayer = null;
let selectedDesaLayer = null;
let selectedSLSLayer = null;

let currentLevel = 'kecamatan';

const defaultStyle = { weight: 1, color: '#555', fillOpacity: 0.3 };
const highlightStyle = { weight: 3, color: '#ff7800', fillOpacity: 0.5 };

const backBtn = document.getElementById('backBtn');

// Toggle label visibility
function updateLabelVisibility(level) {
  document.querySelectorAll('.label-kecamatan').forEach(e => e.style.display = (level === 'kecamatan') ? 'block' : 'none');
  document.querySelectorAll('.label-desa').forEach(e => e.style.display = (level === 'desa') ? 'block' : 'none');
  document.querySelectorAll('.label-sls').forEach(e => e.style.display = (level === 'sls') ? 'block' : 'none');
}

// Efek hover
function addHoverEffect(layer) {
  layer.on('mouseover', function () {
    this.setStyle({ fillOpacity: 0.7 });
    const tooltip = this.getTooltip();
    if (tooltip && tooltip._container) {
      tooltip._container.classList.add('hovered-label');
    }
  });

  layer.on('mouseout', function () {
    this.setStyle({ fillOpacity: 0.3 });
    const tooltip = this.getTooltip();
    if (tooltip && tooltip._container) {
      tooltip._container.classList.remove('hovered-label');
    }
  });
}

// Load KECAMATAN
fetch('data/final_kec_202413309.geojson')
  .then(res => res.json())
  .then(data => {
    kecLayer = L.geoJSON(data, {
      style: defaultStyle,
      onEachFeature: (feature, layer) => {
        const label = feature.properties.nmkec;
        layer.bindTooltip(label, {
          permanent: true,
          direction: 'center',
          className: 'label label-kecamatan'
        });

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
          updateLabelVisibility(currentLevel);
        });

        addHoverEffect(layer);
      }
    }).addTo(map);

    updateLabelVisibility(currentLevel);
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
          layer.bindTooltip(feature.properties.nmdesa, {
            permanent: true,
            direction: 'center',
            className: 'label label-desa'
          });

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
            updateLabelVisibility(currentLevel);
          });

          addHoverEffect(layer);
        }
      }).addTo(map);

      updateLabelVisibility(currentLevel);
    });
}

// Load SLS
function loadSLS(kddesa) {
  fetch('data/final_sls_20
