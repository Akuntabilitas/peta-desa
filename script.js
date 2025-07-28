const map = L.map('map').setView([-7.5, 110.5], 10);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Style
const defaultStyle = { weight: 1, color: '#555', fillOpacity: 0.3 };
const highlightStyle = { weight: 3, color: '#ff7800', fillOpacity: 0.6 };
const hoverStyle = { weight: 2, color: '#000', fillOpacity: 0.4 };

let currentLevel = 'kecamatan';
let kecLayer, desaLayer, slsLayer;
let selectedKecFeature = null;
let selectedDesaFeature = null;
let selectedSLSFeature = null;

const backBtn = document.getElementById('backBtn');
const info = document.getElementById('info');

function setLevel(level) {
  currentLevel = level;
  document.body.className = `level-${level}`;
}

// Tambahkan efek hover ke semua layer
function attachHover(layer) {
  layer.on('mouseover', function () {
    layer.setStyle(hoverStyle);
  });
  layer.on('mouseout', function () {
    if (layer !== selectedKecFeature && layer !== selectedDesaFeature && layer !== selectedSLSFeature) {
      layer.setStyle(defaultStyle);
    }
  });
}

// Load Kecamatan
fetch('data/final_kec_202413309.geojson')
  .then(res => res.json())
  .then(data => {
    kecLayer = L.geoJSON(data, {
      style: defaultStyle,
      onEachFeature: (feature, layer) => {
        layer.bindTooltip(feature.properties.nmkec, {
          direction: 'center',
          className: 'label',
          permanent: true
        });

        layer.on('click', (e) => {
          selectedKecFeature = layer;
          map.fitBounds(layer.getBounds());

          clearLayers(['desa', 'sls']);
          kecLayer.eachLayer(l => l.unbindTooltip());
          layer.bindTooltip(feature.properties.nmkec, {
            permanent: true,
            direction: 'center',
            className: 'label'
          });

          loadDesa(feature.properties.kdkec);
          setLevel('desa');
          backBtn.hidden = false;
          info.innerText = `Kecamatan: ${feature.properties.nmkec}`;
          e.originalEvent.stopPropagation();
        });

        attachHover(layer);
      }
    }).addTo(map);

    setLevel('kecamatan');
  });

// Load Desa
function loadDesa(kdkec) {
  fetch('data/final_desa_202413309.geojson')
    .then(res => res.json())
    .then(data => {
      const filtered = {
        ...data,
        features: data.features.filter(f => f.properties.kdkec === kdkec)
      };

      if (filtered.features.length === 0) return alert('Tidak ada desa.');

      desaLayer = L.geoJSON(filtered, {
        style: defaultStyle,
        onEachFeature: (feature, layer) => {
          layer.on('click', (e) => {
            selectedDesaFeature = layer;
            map.fitBounds(layer.getBounds());

            clearLayers(['sls']);
            desaLayer.eachLayer(l => l.unbindTooltip());
            layer.bindTooltip(feature.properties.nmdesa, {
              permanent: true,
              direction: 'center',
              className: 'label'
            });

            loadSLS(feature.properties.kddesa);
            setLevel('sls');
            info.innerText = `Desa: ${feature.properties.nmdesa}`;
            e.originalEvent.stopPropagation();
          });

          attachHover(layer);
        }
      }).addTo(map);

      // Tampilkan label desa
      desaLayer.eachLayer(l => {
        l.bindTooltip(l.feature.properties.nmdesa, {
          permanent: true,
          direction: 'center',
          className: 'label'
        });
      });
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

      if (filtered.features.length === 0) return alert('Tidak ada SLS.');

      slsLayer = L.geoJSON(filtered, {
        style: defaultStyle,
        onEachFeature: (feature, layer) => {
          layer.on('click', (e) => {
            slsLayer.eachLayer(l => l.unbindTooltip());
            layer.bindTooltip(feature.properties.nmsls, {
              permanent: true,
              direction: 'center',
              className: 'label'
            });
            map.fitBounds(layer.getBounds());
            info.innerText = `SLS: ${feature.properties.nmsls}`;
            e.originalEvent.stopPropagation();
          });

          attachHover(layer);
        }
      }).addTo(map);

      // Tampilkan semua label sls
      slsLayer.eachLayer(l => {
        l.bindTooltip(l.feature.properties.nmsls, {
          permanent: true,
          direction: 'center',
          className: 'label'
        });
      });
    });
}

// Hapus layer sesuai level
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
    setLevel('desa');
    info.innerText = `Desa: ${selectedDesaFeature?.feature.properties.nmdesa}`;

    desaLayer.eachLayer(l => {
      l.bindTooltip(l.feature.properties.nmdesa, {
        permanent: true,
        direction: 'center',
        className: 'label'
      });
    });

  } else if (currentLevel === 'desa') {
    clearLayers(['desa', 'sls']);
    setLevel('kecamatan');
    backBtn.hidden = true;
    info.innerText = 'Klik wilayah untuk memperbesar';

    kecLayer.eachLayer(l => {
      l.bindTooltip(l.feature.properties.nmkec, {
        permanent: true,
        direction: 'center',
        className: 'label'
      });
    });
  }
}
