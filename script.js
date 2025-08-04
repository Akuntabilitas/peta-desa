showSpinner();
let map = L.map("map").setView([-7.5, 110.6], 10);
map.zoomControl.setPosition("bottomleft");
L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    attribution: "Tiles © Esri",
  }
).addTo(map);

const manualClusterLayer = L.layerGroup();

let currentLevel = "kabupaten";
let selectedKecamatan = null;
let selectedDesa = null;
let selectedSLS = null;
let mode = "wilayah";
let slsZoomed = false;
let selectedSLSLayer = null;

let layers = { kecamatan: null, desa: null, sls: null };
let geojsonData = { kecamatan: null, desa: null, sls: null };

let taggingData = [];
let slsMarkerLayer = L.layerGroup();
// Buat sekali saat load data awal
const slsIndex = [];

if (layers["sls"]) {
  layers["sls"].eachLayer((layer) => {
    const prop = layer.feature?.properties;
    if (prop?.kdkec && prop?.kddesa && prop?.kdsls) {
      slsIndex.push({
        kode: {
          kdkec: prop.kdkec,
          kddesa: prop.kddesa,
          kdsls: prop.kdsls,
        },
        layer: layer,
      });
    }
  });
}

function getSLSLayerByCode(kdkec, kddesa, kdsls) {
  return (
    slsIndex.find(
      (p) =>
        p.kode.kdkec === kdkec &&
        p.kode.kddesa === kddesa &&
        p.kode.kdsls === kdsls
    )?.layer || null
  );
}
let slsLayer = L.geoJSON(null, {
  style: {
    color: "#e76f51",
    weight: 2,
    fillOpacity: 0,
  },
});

map.addLayer(slsMarkerLayer);
// Ambil data GeoJSON
// Membuat atau membuka database IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("GeoJSONDB", 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("geojson")) {
        db.createObjectStore("geojson");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Simpan data ke IndexedDB
async function saveToIndexedDB(key, data) {
  const db = await openDB();
  const tx = db.transaction("geojson", "readwrite");
  tx.objectStore("geojson").put(data, key);
  return tx.complete;
}

// Ambil data dari IndexedDB
async function loadFromIndexedDB(key) {
  const db = await openDB();
  const tx = db.transaction("geojson", "readonly");
  const request = tx.objectStore("geojson").get(key);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Fetch atau ambil dari cache
async function fetchGeoJSONWithCache(key, url) {
  const cachedData = await loadFromIndexedDB(key);
  if (cachedData) {
    console.log(`Loaded ${key} from IndexedDB`);
    return cachedData;
  } else {
    const res = await fetch(url);
    const data = await res.json();
    await saveToIndexedDB(key, data);
    console.log(`Fetched and saved ${key}`);
    return data;
  }
}

// Penggunaan:
(async () => {
  geojsonData.kecamatan = await fetchGeoJSONWithCache(
    "kecamatan",
    "data/final_kec_202413309.geojson"
  );
  geojsonData.desa = await fetchGeoJSONWithCache(
    "desa",
    "data/final_desa_202413309.geojson"
  );

  geojsonData.sls = await fetchGeoJSONWithCache(
    "sls",
    "data/final_sls_202413309.geojson"
  );

  layers.sls = L.geoJSON(geojsonData.sls);
  layers.sls.eachLayer((layer) => {
    const prop = layer.feature?.properties;
    if (prop?.kdkec && prop?.kddesa && prop?.kdsls) {
      slsIndex.push({
        kode: {
          kdkec: prop.kdkec,
          kddesa: prop.kddesa,
          kdsls: prop.kdsls,
        },
        layer: layer,
      });
    }
  });
})();

// Ambil data tagging
let taggingCache = []; // definisi global di awal, di luar semua fungsi

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRW8AQ8pnphA7YgQsORfiKTby634f9trawHVLG5AspGbkY4G5A6vMfqwkiUQEztS8gYs1GuMJF_w766/pub?gid=0&single=true&output=csv";

Papa.parse(CSV_URL, {
  download: true,
  header: true,
  complete: (results) => {
    taggingData = results.data.map((t) => {
      const lat = parseFloat(t.latitude);
      const lng = parseFloat(t.longitude);

      const dataTitik = {
        lat,
        lng,
        nama: t.nama || t.nm_project || "Tanpa Nama",
        PML: t.PML,
        PPL: t.PPL,
        kdkec: t.kdkec,
        kddesa: t.kddesa,
        kdsls: t.kdsls,
        tipe_landmark: t.tipe_landmark?.trim() || "Lainnya",
        isNyasar: false, // default
      };
      return dataTitik;
    });
    taggingCache = taggingData;
    // Hitung isNyasar untuk semua titik saat awal
    taggingData.forEach((t) => {
      if (!t.lat || !t.lng || !t.kdkec || !t.kddesa || !t.kdsls) return;

      const matchedSLS = getSLSLayerByCode(t.kdkec, t.kddesa, t.kdsls);
      if (!matchedSLS?.feature?.geometry) return;

      try {
        const turfPoint = turf.point([parseFloat(t.lng), parseFloat(t.lat)]);
        const geom = matchedSLS.feature.geometry;
        let polygon = null;

        if (geom.type === "Polygon") {
          polygon = turf.polygon(geom.coordinates);
        } else if (geom.type === "MultiPolygon") {
          polygon = turf.multiPolygon(geom.coordinates);
        }

        if (polygon) {
          const nearest = turf.nearestPointOnLine(
            turf.polygonToLine(polygon),
            turfPoint
          );
          const dist = turf.distance(turfPoint, nearest, { units: "meters" });
          t.isNyasar = dist > 50;
        }
      } catch (err) {
        console.warn("Gagal memproses polygon SLS untuk nyasar:", err);
      }
    });

    // ⬇ Tambahkan cache setelah taggingData selesai diisi dan dianalisis
    cacheTaggingData();

    populatePetugasDatalist();
    showKecamatan();
    showTaggingForWilayah();
    hideSpinner();
    const totalNyasar = taggingData.filter(t => t.isNyasar).length;
console.log('Jumlah titik nyasar:', totalNyasar);
  },
});

// Fungsi caching tagging per wilayah
function cacheTaggingData() {
  taggingCache.perKecamatan = {};
  taggingCache.perDesa = {};
  taggingCache.perSLS = {};

  taggingData.forEach((row) => {
    const { kdkec, kddesa, kdsls } = row;

    const slsKey = `${kdkec}_${kddesa}_${kdsls}`;
    const desaKey = `${kdkec}_${kddesa}`;
    const kecKey = kdkec;

    taggingCache.perSLS[slsKey] ||= [];
    taggingCache.perDesa[desaKey] ||= [];
    taggingCache.perKecamatan[kecKey] ||= [];

    taggingCache.perSLS[slsKey].push(row);
    taggingCache.perDesa[desaKey].push(row);
    taggingCache.perKecamatan[kecKey].push(row);
  });

  console.log("✅ Tagging cache selesai dibuat:", taggingCache);
}

let kategoriMode = "wilkerstat"; // default

document.getElementById("toggle-kategori").addEventListener("change", (e) => {
  kategoriMode = e.target.checked ? "konsentrasi" : "wilkerstat";
  document.getElementById("label-kategori").textContent =
    kategoriMode === "konsentrasi" ? "Wilayah Konsentrasi" : "Batas Wilkerstat";

  clearTagging();

  if (kategoriMode === "wilkerstat") {
    if (currentLevel === "kecamatan") {
      showTaggingForWilayah(null, null, null, 3, true);
    } else if (currentLevel === "desa") {
      showTaggingForWilayah(selectedKecamatan, null, null, 6, true);
    } else if (currentLevel === "sls") {
      if (slsZoomed && selectedSLS) {
        showTaggingForWilayah(
          selectedKecamatan,
          selectedDesa,
          selectedSLS,
          6,
          false
        ); // INDIVIDU
      } else {
        showTaggingForWilayah(selectedKecamatan, selectedDesa, null, 8, true); // CLUSTER
      }
    }
  } else {
    // KONSENTRASI
    if (currentLevel === "kecamatan") {
      showKonsentrasiIcons(null, null, null);
    } else if (currentLevel === "desa") {
      showKonsentrasiIcons(selectedKecamatan, null, null);
    } else if (currentLevel === "sls") {
      if (slsZoomed && selectedSLS) {
        showKonsentrasiIcons(selectedKecamatan, selectedDesa, selectedSLS); // 1 SLS
      } else {
        showKonsentrasiIcons(selectedKecamatan, selectedDesa, null); // Semua SLS di desa
      }
    }
  }
});

function showKonsentrasiIcons(kdkec = null, kddesa = null, kdsls = null) {
  clearTagging();

  let taggingFiltered = [];

  // Ambil dari cache, bukan filter ulang
  if (kdkec && kddesa && kdsls) {
    taggingFiltered = taggingCache.perSLS[`${kdkec}_${kddesa}_${kdsls}`] || [];
  } else if (kdkec && kddesa) {
    taggingFiltered = taggingCache.perDesa[`${kdkec}_${kddesa}`] || [];
  } else if (kdkec) {
    taggingFiltered = taggingCache.perKecamatan[kdkec] || [];
  } else {
    taggingFiltered = taggingData;
  }

  const landmarkCounts = countLandmarks(taggingFiltered);
  updateLandmarkCountDisplay(landmarkCounts);

  const kategori = [
    "Mall",
    "Pertokoan",
    "Pasar",
    "Gedung Perkantoran",
    "Kawasan Industri/Sentra Industri",
    "Tempat Rekreasi",
    "Pelabuhan",
    "Bandara",
    "Terminal",
    "Stasiun",
  ];

  taggingFiltered
    .filter((t) => kategori.includes(t.tipe_landmark))
    .forEach((t) => {
      if (!isNaN(t.lat) && !isNaN(t.lng)) {
        // Hitung apakah titik nyasar terhadap poligon SLS yang sesuai
        let isNyasar = false;
        const key = `${t.kdkec}-${t.kddesa}-${t.kdsls}`;
        const geom = slsIndex[key];

        const jenis = ikonLandmark[t.tipe_landmark] || {
          icon: "❓",
          color: "#999",
        };
        const icon = L.divIcon({
          html: `<div style="font-size: 18px; color: ${jenis.color}; text-align: center;">${jenis.icon}</div>`,
          className: "tipe-landmark-icon",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([t.lat, t.lng], { icon }).bindPopup(
          `<b>${t.nama}</b><br>PPL: ${t.PPL}<br>PML: ${t.PML}<br>Jenis: ${t.tipe_landmark}`
        );

        slsMarkerLayer.addLayer(marker);
      }
    });

  map.addLayer(slsMarkerLayer);
}

function clearMap() {
  Object.values(layers).forEach((l) => l && map.removeLayer(l));
}
function clearTagging() {
  slsMarkerLayer.clearLayers();

  if (map.hasLayer(manualClusterLayer)) {
    map.removeLayer(manualClusterLayer);
  }

  map.eachLayer((layer) => {
    if (
      layer instanceof L.Marker &&
      layer.options.icon &&
      layer.options.icon.options.className === "custom-cluster-icon"
    ) {
      map.removeLayer(layer);
    }
  });
}

const ikonLandmark = {
  "Batas SLS": { icon: "🔴", color: "#ff9800" },
  "Batas Segmen": { icon: "⚪", color: "#ff9800" },
  Mall: { icon: "🏬", color: "#ff9800" },
  Pertokoan: { icon: "🏪", color: "#9c27b0" },
  Pasar: { icon: "🛒", color: "#f44336" },
  "Gedung Perkantoran": { icon: "🏢", color: "#ff9800" },
  "Kawasan Industri/Sentra Industri": { icon: "🏭", color: "#9c27b0" },
  "Tempat Rekreasi": { icon: "🎡", color: "#f44336" },
  Pelabuhan: { icon: "🚢", color: "#ff9800" },
  Bandara: { icon: "✈️", color: "#9c27b0" },
  Terminal: { icon: "🚌", color: "#f44336" },
  Stasiun: { icon: "🚆", color: "#f44336" },
};
function showKecamatan() {
  clearMap();
  clearTagging();
  selectedSLSHighlightLayer.clearLayers();
  currentLevel = "kecamatan";
  updateLegend(geojsonData.kecamatan.features, "kdkec", "nmkec");

  layers.kecamatan = L.geoJSON(geojsonData.kecamatan, {
    style: { color: "#1e1affff", weight: 1, fillOpacity: 0.2 },
    onEachFeature: (feature, layer) => {
      layer.bindTooltip(feature.properties.nmkec, { sticky: true });
      layer.on({
        click: () => {
          selectedKecamatan = feature.properties.kdkec;
          selectedDesa = null;
          showDesa();
        },
        mouseover: () => highlightFeature(layer),
        mouseout: () => resetHighlight(layer),
      });
    },
  }).addTo(map);

  map.fitBounds(layers.kecamatan.getBounds(), {
    paddingTopLeft: [0, 0],
    paddingBottomRight: window.innerWidth > 768 ? [300, 0] : [0, 0],
  });

  if (kategoriMode === "wilkerstat") {
    showTaggingForWilayah(null, null, null, 3, true); // hanya batas
  } else {
    showKonsentrasiIcons(null, null, null); // ikon langsung
  }
  setNav(); // default semua wilayah
}
function showDesa() {
  clearMap();
  clearTagging();
  selectedSLSHighlightLayer.clearLayers();
  currentLevel = "desa";
  const filtered = geojsonData.desa.features.filter(
    (f) => f.properties.kdkec === selectedKecamatan
  );
  updateLegend(filtered, "kddesa", "nmdesa");

  layers.desa = L.geoJSON(
    { type: "FeatureCollection", features: filtered },
    {
      style: { color: "#2a9d8f", weight: 1, fillOpacity: 0.3 },
      onEachFeature: (feature, layer) => {
        layer.bindTooltip(feature.properties.nmdesa, { sticky: true });
        layer.on({
          click: () => {
            selectedDesa = feature.properties.kddesa;
            selectedSLS = null;
            showSLS();
          },
          mouseover: () => highlightFeature(layer),
          mouseout: () => resetHighlight(layer),
        });
      },
    }
  ).addTo(map);

  map.fitBounds(layers.desa.getBounds(), {
    paddingTopLeft: [0, 0],
    paddingBottomRight: window.innerWidth > 768 ? [300, 0] : [0, 0],
  });
  if (kategoriMode === "wilkerstat") {
    showTaggingForWilayah(selectedKecamatan, null, null, 6, true); // hanya batas
  } else {
    showKonsentrasiIcons(selectedKecamatan, null, null); // ikon langsung
  }
  setNav("kecamatan", {
    nmkec: getNamaKecamatan(selectedKecamatan),
  });
}

function showSLS() {
  clearMap();
  clearTagging();
  selectedSLSHighlightLayer.clearLayers();
  currentLevel = "sls";
  const filtered = geojsonData.sls.features.filter(
    (f) =>
      f.properties.kdkec === selectedKecamatan &&
      f.properties.kddesa === selectedDesa
  );
  updateLegend(filtered, "kdsls", "nmsls");

  layers.sls = L.geoJSON(
    { type: "FeatureCollection", features: filtered },
    {
      style: { color: "#e76f51", weight: 2, fillOpacity: 0 },
      onEachFeature: (feature, layer) => {
        layer.bindTooltip(feature.properties.nmsls, { sticky: true });
        layer.on({
          click: () => {
            selectedSLS = feature.properties.kdsls;
            slsZoomed = true;

            selectedSLSHighlightLayer.clearLayers(); // Hapus highlight sebelumnya

            if (feature?.geometry) {
              selectedSLSHighlightLayer.addData(feature);
            }
            map.fitBounds(layer.getBounds(), {
              paddingBottomRight: window.innerWidth > 768 ? [300, 0] : [0, 0],
            });

            showTaggingForWilayah(
              selectedKecamatan,
              selectedDesa,
              selectedSLS,
              6,
              false
            );

            setNav("sls", {
              nmkec: getNamaKecamatan(selectedKecamatan),
              nmdesa: getNamaDesa(selectedKecamatan, selectedDesa),
              nmsls: getNamaSLS(selectedKecamatan, selectedDesa, selectedSLS),
            });
          },
          mouseover: () => highlightFeature(layer),
          mouseout: () => resetHighlight(layer),
        });
      },
    }
  ).addTo(map);

  map.fitBounds(layers.sls.getBounds(), {
    paddingTopLeft: [0, 0],
    paddingBottomRight: window.innerWidth > 768 ? [300, 0] : [0, 0],
  });
  if (kategoriMode === "wilkerstat") {
    showTaggingForWilayah(selectedKecamatan, selectedDesa, null, 8, true); // hanya batas
  } else {
    showKonsentrasiIcons(selectedKecamatan, selectedDesa, null); // ikon langsung
  }
  setNav("desa", {
    nmkec: getNamaKecamatan(selectedKecamatan),
    nmdesa: getNamaDesa(selectedKecamatan, selectedDesa),
  });
}

function showTaggingForWilayah(
  kdkec = null,
  kddesa = null,
  kdsls = null,
  radius = 5,
  useCluster = true
) {
  clearTagging();
  const filteredTagging = taggingCache.filter(
    (t) =>
      (!kdkec || t.kdkec === kdkec) &&
      (!kddesa || t.kddesa === kddesa) &&
      (!kdsls || t.kdsls === kdsls)
  );

  manualClusterLayer.clearLayers();
  // Bangun indeks poligon SLS hanya sekali
  if (
    Object.keys(slsIndex).length === 0 &&
    layers.sls &&
    layers.sls.eachLayer
  ) {
    layers.sls.eachLayer((l) => {
      const prop = l.feature?.properties;
      const geom = l.feature?.geometry;
      if (prop && geom && geom.coordinates?.length) {
        const key = `${prop.kdkec}-${prop.kddesa}-${prop.kdsls}`;
        slsIndex[key] = geom;
      }
    });
  }

  // Zoom ke satu SLS, tampilkan titik individu + label
  if (!useCluster) {
    filteredTagging.forEach((t) => {
      if (!isNaN(t.lat) && !isNaN(t.lng)) {
        const jenis = ikonLandmark[t.tipe_landmark] || {
          icon: "❓",
          color: "#999",
        };
        const extraStyle = t.isNyasar
          ? `
    border: 2px solid gold;
    background-color: rgba(255, 255, 100, 0.8);
    border-radius: 50%;
    font-weight: bold;
  `
          : "";
        const icon = L.divIcon({
          html: `
    <div style="
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      color: ${t.isNyasar ? "#000" : jenis.color};
      background-color: ${t.isNyasar ? "rgba(255, 255, 100, 0.8)" : "transparent"};
      border: ${t.isNyasar ? "2px solid gold" : "none"};
      border-radius: 50%;
      font-weight: bold;
    ">${jenis.icon}</div>
  `,
          className: "tipe-landmark-icon",
          iconSize: [28, 28],
          iconAnchor: [14, 14], // center bottom
        });

        const marker = L.marker([t.lat, t.lng], { icon }).bindPopup(
          `<b>${t.nama}</b><br>PPL: ${t.PPL}<br>PML: ${t.PML}<br>Jenis: ${t.tipe_landmark}`
        );

        marker.bindTooltip(t.nama || "Tanpa Nama", {
          permanent: true,
          direction: "bottom",
          offset: [0, 14],
          className: "tagging-label",
        });

        slsMarkerLayer.addLayer(marker);
      }
    });
    map.addLayer(slsMarkerLayer);

    return;
  }

  // Cluster manual berdasarkan kode wilayah
  const groupByCode = {};
  filteredTagging.forEach((t) => {
    if (!isNaN(t.lat) && !isNaN(t.lng)) {
      let kode =
        currentLevel === "kecamatan"
          ? t.kdkec
          : currentLevel === "desa"
            ? t.kddesa
            : currentLevel === "sls"
              ? t.kdsls
              : "all";

      if (!groupByCode[kode]) groupByCode[kode] = [];
      groupByCode[kode].push(t);
    }
  });

  // === [1] Preprocess Indexing Layer SLS ===
const slsLayerGroup = layers["sls"];

if (slsLayerGroup) {
  slsLayerGroup.eachLayer((l) => {
    const props = l.feature?.properties;
    const geom = l.feature?.geometry;
    if (!props || !geom) return;

    const key = `${props.kdkec}-${props.kddesa}-${props.kdsls}`;
    slsIndex[key] = geom;
  });
}


  // === [2] Tandai isNyasar untuk tiap titik tagging ===

  // === [2] Tandai isNyasar untuk tiap titik tagging (diproses 1x per titik) ===
  filteredTagging.forEach((t) => {
  if (t._checkedNyasar) return;
  if (t.tipe_landmark !== 'Batas SLS') {
    t.isNyasar = false; // bukan titik yang perlu dicek nyasar
    return;
  }
  if (!t.lat || !t.lng || !t.kdkec || !t.kddesa || !t.kdsls) return;

  const key = `${t.kdkec}-${t.kddesa}-${t.kdsls}`;
  const geom = slsIndex[key];
  if (!geom) return;

  try {
    const turfPoint = turf.point([parseFloat(t.lng), parseFloat(t.lat)]);
    let polygon = null;

    if (geom.type === "Polygon") {
      polygon = turf.polygon(geom.coordinates);
    } else if (geom.type === "MultiPolygon") {
      polygon = turf.multiPolygon(geom.coordinates);
    }

    if (polygon) {
      const nearest = turf.nearestPointOnLine(
        turf.polygonToLine(polygon),
        turfPoint
      );
      const dist = turf.distance(turfPoint, nearest, { units: "meters" });
      t.isNyasar = dist > 20;
    } else {
      t.isNyasar = false;
    }
  } catch (e) {
    t.isNyasar = false;
    console.warn("Gagal menghitung nyasar untuk titik:", t, e);
  }

  t._checkedNyasar = true;
});

console.log("Jumlah titik nyasar:", filteredTagging.filter(t => t.isNyasar).length);

  Object.entries(groupByCode).forEach(([kode, titikList]) => {
    const group = L.featureGroup();

    titikList.forEach((t) => {
      const marker = L.marker([t.lat, t.lng]).bindPopup(`${t.nama}`);
      group.addLayer(marker);
    });
    map.addLayer(manualClusterLayer);

    // Cari layer poligon berdasarkan kode dan level
    let layerGroup = layers[currentLevel];
    let matchedLayer = null;
    if (layerGroup && layerGroup.eachLayer) {
      layerGroup.eachLayer((l) => {
        const prop = l.feature?.properties;
        if (prop) {
          const matchKode =
            (currentLevel === "kecamatan" && prop.kdkec === kode) ||
            (currentLevel === "desa" && prop.kddesa === kode) ||
            (currentLevel === "sls" && prop.kdsls === kode);
          if (matchKode) matchedLayer = l;
        }
      });
    }

    let center;

    if (matchedLayer) {
      const polygon = matchedLayer.feature;
      if (polygon && polygon.geometry) {
        const point = turf.pointOnFeature(polygon);
        center = L.latLng(
          point.geometry.coordinates[1],
          point.geometry.coordinates[0]
        );
      } else {
        center = matchedLayer.getBounds().getCenter();
      }
    } else {
      // fallback: gunakan center dari titik tagging
      const bounds = group.getBounds();
      if (!bounds.isValid()) return;
      center = bounds.getCenter();
    }
    const taggingFiltered = taggingData.filter(
      (t) =>
        (!kdkec || t.kdkec === kdkec) &&
        (!kddesa || t.kddesa === kddesa) &&
        (!kdsls || t.kdsls === kdsls)
    );

    const landmarkCounts = countLandmarks(taggingFiltered);
    updateLandmarkCountDisplay(landmarkCounts);

    function isKonsentrasiEkonomi(tipe) {
      const list = [
        "Mall",
        "Pasar",
        "Pertokoan",
        "Gedung Perkantoran",
        "Kawasan Industri/Sentra Industri",
        "Tempat Rekreasi",
        "Pelabuhan",
        "Bandara",
        "Terminal",
        "Stasiun",
      ];
      return list.includes(tipe);
    }

    const namaWilayah =
      currentLevel === "kecamatan"
        ? `[${matchedLayer?.feature?.properties?.kdkec}] ${matchedLayer?.feature?.properties?.nmkec}`
        : currentLevel === "desa"
          ? `[${matchedLayer?.feature?.properties?.kddesa}] ${matchedLayer?.feature?.properties?.nmdesa}`
          : `[${matchedLayer?.feature?.properties?.kdsls}] ${matchedLayer?.feature?.properties?.nmsls}` ||
            "";

    const jumlahBatasSLS = titikList.filter(
      (t) => t.tipe_landmark === "Batas SLS"
    ).length;
    const jumlahBatasSegmen = titikList.filter(
      (t) => t.tipe_landmark === "Batas Segmen"
    ).length;
    const jumlahEkonomi = titikList.filter((t) =>
      isKonsentrasiEkonomi(t.tipe_landmark)
    ).length;
    const jumlahNyasar = titikList.filter((t) => t.isNyasar).length;

    const nyasarLabelHTML =
      jumlahNyasar > 0
        ? `<div class="cluster-label">
       <span class="nyasar-label has-nyasar">⚠️${jumlahNyasar} > 20m dari batas </span>
     </div>`
        : "";

    const slsKurangEmpat = new Set();
    const titikPerSLS = {};

    titikList.forEach((t) => {
      const key = `${t.kdkec}-${t.kddesa}-${t.kdsls}`;
      if (!titikPerSLS[key]) titikPerSLS[key] = 0;
      titikPerSLS[key]++;
    });

    for (const key in titikPerSLS) {
      if (titikPerSLS[key] < 4) slsKurangEmpat.add(key);
    }

    const slsKurangEmpatLabelHTML =
      slsKurangEmpat.size > 0
        ? `<div class="cluster-label">
       <span class="nyasar-label taggingkurang">❗ ${slsKurangEmpat.size} SLS < 4 titik</span>
     </div>`
        : "";

    const manualCluster = L.marker(center, {
      icon: L.divIcon({
        html: `
      <div class="cluster-box">
        <span class="sls-count">${jumlahBatasSLS}</span> /
        <span class="segmen-count">${jumlahBatasSegmen}</span> /
        <span class="konsentrasi-count">${jumlahEkonomi}</span>
      </div>
      ${nyasarLabelHTML}
      ${slsKurangEmpatLabelHTML}
      <div class="cluster-label"><b>${namaWilayah}</b></div>
    `,
        className: "",
        iconSize: [100, 40],
      }),
    });

    manualCluster.bindTooltip(
      `<div>${namaWilayah}</div>Batas SLS: ${jumlahBatasSLS}<br>Batas Segmen: ${jumlahBatasSegmen}<br>Wilayah Konsentrasi: ${jumlahEkonomi}`,
      { direction: "top", permanent: false, className: "cluster-tooltip" }
    );

    manualCluster.on("click", () => {
      selectedSLSHighlightLayer.clearLayers(); // Hapus highlight sebelumnya

      if (matchedLayer?.feature?.geometry) {
        selectedSLSHighlightLayer.addData(matchedLayer.feature);
      }
      if (currentLevel === "kecamatan") {
        selectedKecamatan = kode;
        selectedDesa = null; // reset desa
        selectedSLS = null; // reset sls
        showDesa();
      } else if (currentLevel === "desa") {
        selectedDesa = kode;
        selectedSLS = null; // reset sls
        showSLS();
      } else if (currentLevel === "sls") {
        selectedSLS = kode;
        slsZoomed = true;
        setNav("sls", {
          nmkec: getNamaKecamatan(selectedKecamatan),
          nmdesa: getNamaDesa(selectedKecamatan, selectedDesa),
          nmsls: getNamaSLS(selectedKecamatan, selectedDesa, selectedSLS),
        });
        showTaggingForWilayah(
          selectedKecamatan,
          selectedDesa,
          selectedSLS,
          6,
          false
        );

        // Zoom ke poligon SLS yang sesuai
        const slsLayerGroup = layers["sls"];
        if (slsLayerGroup && slsLayerGroup.eachLayer) {
          slsLayerGroup.eachLayer((l) => {
            const prop = l.feature?.properties;
            if (prop?.kdsls === kode) {
              map.fitBounds(l.getBounds());
            }
          });
        }
      }
    });

    manualClusterLayer.addLayer(manualCluster);
  });
}

function highlightFeature(layer) {
  layer.setStyle({ weight: 3, color: "#2196f3", fillOpacity: 0.6 });
  layer.bringToFront();
}
function resetHighlight(layer) {
  const style =
    currentLevel === "kecamatan"
      ? { color: "#1e1affff", weight: 1, fillOpacity: 0.2 }
      : currentLevel === "desa"
        ? { color: "#2a9d8f", weight: 1, fillOpacity: 0.3 }
        : { color: "#e76f51", weight: 2, fillOpacity: 0 };
  layer.setStyle(style);
}
function findLayerByFeature(feature) {
  const group = layers[currentLevel];
  let found = null;
  if (group && group.eachLayer) {
    group.eachLayer((layer) => {
      if (
        JSON.stringify(layer.feature.properties) ===
        JSON.stringify(feature.properties)
      ) {
        found = layer;
      }
    });
  }
  return found;
}
function updateLegend(features, codeProp, nameProp) {
  const list = document.getElementById("legend-list");
  list.innerHTML = "";

  features
    .sort((a, b) =>
      a.properties[codeProp].localeCompare(b.properties[codeProp])
    )
    .forEach((f) => {
      const li = document.createElement("li");
      li.className = "legend-item";
      li.textContent = `(${f.properties[codeProp]}) ${f.properties[nameProp]}`;

      li.addEventListener("mouseenter", () => {
        const layer = findLayerByFeature(f);
        if (layer) highlightFeature(layer);
      });

      li.addEventListener("mouseleave", () => {
        const layer = findLayerByFeature(f);
        if (layer) resetHighlight(layer);
      });

      li.addEventListener("click", () => {
        if (currentLevel === "kecamatan") {
          selectedKecamatan = f.properties.kdkec;
          showDesa();
        } else if (currentLevel === "desa") {
          selectedDesa = f.properties.kddesa;
          showSLS();
        } else if (currentLevel === "sls") {
          selectedSLS = f.properties.kdsls;
          const layer = findLayerByFeature(f);
          if (layer) {
            map.fitBounds(layer.getBounds(), { paddingBottomRight: [300, 0] });
            showTaggingForWilayah(
              selectedKecamatan,
              selectedDesa,
              selectedSLS,
              6,
              false
            );
          }
        }
      });

      list.appendChild(li);
    });
}

document.getElementById("back-btn").addEventListener("click", () => {
  if (currentLevel === "sls") {
    if (slsZoomed) {
      slsZoomed = false;
      selectedSLS = null;
      showSLS();
    } else {
      selectedSLS = null;
      showDesa();
    }
  } else if (currentLevel === "desa") {
    selectedDesa = null;
    showKecamatan();
  }
});

document.getElementById("mode-select").addEventListener("change", (e) => {
  mode = e.target.value;
  document.getElementById("petugas-panel").style.display =
    mode === "petugas" ? "block" : "none";
  document.getElementById("back-btn").style.display =
    mode === "petugas" ? "none" : "block";
  document.getElementById("legend-list").style.display =
    mode === "petugas" ? "none" : "block";
  clearMap();
  clearTagging();
  clearPML();
  if (mode === "wilayah") {
    if (currentLevel === "kecamatan") showKecamatan();
    else if (currentLevel === "desa") showDesa();
    else if (currentLevel === "sls") showSLS();
  }
  if (mode === "petugas") {
    showKecamatan();
    clearTagging();
  }
});

function populatePetugasDatalist() {
  const pmlSet = new Set();
  const pplSet = new Set();

  taggingData.forEach((t) => {
    if (t.PML) pmlSet.add(t.PML);
    if (t.PPL) pplSet.add(t.PPL);
  });

  const pmlList = document.getElementById("pml-list");
  const pplList = document.getElementById("ppl-list");

  pmlList.innerHTML = "";
  pplList.innerHTML = "";

  [...pmlSet].sort().forEach((pml) => {
    const opt = document.createElement("option");
    opt.value = pml;
    pmlList.appendChild(opt);
  });

  [...pplSet].sort().forEach((ppl) => {
    const opt = document.createElement("option");
    opt.value = ppl;
    pplList.appendChild(opt);
  });
}

function showTaggingFiltered(filterFn, radius = 5) {
  clearTagging();

  const filtered = taggingData.filter(filterFn);

  filtered.forEach((t) => {
    if (!isNaN(t.lat) && !isNaN(t.lng)) {
      // Marker titik tagging
      const marker = L.circleMarker([t.lat, t.lng], {
        radius,
        color: "#ff5722",
        fillOpacity: 0.8,
      }).bindPopup(
        `<b>${t.nama}</b><br>PPL: ${t.PPL}<br>PML: ${t.PML}<br>Kode SLS: ${t.kdsls}`
      );
      slsMarkerLayer.addLayer(marker);

      // Label kode SLS (tampil di atas marker)
      const label = L.marker([t.lat, t.lng], {
        icon: L.divIcon({
          className: "tagging-label",
          html: t.kdsls,
          iconSize: [30, 15],
          iconAnchor: [30, 30],
        }),
        interactive: false, // agar tidak mengganggu klik marker
      });
      slsMarkerLayer.addLayer(label);
    }
  });

  map.addLayer(slsMarkerLayer);

  // Tampilkan poligon SLS terfilter
  showSLSForPetugas(filtered);

  // Zoom ke wilayah tagging hasil filter
  const latlngs = [];
  filtered.forEach((t) => {
    if (!isNaN(t.lat) && !isNaN(t.lng)) {
      latlngs.push([t.lat, t.lng]);
    }
  });

  if (latlngs.length > 0) {
    const bounds = L.latLngBounds(latlngs);
    map.fitBounds(bounds, { padding: [30, 30] });
  }
}

function setNav(level, data = {}) {
  const nav = document.getElementById("simple-nav");

  const semua = `<span onclick="showKecamatan()">KAB BOYOLALI</span>`;
  const kec = `<span onclick="showDesa()">[${selectedKecamatan || "??"}] ${data.nmkec || "Kecamatan"}</span>`;
  const desa = `<span onclick="showSLS()">[${selectedDesa || "??"}] ${data.nmdesa || "Desa"}</span>`;
  const sls = `[${selectedSLS || "??"}] ${data.nmsls || ""}`; // hanya teks, tidak bisa diklik

  if (level === "kecamatan") {
    nav.innerHTML = `${semua} › ${kec}`;
  } else if (level === "desa") {
    nav.innerHTML = `${semua} › ${kec} › ${desa}`;
  } else if (level === "sls") {
    nav.innerHTML = `${semua} › ${kec} › ${desa} › ${sls}`;
  } else {
    nav.innerHTML = semua;
  }
}

function getNamaKecamatan(kdkec) {
  const f = geojsonData.kecamatan.features.find(
    (f) => f.properties.kdkec === kdkec
  );
  return f ? f.properties.nmkec : "";
}

function getNamaDesa(kdkec, kddesa) {
  const desa = geojsonData.desa.features.find(
    (f) => f.properties.kdkec === kdkec && f.properties.kddesa === kddesa
  );
  return desa ? desa.properties.nmdesa : "";
}

function getNamaSLS(kdkec, kddesa, kdsls) {
  const sls = geojsonData.sls.features.find(
    (f) =>
      f.properties.kdkec === kdkec &&
      f.properties.kddesa === kddesa &&
      f.properties.kdsls === kdsls
  );
  return sls ? sls.properties.nmsls : "";
}

function showSpinner() {
  document.getElementById("loading-spinner").classList.remove("hidden");
}

function hideSpinner() {
  document.getElementById("loading-spinner").classList.add("hidden");
}

const btnExport = document.getElementById("btn-export-nyasar");
const popupExport = document.getElementById("popup-export");
const closePopup = document.getElementById("close-popup");

btnExport.addEventListener("click", () => {
  popupExport.classList.toggle("show");
  populateKecamatanDropdown();
  populateDesaDropdown();
});

closePopup.addEventListener("click", () => {
  popupExport.classList.remove("show");
});

// Populate Kecamatan Dropdown
function populateKecamatanDropdown() {
  const select = document.getElementById("filter-kec");
  select.innerHTML = `<option value="">Semua Kecamatan</option>`;
  geojsonData.kecamatan.features.forEach((f) => {
    const opt = document.createElement("option");
    opt.value = f.properties.kdkec;
    opt.textContent = f.properties.nmkec;
    select.appendChild(opt);
  });
}

// Populate Desa Dropdown
function populateDesaDropdown(selectedKec = "") {
  const select = document.getElementById("filter-desa");
  select.innerHTML = `<option value="">Semua Desa</option>`;
  geojsonData.desa.features
    .filter((f) => !selectedKec || f.properties.kdkec === selectedKec)
    .forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.properties.kddesa;
      opt.textContent = f.properties.nmdesa;
      select.appendChild(opt);
    });
}

// Update Desa saat Kecamatan dipilih
document.getElementById("filter-kec").addEventListener("change", function () {
  const selectedKec = this.value;
  populateDesaDropdown(selectedKec);
});

// Download file
document.getElementById("download-filtered").addEventListener("click", () => {
  const selectedKec = document.getElementById("filter-kec").value;
  const selectedDesa = document.getElementById("filter-desa").value;

  const filtered = taggingData.filter((t) => {
    if (!t.isNyasar) return false;
    if (selectedKec && t.kdkec !== selectedKec) return false;
    if (selectedDesa && t.kddesa !== selectedDesa) return false;
    return true;
  });

  // Export to Excel
  // Buat worksheet manual agar bisa set tipe cell
  const header = [
    "kdkec",
    "nmkec",
    "kddesa",
    "nmdesa",
    "kdsls",
    "nmsls",
    "PML",
    "PPL",
    "Jarak",
  ];

  const data = filtered.map((t) => [
    t.kdkec,
    getNamaKecamatan(t.kdkec),
    t.kddesa,
    getNamaDesa(t.kdkec, t.kddesa),
    t.kdsls,
    getNamaSLS(t.kdkec, t.kddesa, t.kdsls),
    t.PML || "",
    t.PPL || "",
    t.jarakKeBatas || "",
  ]);

  const aoa = [header, ...data];
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  // Format kolom tertentu sebagai text (agar 00 tetap muncul tanpa tanda kutip)
  ["A", "C", "E"].forEach((col) => {
    for (let r = 2; r <= aoa.length; r++) {
      const cell = worksheet[`${col}${r}`];
      if (cell) cell.z = "@"; // Format text
    }
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Tagging Nyasar");
  XLSX.writeFile(workbook, "tagging-nyasar.xlsx");

  popupExport.classList.remove("show");
});

// Setelah semua elemen HTML sudah pasti ada
document.addEventListener("DOMContentLoaded", () => {
  populatePetugasDatalist(); // Pastikan ini dipanggil saat awal
  // Event listener pencarian
  document.getElementById("pml-input").addEventListener("input", () => {
    const pml = document.getElementById("pml-input").value.trim();
    const ppl = document.getElementById("ppl-input").value.trim();

    showTaggingFiltered((t) => {
      return (!pml || t.PML === pml) && (!ppl || t.PPL === ppl);
    });
  });

  document.getElementById("ppl-input").addEventListener("input", () => {
    const pml = document.getElementById("pml-input").value.trim();
    const ppl = document.getElementById("ppl-input").value.trim();

    showTaggingFiltered((t) => {
      return (!pml || t.PML === pml) && (!ppl || t.PPL === ppl);
    });
  });
});

const pmlInput = document.getElementById("pml-input");
const pplInput = document.getElementById("ppl-input");
const pplList = document.getElementById("ppl-list");
const pmlList = document.getElementById("pml-list");

// Inisialisasi PML list
const uniquePMLs = [...new Set(taggingData.map((t) => t.PML))]
  .filter(Boolean)
  .sort();
pmlList.innerHTML = uniquePMLs.map((pml) => `<option value="${pml}">`).join("");

// Saat PML diketik atau dipilih
pmlInput.addEventListener("input", () => {
  const selectedPML = pmlInput.value.trim();
  const filteredPPLs = [
    ...new Set(
      taggingData.filter((t) => t.PML === selectedPML).map((t) => t.PPL)
    ),
  ]
    .filter(Boolean)
    .sort();

  pplList.innerHTML = filteredPPLs
    .map((ppl) => `<option value="${ppl}">`)
    .join("");

  // Tampilkan titik tagging sesuai input PML + PPL
  const selectedPPL = pplInput.value.trim();
  showTaggingFiltered(
    (t) =>
      (!selectedPML || t.PML === selectedPML) &&
      (!selectedPPL || t.PPL === selectedPPL)
  );
});

// Saat PPL diketik
pplInput.addEventListener("input", () => {
  const selectedPML = pmlInput.value.trim();
  const selectedPPL = pplInput.value.trim();
  showTaggingFiltered(
    (t) =>
      (!selectedPML || t.PML === selectedPML) &&
      (!selectedPPL || t.PPL === selectedPPL)
  );
});

function clearPML() {
  document.getElementById("pml-input").value = "";
  document.getElementById("ppl-input").value = "";

  const pplList = document.getElementById("ppl-list");
  if (pplList) {
    pplList.innerHTML = "";
  }
  slsLayer.clearLayers();
  showKecamatan();
  clearTagging();
}

function clearPPL() {
  document.getElementById("ppl-input").value = "";
  const pml = document.getElementById("pml-input").value.trim();

  showTaggingFiltered((t) => {
    return !pml || t.PML === pml;
  });

  // Tidak perlu panggil clearTagging lagi
}

function showSLSForPetugas(filteredTagging) {
  clearMap();
  if (!geojsonData) return;

  const selectedCodes = new Set(
    filteredTagging.map((t) => `${t.kdkec}-${t.kddesa}-${t.kdsls}`)
  );

  const filteredSLS = {
    type: "FeatureCollection",
    features: geojsonData.sls.features.filter((f) => {
      const p = f.properties;
      const key = `${p.kdkec}-${p.kddesa}-${p.kdsls}`;
      return selectedCodes.has(key);
    }),
  };

  slsLayer.clearLayers();

  // Tambahkan poligon dengan tooltip kode SLS
  L.geoJSON(filteredSLS, {
    style: {
      color: "#e76f51",
      weight: 2,
      fillOpacity: 0.1,
    },
    onEachFeature: (feature, layer) => {
      const kodeSLS = feature.properties.kdsls;
      layer.bindTooltip(kodeSLS, {
        permanent: true,
        direction: "center",
        className: "sls-label",
      });
    },
  }).addTo(slsLayer);

  // Tambahkan teks marker di tengah poligon
  filteredSLS.features.forEach((f) => {
    const center = getPolygonCenter(f.geometry);
    if (center) {
      const kode = f.properties.kdsls;
      const label = L.marker(center, {
        icon: L.divIcon({
          className: "sls-label",
          html: kode,
          iconSize: [30, 20],
        }),
      });
      slsLayer.addLayer(label);
    }
  });

  slsLayer.addTo(map);

  // Zoom ke area gabungan
  if (filteredSLS.features.length > 0) {
    const bounds = L.geoJSON(filteredSLS).getBounds();
    map.fitBounds(bounds, {
      paddingBottomRight: window.innerWidth > 768 ? [300, 0] : [0, 0],
    });
  }
}

function getPolygonCenter(geometry) {
  const coords = geometry.coordinates;
  if (geometry.type === "Polygon") {
    return L.polygon(coords).getBounds().getCenter();
  } else if (geometry.type === "MultiPolygon") {
    return L.polygon(coords[0]).getBounds().getCenter(); // Ambil polygon pertama
  }
  return null;
}

const selectedSLSHighlightLayer = L.geoJSON(null, {
  style: {
    color: "gold",
    weight: 3,
    fillOpacity: 0.1,
  },
}).addTo(map);

function countLandmarks(taggingList) {
  const counts = {};

  taggingList.forEach((t) => {
    const jenis = t.tipe_landmark?.trim() || "Lainnya";
    counts[jenis] = (counts[jenis] || 0) + 1;
  });

  return counts;
}

function updateLandmarkCountDisplay(counts) {
  const container = document.getElementById("landmark-info");
  if (!container) return;

  const batasWilkerstatList = ["Batas SLS", "Batas Segmen"];

  const buildList = (list) => {
    return list
      .map((jenis) => {
        if (!counts[jenis]) return "";
        const icon = ikonLandmark[jenis]?.icon || "❓";
        const color = ikonLandmark[jenis]?.color || "#999";
        const jumlah = counts[jenis];
        return `<li><span class="landmark-icon" style="color:${color}">${icon}</span> ${jenis}: ${jumlah}</li>`;
      })
      .join("");
  };

  // Buat bagian Batas Wilkerstat
  let batasHTML = buildList(batasWilkerstatList);
  batasHTML = batasHTML
    ? `
    <div class="landmark-group">
      <div class="landmark-category">Batas Wilkerstat</div>
      <ul>${batasHTML}</ul>
    </div>`
    : "";

  // Buat bagian Wilayah Konsentrasi Ekonomi (sisanya)
  const ekonomiList = Object.keys(counts).filter(
    (jenis) => !batasWilkerstatList.includes(jenis)
  );
  let ekonomiHTML = buildList(ekonomiList);
  ekonomiHTML = ekonomiHTML
    ? `
    <div class="landmark-group">
      <div class="landmark-category">Wilayah Konsentrasi Ekonomi</div>
      <ul>${ekonomiHTML}</ul>
    </div>`
    : "";

  container.innerHTML = `<h4>Jumlah Landmark</h4>${batasHTML}${ekonomiHTML}`;
}
