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

const backBtn = document.getElementById('backBtn');

function updateLabelVisibility(level) {
  document.querySelectorAll('.label-kecamatan').forEach(e => e.style.display = (level === 'kecamatan') ? 'block' : 'none');
  document.querySelectorAll('.label-desa').forEach(e => e.style.display = (level === 'desa') ? 'block' : 'none');
  document.querySelectorAll('.label-sls').forEach(e => e.style.display = (level === 'sls') ? 'block' : 'none');
}

function addHoverEffect(layer) {
  layer.on('mouseover', function () {
    this.setStyle({ fillOpacity: 0.6 });
    const tooltip = this.getTooltip();
    if (tooltip && tooltip._container) {
      tooltip._container.classList.add('hovered');
    }
  });

  layer.on('mouseout', function () {
    this.setStyle({ fillOpacity: 0.3 });
    const tooltip = this.getTooltip();
    if (tooltip && tooltip._container) {
      tooltip._container.classList.remove('hovered');
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
        layer.bindTooltip(feature.properties.nmkec, {
          permanent: true,
          direction: 'center',
          className: 'label label-kecamatan'
        });

        layer.o
