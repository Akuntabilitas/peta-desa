const map = L.map('map').setView([-7.5, 110.5], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

let currentLevel = 'kecamatan';
let currentKecCode = null;
let currentDesaCode = null;

let kecLayer, desaLayer, slsLayer;
const legend = document.getElementById('legend');
const backBtn = document.getElementById('backBtn');

const defaultStyle = { weight: 1, color: '#555', fillOpacity: 0.3 };
const highlightStyle = { weight: 2, color: '#007bff', fillOpacity: 0.6 };
const hoverStyle = { weight: 2, color: '#000', fillOpacity: 0.7 };

function resetMap() {
  if (desaLayer) { map.removeLayer(desaLayer); desaLayer = null; }
  if (slsLayer) { map.removeLayer(slsLayer); slsLayer = null; }
}

function resetLegend() {
  legend.innerHTML = '';
}

function loadKecamatan() {
  fetch('data/final_kec_202413309.geojson')
    .then(res => res.json())
    .then(data => {
      resetLegend();
      kecLayer = L.geoJSON(data, {
        style: defaultStyle,
        onEachFeature: (feature, layer) => {
          const kode = feature.properties.kdkec;
          const nama = feature.properties.nmkec;
          const label = `${kode} ${nama}`;

          layer.on('click', () => {
            currentKecCode = kode;
            map.fitBounds(layer.getBounds());
            resetMap();
            loadDesa(kode);
            currentLevel = 'desa';
            backBtn.hidden = false;
          });

          layer.on('mouseover', () => {
            layer.setStyle(hoverStyle);
            layer.bindTooltip(nama, {sticky: true}).openTooltip();
          });
          layer.on('mouseout', () => {
            layer.setStyle(defaultStyle);
            layer.closeTooltip();
          });

          // Tambahkan ke legenda SETELAH layer ditambahkan ke map
          const li = document.createElement('li');
          li.textContent = label;
          li.onclick = () => map.fitBounds(layer.getBounds());
          li.onmouseover = () => layer.setStyle(highlightStyle);
          li.onmouseout = () => layer.setStyle(defaultStyle);
          legend.appendChild(li);
        }
      }).addTo(map);
    });
}


function loadDesa(kdkec) {
  fetch('data/final_desa_202413309.geojson')
    .then(res => res.json())
    .then(data => {
      resetLegend();
      const filtered = data.features.filter(f => f.properties.kdkec === kdkec);
      const sorted = filtered.sort((a, b) => a.properties.kddesa.localeCompare(b.properties.kddesa));

      desaLayer = L.geoJSON({type: 'FeatureCollection', features: sorted}, {
        style: defaultStyle,
        onEachFeature: (feature, layer) => {
          const kode = feature.properties.kddesa;
          const nama = feature.properties.nmdesa;
          const label = `${kode} ${nama}`;

          layer.on('click', () => {
            currentDesaCode = kode;
            map.fitBounds(layer.getBounds());
            resetMap();
            loadSLS(kode);
            currentLevel = 'sls';
          });

          layer.on('mouseover', () => {
            layer.setStyle(hoverStyle);
            layer.bindTooltip(nama, {sticky: true}).openTooltip();
          });
          layer.on('mouseout', () => {
            layer.setStyle(defaultStyle);
            layer.closeTooltip();
          });

          const li = document.createElement('li');
          li.textContent = label;
          li.onclick = () => map.fitBounds(layer.getBounds());
          li.onmouseover = () => layer.setStyle(highlightStyle);
          li.onmouseout = () => layer.setStyle(defaultStyle);
          legend.appendChild(li);
        }
      }).addTo(map);
    });
}

function loadSLS(kddesa) {
  fetch('data/final_sls_202413309.geojson')
    .then(res => res.json())
    .then(data => {
      const filtered = data.features.filter(f => f.properties.kddesa === kddesa);
      const sorted = filtered.sort((a, b) => a.properties.kdsls.localeCompare(b.properties.kdsls));

      slsLayer = L.geoJSON({type: 'FeatureCollection', features: sorted}, {
        style: defaultStyle,
        onEachFeature: (feature, layer) => {
          const kode = feature.properties.kdsls;
          const nama = feature.properties.nmsls;
          const label = `${kode} ${nama}`;

          layer.on('click', () => {
            map.fitBounds(layer.getBounds());
          });

          layer.on('mouseover', () => {
            layer.setStyle(hoverStyle);
            layer.bindTooltip(nama, {sticky: true}).openTooltip();
          });
          layer.on('mouseout', () => {
            layer.setStyle(defaultStyle);
            layer.closeTooltip();
          });

          const li = document.createElement('li');
          li.textContent = label;
          li.onclick = () => {
            map.fitBounds(layer.getBounds());
          };
          legend.appendChild(li);
        }
      }).addTo(map);
    });
}

backBtn.onclick = () => {
  if (currentLevel === 'sls') {
    resetMap();
    resetLegend();
    loadDesa(currentKecCode);
    currentLevel = 'desa';
  } else if (currentLevel === 'desa') {
    resetMap();
    resetLegend();
    map.fitBounds(kecLayer.getBounds());
    loadKecamatan();
    currentLevel = 'kecamatan';
    backBtn.hidden = true;
  }
};

loadKecamatan();
