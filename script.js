// ======================
// Hierarchical Interactive Map
// ======================

let map = L.map('map').setView([-7.5, 110.7], 10);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
}).addTo(map);

let currentLevel = 'kecamatan';
let currentKec = null;
let currentDesa = null;

let geojsonLayers = {
    kecamatan: null,
    desa: null,
    sls: null
};

let dataGeojson = {
    kecamatan: null,
    desa: null,
    sls: null
};

let legendDiv = document.getElementById('legend');
let backButton = document.getElementById('backButton');

fetch('geojson/kecamatan.geojson')
    .then(res => res.json())
    .then(data => {
        dataGeojson.kecamatan = data;
        loadKecamatan();
    });

fetch('geojson/desa.geojson')
    .then(res => res.json())
    .then(data => dataGeojson.desa = data);

fetch('geojson/sls.geojson')
    .then(res => res.json())
    .then(data => dataGeojson.sls = data);

function resetLayers(level) {
    for (let key in geojsonLayers) {
        if (geojsonLayers[key]) {
            map.removeLayer(geojsonLayers[key]);
            geojsonLayers[key] = null;
        }
    }
    legendDiv.innerHTML = '';
    backButton.style.display = (level === 'kecamatan') ? 'none' : 'block';
}

function styleBase() {
    return {
        color: '#333',
        weight: 1,
        fillOpacity: 0.5,
        fillColor: '#cccccc'
    };
}

function highlightFeature(e) {
    const layer = e.target;
    layer.setStyle({
        fillOpacity: 0.8,
        fillColor: '#87CEFA'
    });

    if (!layer._popup) {
        const props = layer.feature.properties;
        const name = props.nmkec || props.nmdesa || props.nmsls;
        layer.bindTooltip(name, { sticky: true }).openTooltip();
    }
}

function resetHighlight(e) {
    geojsonLayers[currentLevel].resetStyle(e.target);
    e.target.closeTooltip();
}

function zoomToFeature(e, nextLevel) {
    const layer = e.target;
    const bounds = layer.getBounds();
    map.fitBounds(bounds);

    if (nextLevel === 'desa') {
        currentLevel = 'desa';
        currentKec = layer.feature.properties.kdkec;
        loadDesa(currentKec);
    } else if (nextLevel === 'sls') {
        currentLevel = 'sls';
        currentDesa = layer.feature.properties.kddesa;
        loadSLS(currentKec, currentDesa);
    }
}

function addLegend(features, labelProp, kodeProp, onClick) {
    const sorted = features.sort((a, b) => a.properties[kodeProp].localeCompare(b.properties[kodeProp]));
    sorted.forEach(f => {
        const kode = f.properties[kodeProp];
        const nama = f.properties[labelProp];
        const div = document.createElement('div');
        div.className = 'legend-item';
        div.textContent = `${kode} ${nama}`;
        div.addEventListener('click', () => onClick(f));
        div.addEventListener('mouseenter', () => highlightFeature({ target: geojsonLayers[currentLevel]._layers[f.id] }));
        div.addEventListener('mouseleave', () => resetHighlight({ target: geojsonLayers[currentLevel]._layers[f.id] }));
        legendDiv.appendChild(div);
    });
}

function loadKecamatan() {
    resetLayers('kecamatan');
    geojsonLayers.kecamatan = L.geoJSON(dataGeojson.kecamatan, {
        style: styleBase,
        onEachFeature: (feature, layer) => {
            layer.on({
                mouseover: highlightFeature,
                mouseout: resetHighlight,
                click: (e) => zoomToFeature(e, 'desa')
            });
        }
    }).addTo(map);

    addLegend(dataGeojson.kecamatan.features, 'nmkec', 'kdkec', feature => {
        const layer = geojsonLayers.kecamatan.getLayers().find(l => l.feature === feature);
        if (layer) layer.fire('click');
    });
}

function loadDesa(kdkec) {
    resetLayers('desa');
    const filtered = dataGeojson.desa.features.filter(f => f.properties.kdkec === kdkec);
    geojsonLayers.desa = L.geoJSON(filtered, {
        style: styleBase,
        onEachFeature: (feature, layer) => {
            layer.on({
                mouseover: highlightFeature,
                mouseout: resetHighlight,
                click: (e) => zoomToFeature(e, 'sls')
            });
        }
    }).addTo(map);

    addLegend(filtered, 'nmdesa', 'kddesa', feature => {
        const layer = geojsonLayers.desa.getLayers().find(l => l.feature === feature);
        if (layer) layer.fire('click');
    });
}

function loadSLS(kdkec, kddesa) {
    resetLayers('sls');
    const filtered = dataGeojson.sls.features.filter(f => f.properties.kdkec === kdkec && f.properties.kddesa === kddesa);
    geojsonLayers.sls = L.geoJSON(filtered, {
        style: styleBase,
        onEachFeature: (feature, layer) => {
            layer.on({
                mouseover: highlightFeature,
                mouseout: resetHighlight
            });
        }
    }).addTo(map);

    const bounds = geojsonLayers.sls.getBounds();
    map.fitBounds(bounds);

    addLegend(filtered, 'nmsls', 'kdsls', feature => {
        const layer = geojsonLayers.sls.getLayers().find(l => l.feature === feature);
        if (layer) map.fitBounds(layer.getBounds());
    });
}

backButton.addEventListener('click', () => {
    if (currentLevel === 'desa') {
        currentLevel = 'kecamatan';
        currentKec = null;
        loadKecamatan();
    } else if (currentLevel === 'sls') {
        currentLevel = 'desa';
        currentDesa = null;
        loadDesa(currentKec);
    }
});
