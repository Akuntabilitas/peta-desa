const map = L.map('map').setView([-7.5, 110.7], 10);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
}).addTo(map);

const backBtn = document.getElementById('backBtn');

let level = 'kecamatan';
let currentLayer = null;
let labelLayer = L.layerGroup().addTo(map);

const urls = {
  kecamatan: 'https://akuntabilitas.github.io/peta-desa/final_kec_202413309.geojson',
  desa: 'https://akuntabilitas.github.io/peta-desa/final_desa_202413309.geojson',
  sls: 'https://akuntabilitas.github.io/peta-desa/final_sls_202413309.geojson',
};

function clearMap() {
  if (currentLayer) map.removeLayer(currentLayer);
  labelLayer.clearLayers();
}

function goBack() {
  if (level === 'desa') {
    level = 'kecamatan';
    loadGeoJSON('kecamatan');
    backBtn.style.display = 'none';
  } else if (level === 'sls') {
    level = 'desa';
    loadGeoJSON('desa', lastKecCode);
  }
}

let lastKecCode = null;
let lastDesaCode = null;

function createLabel(feature, latlng, labelKey) {
  return L.marker(latlng, {
    icon: L.divIcon({
      className: 'label-tooltip',
      html: feature.properties[labelKey],
    })
  }).addTo(labelLayer);
}

function loadGeoJSON(levelToLoad, parentCode = null) {
  clearMap();
  fetch(urls[levelToLoad])
    .then(res => res.json())
    .then(data => {
      const filtered = {
        ...data,
        features: data.features.filter(f => {
          if (levelToLoad === 'desa') return f.properties.kdkec === parentCode;
          if (levelToLoad === 'sls') return f.properties.kddesa === parentCode;
          return true;
        })
      };

      currentLayer = L.geoJSON(filtered, {
        style: {
          color: '#3388ff',
          weight: 1,
          fillOpacity: 0.4
        },
        onEachFeature: (feature, layer) => {
          const props = feature.properties;
          layer.on('click', () => {
            if (levelToLoad === 'kecamatan') {
              level = 'desa';
              lastKecCode = props.kdkec;
              loadGeoJSON('desa', props.kdkec);
              backBtn.style.display = 'block';
            } else if (levelToLoad === 'desa') {
              level = 'sls';
              lastDesaCode = props.kddesa;
              loadGeoJSON('sls', props.kddesa);
            }
          });
        }
      }).addTo(map);

      map.fitBounds(currentLayer.getBounds());

      filtered.features.forEach(f => {
        const center = L.geoJSON(f).getBounds().getCenter();
        const labelKey = levelToLoad === 'kecamatan' ? 'nmkec'
                          : levelToLoad === 'desa' ? 'nmdesa'
                          : 'nmsls';
        createLabel(f, center, labelKey);
      });
    });
}

loadGeoJSON('kecamatan');
