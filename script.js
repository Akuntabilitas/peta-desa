// --- PETA DAN TILE LAYER ---
const map = L.map("map", {
  zoomControl: false
}).setView([-7.5, 110.6], 10);
L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  { attribution: "Tiles © Esri" }
).addTo(map);

// --- VARIABEL GLOBAL ---
let geojsonData = { kecamatan: null, desa: null, sls: null };
let geojsonSLSReady = false;
let muatanCSVReady = false;
let muatanData = [];
let muatanByKode = {}; // kdkec+kddesa+kdsls -> record
let currentGeojsonLayer = null;
let slsLayerGroup = null; // assigned by createSLSLayer(...)
let currentLevel = "kab";
// --- INDEXEDDB CACHE (unchanged) ---
const DB_NAME = "geojson-cache";
const STORE_NAME = "geojson";
const DB_VERSION = 1;

map.on("popupopen", function (e) {
  console.log("Popup opened", e);
  const popupNode = e.popup.getElement();
  const layer = e.popup._source;

  if (!popupNode) {
    console.warn("Popup element not found!");
    return;
  }
  if (!layer) {
    console.warn("Popup source layer not found!");
    return;
  }
  const btnGoogle = popupNode.querySelector(".btnGoogleMaps");
});

document.body.addEventListener("click", function (e) {
  if (e.target.classList.contains("btnGoogleMaps")) {
    e.stopPropagation();
    console.log("Google Maps clicked by delegation");
    const lat = e.target.getAttribute("data-lat");
    const lng = e.target.getAttribute("data-lng");
    if (lat && lng) {
      const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
      window.open(url, "_blank");
    } else {
      console.warn("Data lat/lng tidak ditemukan pada tombol");
    }
  }
});

function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject("Gagal membuka IndexedDB");
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

function fetchGeoJSONWithCache(key, url) {
  return openIndexedDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const getRequest = store.get(key);
      getRequest.onsuccess = async () => {
        if (getRequest.result) {
          resolve(JSON.parse(getRequest.result));
        } else {
          try {
            const response = await fetch(url);
            const data = await response.json();
            const tx2 = db.transaction(STORE_NAME, "readwrite");
            const store2 = tx2.objectStore(STORE_NAME);
            store2.put(JSON.stringify(data), key);
            resolve(data);
          } catch (err) {
            reject(err);
          }
        }
      };
      getRequest.onerror = () => reject("Gagal mengambil dari IndexedDB");
    });
  });
}

// --- PARSING CSV MUATAN (dari Google Sheets) ---
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTZIQJPaTNA5rhW7_glGbrJLQh9bS0ciL_A866bG5VKEbkiIMjavCIWnC3Ia0rytlMadjzc8KovSXm5/pub?output=csv";

Papa.parse(CSV_URL, {
  download: true,
  header: true,
  skipEmptyLines: true,
  complete: (results) => {
    muatanData = results.data.map((row) => {
      const idSLS = (row["ID SLS"] || "").trim();
      const kdkec = idSLS.substring(4, 7);
      const kddesa = idSLS.substring(7, 10);
      const kdsls = idSLS.substring(10, 14);
      const kodeKey = `${kdkec}${kddesa}${kdsls}`;
      const record = {
        idSLS,
        namaSLS: row["Nama SLS"] || "",
        namaDesa: row["Desa"] || "",
        namaKec: row["Kecamatan"] || "",
        // keep numeric fields as numbers
        totalMuatan: parseFloat(row["Total Muatan"]) || 0,
        muatanKK: parseFloat(row["Perkiraan Jumlah Muatan KK (Keluarga)"]) || 0,
        jumlahBTT: parseFloat(row["Jumlah BTT"]) || 0,
        jumlahBTTKosong: parseFloat(row["Jumlah BTT Kosong"]) || 0,
        jumlahBKU: parseFloat(row["Jumlah BKU"]) || 0,
        jumlahBBTT: parseFloat(row["Jumlah BBTT Non Usaha"]) || 0,
        muatanUsaha: parseFloat(row["Perkiraan Jumlah Muatan Usaha"]) || 0,
        // keep original status string but we'll normalize when checking
        statusLKM: row["Status LKM"] || "",
        namapml: row["Nama Pengawas"] || "",
        namappl: row["Nama Petugas"] || "",
      };
      muatanByKode[kodeKey] = record;
      return record;
    });

    muatanCSVReady = true;
    if (geojsonSLSReady) renderLevelAwal();
  },
});

// --- LOAD GEOJSON (with cache) ---
(async () => {
  try {
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
    geojsonSLSReady = true;
    if (muatanCSVReady) renderLevelAwal();
  } catch (err) {
    console.error("Gagal load geojson:", err);
  }
})();

// ---------------------------
// UTILITY: color gradient
// ---------------------------
// returns rgb string given value and optional min/max range
function getColorGradient(value, minVal = 0, maxVal = 100) {
  if (typeof value !== "number" || isNaN(value)) value = 0;
  // avoid division by zero
  if (maxVal === minVal) {
    // single value → return middle green
    return "rgb(0,200,0)";
  }
  const ratio = Math.min(Math.max((value - minVal) / (maxVal - minVal), 0), 1);
  const r = Math.round(255 * ratio); // more value => more red
  const g = Math.round(255 * (1 - ratio)); // more value => less green
  return `rgb(${r},${g},0)`;
}

// ---------------------------
// CREATE SLS LAYER (sets layer._kodeKey)
// ---------------------------
function createSLSLayer(filterParams = {}) {
  return L.geoJSON(geojsonData.sls, {
    filter: (f) => {
      const { kdkec, kddesa } = filterParams;
      const matchKec = !kdkec || f.properties.kdkec === kdkec;
      const matchDesa = !kddesa || f.properties.kddesa === kddesa;
      return matchKec && matchDesa;
    },
    style: {
      fillColor: "#fff",
      weight: 1,
      color: "black",
      fillOpacity: 0.7,
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties || {};
      const kodeKey = `${p.kdkec}${p.kddesa}${p.kdsls}`;
      layer._kodeKey = kodeKey;

      const d = muatanByKode[kodeKey];
      let tip = `<b>
  ${p.nmdesa || "-"}, ${p.nmkec || "-"}<br/>
  ${p.nmsls || "-"}</b><br/>`;
      if (d) {
        tip += `
  <table style="border-collapse: collapse; font-size: 13px;">
    <tr>
      <td style="width: 80px; text-align: left; white-space: nowrap;">Status LKM</td>
      <td style="width: 10px; text-align: center;">:</td>
      <td>${d.statusLKM || "-"}</td>
    </tr>
    <tr>
      <td style="width: 80px; text-align: left; white-space: nowrap;">Pengawas</td>
      <td style="width: 10px; text-align: center;">:</td>
      <td>${d.namapml || "-"}</td>
    </tr>
    <tr>
      <td style="width: 80px; text-align: left; white-space: nowrap;">Petugas</td>
      <td style="width: 10px; text-align: center;">:</td>
      <td>${d.namappl || "-"}</td>
    </tr>
  </table>
`;
      } else {
        tip += `Tidak ada data CSV`;
      }
      layer.bindTooltip(tip, { sticky: true });
      let lat = 0,
        lng = 0;
      if (feature.geometry) {
        // Jika tipe Point
        if (feature.geometry.type === "Point") {
          lat = feature.geometry.coordinates[1];
          lng = feature.geometry.coordinates[0];
        } else {
          // Untuk tipe Polygon/MultiPolygon, hitung center bounds
          const layerBounds = layer.getBounds ? layer.getBounds() : null;
          if (layerBounds) {
            const center = layerBounds.getCenter();
            lat = center.lat;
            lng = center.lng;
          }
        }
      }

      const popupContent = `
  <div>
    <b>
    ${p.nmdesa || "-"},${p.nmkec || "-"}<br/>
    ${p.nmsls || "-"}</b><br/>

    <table style="border-collapse: collapse; font-size: 13px; margin-bottom: 6px;">
      <tr>
        <td style="width: 120px; text-align: left; white-space: nowrap;">${legendLabels.totalMuatan}</td>
        <td style="width: 10px; text-align: center;">:</td>
        <td style="text-align: right;">${d.totalMuatan ?? "-"}</td>
      </tr>
      <tr>
        <td style="width: 120px; text-align: left; white-space: nowrap;">${legendLabels.muatanKK}</td>
        <td style="width: 10px; text-align: center;">:</td>
        <td style="text-align: right;">${d.muatanKK ?? "-"}</td>
      </tr>
      <tr>
        <td style="width: 120px; text-align: left; white-space: nowrap;">${legendLabels.jumlahBTT}</td>
        <td style="width: 10px; text-align: center;">:</td>
        <td style="text-align: right;">${d.jumlahBTT ?? "-"}</td>
      </tr>
      <tr>
        <td style="width: 120px; text-align: left; white-space: nowrap;">${legendLabels.jumlahBTTKosong}</td>
        <td style="width: 10px; text-align: center;">:</td>
        <td style="text-align: right;">${d.jumlahBTTKosong ?? "-"}</td>
      </tr>
      <tr>
        <td style="width: 120px; text-align: left; white-space: nowrap;">${legendLabels.jumlahBKU}</td>
        <td style="width: 10px; text-align: center;">:</td>
        <td style="text-align: right;">${d.jumlahBKU ?? "-"}</td>
      </tr>
      <tr>
        <td style="width: 120px; text-align: left; white-space: nowrap;">${legendLabels.jumlahBBTT}</td>
        <td style="width: 10px; text-align: center;">:</td>
        <td style="text-align: right;">${d.jumlahBBTT ?? "-"}</td>
      </tr>
      <tr>
        <td style="width: 120px; text-align: left; white-space: nowrap;">${legendLabels.muatanUsaha}</td>
        <td style="width: 10px; text-align: center;">:</td>
        <td style="text-align: right;">${d.muatanUsaha ?? "-"}</td>
      </tr>
    </table>

    <button class="btnGoogleMaps" data-lat="${lat}" data-lng="${lng}">Lihat di Google Maps</button>
  </div>
`;

      layer.bindPopup(popupContent);

            layer.on({
        mouseover: (e) => {
          const layer = e.target;
          layer.setStyle({
            weight: 3,
            color: '#3388ff',
          });
          // Bawa layer ke depan supaya jelas (opsional)
          if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            layer.bringToFront();
          }
        },
        mouseout: (e) => {
          const layer = e.target;
          // Kembalikan style semula
          layer.setStyle({
            weight: 1,
            color: "black",
         });
        }
      });
    },
  });
}

// Event handler untuk tombol popup, pasang sekali di map global:

// ---------------------------
// UPDATE WARNA SLS BERDASARKAN DROPDOWN / LEVEL
// - Picks field from #kolomWarna
// - Computes min/max from visible SLS (excluding status 'belum')
// - Applies: no CSV -> white, status 'belum' -> grey, else gradient
// ---------------------------
function updateWarnaSLSBerdasarkanMuatan() {
  if (!slsLayerGroup || !muatanCSVReady) return;

  const field = document.querySelector("#kolomWarnaBar .warna-item.active")?.dataset.value || "totalMuatan";

  // Collect numeric values from visible SLS layers excluding status 'belum'
  const values = [];
  slsLayerGroup.eachLayer((layer) => {
    const kodeKey = layer._kodeKey;
    const data = muatanByKode[kodeKey];
    if (!data) return;
    const status = (data.statusLKM || "").toString().trim().toLowerCase();
    if (status === "belum") return; // exclude from scale
    const v = parseFloat(data[field]);
    if (!isNaN(v)) values.push(v);
  });

  const min = 0;
  const max = values.length ? Math.max(...values) : min;

  // apply style per-layer
  slsLayerGroup.eachLayer((layer) => {
    const kodeKey = layer._kodeKey;
    const data = muatanByKode[kodeKey];

    let fillColor = "#fff"; // default white (no CSV)
    if (!data) {
      fillColor = "#fff";
    } else {
      const status = (data.statusLKM || "").toString().trim().toLowerCase();
      if (status === "belum") {
        fillColor = "#cccccc"; // grey for belum
      } else {
        // try numeric
        const v = parseFloat(data[field]);
        if (isNaN(v)) {
          fillColor = "#fff";
        } else {
          fillColor = getColorGradient(v, min, max);
        }
      }
    }

    layer.setStyle({
      fillColor,
      fillOpacity: currentLevel === "desa" ? 0.2 : 0.9,
      color: currentLevel === "desa" ? "black" : "rgba(204, 204, 204, 0.3)",
      weight: 1,
    });
  });
  // Tambahkan legend & label
  // Legend selalu tampil
  addDynamicLegend(field, min, max);

  // Label hanya muncul jika level desa
if ((currentLevel === "desa" || currentLevel === "kec")) {
  updateSLSLabels(field);
  } else {
    // hapus semua label jika bukan desa
    map.eachLayer((layer) => {
      if (
        layer instanceof L.Tooltip &&
        layer.options.className === "sls-label"
      ) {
        map.removeLayer(layer);
      }
    });
  }
}

// ---------------------------
// RENDER LEVEL AWAL (kabupaten view)
// ---------------------------
function renderLevelAwal(fieldMuatan = "totalMuatan") {
  currentLevel = "kab";
  slsLabelLayer.clearLayers();
  if (currentGeojsonLayer) map.removeLayer(currentGeojsonLayer);

  // create sls layer and save to global variable
  slsLayerGroup = createSLSLayer({});
  const desaLayer = L.geoJSON(geojsonData.desa, {
    style: { color: "#555555", weight: 0.5, fillOpacity: 0 },
  });
  const kecLayer = L.geoJSON(geojsonData.kecamatan, {
    style: { color: "rgba(0,0,0,0.4)", weight: 1, fillOpacity: 0 },
    onEachFeature: (feature, layer) => {
      layer.bindTooltip(`${feature.properties.nmkec}`);
      layer.on("click", () => {
        // zoom to kecamatan level (shows desa + SLS inside)
        zoomKeKecamatan(feature.properties.kdkec);
      });
    },
  });

  currentGeojsonLayer = L.featureGroup([
    slsLayerGroup,
    desaLayer,
    kecLayer,
  ]).addTo(map);

  // safe fit bounds
  const bounds = currentGeojsonLayer.getBounds();
  if (bounds && bounds.isValid && bounds.isValid()) map.fitBounds(bounds);

  // apply colors according to dropdown
  updateWarnaSLSBerdasarkanMuatan();
  updateNavbar("kab");
  document.getElementById("filterContainer").style.display = "none";
}

// ---------------------------
// ZOOM KE KECAMATAN
// ---------------------------
function zoomKeKecamatan(kdkec) {
  currentLevel = "kec";
  if (currentGeojsonLayer) map.removeLayer(currentGeojsonLayer);

  // --- Buat SLS layer tapi non-interaktif
  slsLayerGroup = createSLSLayer({ kdkec });

  // --- Layer kecamatan (garis tebal, di bawah desa)
  const kecLayer = L.geoJSON(geojsonData.kecamatan, {
    filter: (f) => f.properties.kdkec === kdkec,
    style: { color: "black", weight: 2, fillOpacity: 0 },
  });

  // --- Layer desa (klik aktif)
  const desaLayer = L.geoJSON(geojsonData.desa, {
    filter: (f) => f.properties.kdkec === kdkec,
    style: { color: "black", weight: 0.5, fillOpacity: 0 },
    onEachFeature: (feature, layer) => {
      layer.bindTooltip(`${feature.properties.nmdesa}`);
      layer.on("click", () => {
        zoomKeDesa(feature.properties.kdkec, feature.properties.kddesa);
      });
    },
  });

  // Urutan: SLS → Kecamatan → Desa (desa terakhir supaya klik aktif)
  currentGeojsonLayer = L.featureGroup([
    slsLayerGroup,
    kecLayer,
    desaLayer,
  ]).addTo(map);

  // Zoom ke area kecamatan
  const bounds = currentGeojsonLayer.getBounds();
  if (bounds && bounds.isValid && bounds.isValid()) {
    map.fitBounds(bounds);
  }

  // Update warna SLS
  updateWarnaSLSBerdasarkanMuatan();
  updateNavbar("kec", kdkec);
}

// ---------------------------
// ZOOM KE DESA
// ---------------------------
function zoomKeDesa(kdkec, kddesa) {
  currentLevel = "desa";
  if (currentGeojsonLayer) map.removeLayer(currentGeojsonLayer);

  slsLayerGroup = createSLSLayer({ kdkec, kddesa });

  const desaLayer = L.geoJSON(geojsonData.desa, {
    filter: (f) =>
      f.properties.kdkec === kdkec && f.properties.kddesa === kddesa,
    style: { color: "black", weight: 0.5, fillOpacity: 0 },
    interactive: false,
  });

  const kecLayer = L.geoJSON(geojsonData.kecamatan, {
    filter: (f) => f.properties.kdkec === kdkec,
    style: { color: "black", weight: 1, fillOpacity: 0 },
    interactive: false,
  });

  currentGeojsonLayer = L.featureGroup([
    desaLayer,
    kecLayer,
    slsLayerGroup,
  ]).addTo(map);
  const bounds = desaLayer.getBounds();
  if (bounds && bounds.isValid && bounds.isValid()) map.fitBounds(bounds);

  updateWarnaSLSBerdasarkanMuatan();
  updateNavbar("desa", kdkec, kddesa);
}

// ---------------------------
// RENDER SLS DARI HASIL FILTER PERIKSA
// ---------------------------
function renderLevelFilteredSLS(hasilFilter) {
  if (currentGeojsonLayer) map.removeLayer(currentGeojsonLayer);

  // kec layer for context
  const kecLayer = L.geoJSON(geojsonData.kecamatan, {
    style: { color: "black", weight: 1, fillOpacity: 0 },
    onEachFeature: (feature, layer) => {
      layer.bindTooltip(`Kecamatan ${feature.properties.nmkec}`, {
        permanent: false,
      });
    },
  });

  // build sls layer from filter; ensure _kodeKey set in onEachFeature
  const slsFilteredLayer = L.geoJSON(hasilFilter, {
    style: {
      weight: 1,
      color: "black",
      fillOpacity: 0.2,
    },
    onEachFeature: (feature, layer) => {
      const kodeKey = `${feature.properties.kdkec}${feature.properties.kddesa}${feature.properties.kdsls}`;
      layer._kodeKey = kodeKey;

      const data = muatanByKode[kodeKey] || {};
      const tooltipContent = `
    <b>
    ${data.namaDesa || "-"}, ${data.namaKec || "-"}</br>
    ${data.namaSLS || "-"}</b><br>
    <table style="border-collapse: collapse; font-size: 13px;">
    <tr>
      <td style="width: 80px; text-align: left; white-space: nowrap;">Status LKM</td>
      <td style="width: 10px; text-align: center;">:</td>
      <td>${data.statusLKM || "-"}</td>
    </tr>
    <tr>
      <td style="width: 80px; text-align: left; white-space: nowrap;">Pengawas</td>
      <td style="width: 10px; text-align: center;">:</td>
      <td>${data.namapml || "-"}</td>
    </tr>
    <tr>
      <td style="width: 80px; text-align: left; white-space: nowrap;">Petugas</td>
      <td style="width: 10px; text-align: center;">:</td>
      <td>${data.namappl || "-"}</td>
    </tr>
  </table>
  `;
      layer.bindTooltip(tooltipContent, { sticky: true });

      // Tambahkan popup dengan tombol:
      const kdkec = feature.properties.kdkec;
      const kddesa = feature.properties.kddesa;

      // Dapatkan center dari geometry feature:
      let lat = 0,
        lng = 0;
      if (feature.geometry) {
        // Jika tipe Point
        if (feature.geometry.type === "Point") {
          lat = feature.geometry.coordinates[1];
          lng = feature.geometry.coordinates[0];
        } else {
          // Untuk tipe Polygon/MultiPolygon, hitung center bounds
          const layerBounds = layer.getBounds ? layer.getBounds() : null;
          if (layerBounds) {
            const center = layerBounds.getCenter();
            lat = center.lat;
            lng = center.lng;
          }
        }
      }

const popupContent = `
  <div>
    <b>
    ${data.namaDesa || "-"},${data.namaKec || "-"} <br/>
    ${data.namaSLS || "-"}</b><br/>

    <table style="border-collapse: collapse; font-size: 13px; margin-bottom: 6px;">
      <tr>
        <td style="width: 120px; text-align: left; white-space: nowrap;">${legendLabels.totalMuatan}</td>
        <td style="width: 10px; text-align: center;">:</td>
        <td style="text-align: right;">${data.totalMuatan ?? "-"}</td>
      </tr>
      <tr>
        <td style="width: 120px; text-align: left; white-space: nowrap;">${legendLabels.muatanKK}</td>
        <td style="width: 10px; text-align: center;">:</td>
        <td style="text-align: right;">${data.muatanKK ?? "-"}</td>
      </tr>
      <tr>
        <td style="width: 120px; text-align: left; white-space: nowrap;">${legendLabels.jumlahBTT}</td>
        <td style="width: 10px; text-align: center;">:</td>
        <td style="text-align: right;">${data.jumlahBTT ?? "-"}</td>
      </tr>
      <tr>
        <td style="width: 120px; text-align: left; white-space: nowrap;">${legendLabels.jumlahBTTKosong}</td>
        <td style="width: 10px; text-align: center;">:</td>
        <td style="text-align: right;">${data.jumlahBTTKosong ?? "-"}</td>
      </tr>
      <tr>
        <td style="width: 120px; text-align: left; white-space: nowrap;">${legendLabels.jumlahBKU}</td>
        <td style="width: 10px; text-align: center;">:</td>
        <td style="text-align: right;">${data.jumlahBKU ?? "-"}</td>
      </tr>
      <tr>
        <td style="width: 120px; text-align: left; white-space: nowrap;">${legendLabels.jumlahBBTT}</td>
        <td style="width: 10px; text-align: center;">:</td>
        <td style="text-align: right;">${data.jumlahBBTT ?? "-"}</td>
      </tr>
      <tr>
        <td style="width: 120px; text-align: left; white-space: nowrap;">${legendLabels.muatanUsaha}</td>
        <td style="width: 10px; text-align: center;">:</td>
        <td style="text-align: right;">${data.muatanUsaha ?? "-"}</td>
      </tr>
    </table>

    <button class="btnGoogleMaps" data-lat="${lat}" data-lng="${lng}">Lihat di Google Maps</button>
  </div>
`;
      layer.bindPopup(popupContent);

      
            layer.on({
        mouseover: (e) => {
          const layer = e.target;
          layer.setStyle({
            weight: 3,
            color: '#3388ff',
          });
          // Bawa layer ke depan supaya jelas (opsional)
          if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            layer.bringToFront();
          }
        },
        mouseout: (e) => {
          const layer = e.target;
          // Kembalikan style semula
          layer.setStyle({
            weight: 1,
            color: "black",
         });
        }
      });

      layer.on("click", () => {
        layer.openPopup();
      });
    },
  });

  // set slsLayerGroup to this filtered set so updateWarna can color them
  slsLayerGroup = slsFilteredLayer;

  currentGeojsonLayer = L.featureGroup([kecLayer, slsFilteredLayer]).addTo(map);
  const bounds = currentGeojsonLayer.getBounds();
  if (bounds && bounds.isValid && bounds.isValid()) map.fitBounds(bounds);
 currentLevel = "desa";
  updateWarnaSLSBerdasarkanMuatan();
}

// ---------------------------
// PERIKSA MUATAN (search) - cleaned
// ---------------------------
document.getElementById("btnLanjutPeriksa").addEventListener("click", () => {
  periksaMuatan();
});

const listHasil = document.getElementById("listHasil");

function periksaMuatan() {
  const varA = document.getElementById("varA").value;
  const operator = document.getElementById("operator").value;
  const angkakali = parseFloat(document.getElementById("angkakali").value) || 1;
  const angka1 = parseFloat(document.getElementById("angka1").value);
  const angka2Key = document.getElementById("angka2Select").value;

  if (!varA || !operator) {
    alert("Kolom dan operator harus dipilih.");
    return;
  }

  const hasilFilter = geojsonData.sls.features.filter((feature) => {
    const props = feature.properties;
    const kode = `${props.kdkec}${props.kddesa}${props.kdsls}`;
    const muatan = muatanByKode[kode];
    if (!muatan) return false;
    // status must be 'Selesai' (case-insensitive)
    const status = (muatan.statusLKM || "").toString().trim().toLowerCase();
    if (status !== "selesai") return false;

    const a = parseFloat(muatan[varA]);
    const b = angka2Key ? parseFloat(muatan[angka2Key]) : angka1;

    if (isNaN(a) || isNaN(b)) return false;
    const pembanding = angkakali * b;

    switch (operator) {
      case "=":
        return a === pembanding;
      case ">":
        return a > pembanding;
      case "<":
        return a < pembanding;
      case ">=":
        return a >= pembanding;
      case "<=":
        return a <= pembanding;
      case "!=":
        return a !== pembanding;
      default:
        return false;
    }
  });

  // render resulting SLS features
  renderLevelFilteredSLS({
    type: "FeatureCollection",
    features: hasilFilter,
  });

  // info
  const varAName = varA.replace(/([A-Z])/g, " $1");
  const rumus = `${varAName} ${operator} ${angkakali} × (${
    angka2Key || angka1
  })`;
  document.getElementById("infoFilter").innerHTML = `<b>Kondisi:</b> ${rumus}`;
  // list results
  renderListHasil(hasilFilter);
  document.getElementById("filterContainer").style.display = "block";
}

// helper to render the list of hits
function renderListHasil(features) {
  const list = document.getElementById("listHasil");
  list.innerHTML = "";

  // header
  const header = document.createElement("div");
  header.className = "listRow header";
  header.innerHTML = `
    <div class="cell">#</div>
    <div class="cell">Kecamatan</div>
    <div class="cell">Desa</div>
    <div class="cell">Nama SLS</div>
    <div class="cell">Muatan</div>
    <div class="cell">KK</div>
    <div class="cell">BTT</div>
    <div class="cell">BTTK</div>
    <div class="cell">BKU</div>
    <div class="cell">BBTT NU</div>
    <div class="cell">Usaha</div>
  `;
  list.appendChild(header);

  features.forEach((f, i) => {
    const kode = `${f.properties.kdkec}${f.properties.kddesa}${f.properties.kdsls}`;
    const muatan = muatanByKode[kode];
    if (!muatan) return;

    const item = document.createElement("li");
    item.innerHTML = `
      <div class="listRow clickable">
        <div class="cell">${i + 1}</div>
        <div class="cell">${muatan.namaKec}</div>
        <div class="cell">${muatan.namaDesa}</div>
        <div class="cell">${muatan.namaSLS}</div>
        <div class="cell">${muatan.totalMuatan}</div>
        <div class="cell">${muatan.muatanKK}</div>
        <div class="cell">${muatan.jumlahBTT}</div>
        <div class="cell">${muatan.jumlahBTTKosong}</div>
        <div class="cell">${muatan.jumlahBKU}</div>
        <div class="cell">${muatan.jumlahBBTT}</div>
        <div class="cell">${muatan.muatanUsaha}</div>
      </div>
    `;
    item.querySelector(".listRow").addEventListener("click", (e) => {
      e.preventDefault();
      const bounds = L.geoJSON(f).getBounds();
      if (bounds && bounds.isValid && bounds.isValid()) map.fitBounds(bounds);
    });

    list.appendChild(item);
  });

  document.getElementById(
    "infoFilter"
  ).innerHTML += `<br><span style="color: #007bff;">Ditemukan ${features.length} SLS</span>`;
}

// reset handler
document.getElementById("btnReset").addEventListener("click", () => {
  document.getElementById("varA").value = "";
  document.getElementById("operator").value = "=";
  document.getElementById("angkakali").value = 1;
  document.getElementById("angka1").value = "";
  document.getElementById("angka2Select").value = "";

  document.getElementById("infoFilter").innerHTML = "";
  document.getElementById("listHasil").innerHTML = "";

  renderLevelAwal();
});
// ---------------------------
// INITIAL RENDER WHEN DATA READY
// ---------------------------
// renderLevelAwal is called when both CSV and GEOJSON ready (see parser & loader above)

// End of script

let legendControl;

function addDynamicLegend(field, min, max) {
  const legendTitle = legendLabels[field] || field;
  if (legendControl) {
    map.removeControl(legendControl);
  }

  legendControl = L.control({ position: "bottomleft" });

  legendControl.onAdd = function () {
    const div = L.DomUtil.create("div", "legend");
    div.innerHTML = `<h4>${legendTitle}</h4>`;
    const grades = 8; // jumlah step legend
    for (let i = 0; i <= grades; i++) {
      const val = min + (i * (max - min)) / grades;
      const color = getColorGradient(val, min, max);
      div.innerHTML += `
        <i style="background:${color}"></i>
        ${val.toFixed(0)}${
        i < grades
          ? "&ndash;" + (min + ((i + 1) * (max - min)) / grades).toFixed(0)
          : "+"
      }<br>
      `;
    }
    div.innerHTML += `<i style="background:#ccc"></i> Status LKM Belum`;
    return div;
  };

  legendControl.addTo(map);
}

// Layer group khusus untuk label SLS
// Layer group khusus untuk label SLS
let slsLabelLayer = L.layerGroup().addTo(map);

function updateSLSLabels(field) {
  if (!slsLayerGroup) return;

  // Bersihkan semua label lama
  slsLabelLayer.clearLayers();

  slsLayerGroup.eachLayer((layer) => {
    const kodeKey = layer._kodeKey;
    const data = muatanByKode[kodeKey];
    const val = parseFloat(data?.[field]) || 0;
    const statusLKM = (data?.statusLKM || "").trim().toLowerCase();

    if (statusLKM !== "belum" && !isNaN(val)) {
      const center = layer.getBounds().getCenter();
      const label = L.tooltip({
        permanent: true,
        direction: "center",
        className: "sls-label bg-label",
      })
        .setContent(val.toFixed(0))
        .setLatLng(center);

      slsLabelLayer.addLayer(label);
    }
  });

  // Panggil pengecekan pertama kali setelah membuat label
  toggleSLSLabelsByZoom();
}

// Fungsi untuk hide/show label berdasarkan zoom
function toggleSLSLabelsByZoom() {
  if (map.getZoom() < 15) {
    map.removeLayer(slsLabelLayer);
  } else {
    if (!map.hasLayer(slsLabelLayer)) {
      map.addLayer(slsLabelLayer);
    }
  }
}

// Event listener untuk cek setiap kali zoom berubah
map.on("zoomend", toggleSLSLabelsByZoom);



// Mapping untuk label legenda
const legendLabels = {
  totalMuatan: "Total Muatan",
  muatanKK: "Muatan KK",
  jumlahBTT: "Jumlah BTT",
  jumlahBTTKosong: "BTT Kosong",
  jumlahBKU: "BKU",
  jumlahBBTT: "BBTT Non Usaha",
  muatanUsaha: "Muatan Usaha",
};

const inputKoordinat = document.getElementById("inputKoordinat");
const btnCari = document.getElementById("btnCari");
let markerCari = null;

function resetCari() {
  if (markerCari) {
    map.removeLayer(markerCari);
    markerCari = null;
  }
  inputKoordinat.value = "";
  btnCari.querySelector(".material-icons").textContent = "search";
}

function cariKoordinat() {
  const val = inputKoordinat.value.trim();
  if (!val) return;

  // Parsing format lat,lng
  const parts = val.split(",");
  if (parts.length !== 2) {
    alert("Masukkan koordinat dengan format: lat,lng");
    return;
  }

  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);

  if (isNaN(lat) || isNaN(lng)) {
    alert("Koordinat tidak valid!");
    return;
  }

  if (markerCari) {
    map.removeLayer(markerCari);
  }

  markerCari = L.marker([lat, lng]).addTo(map);
  // Tidak mengubah zoom/pusat map sesuai permintaan

  btnCari.querySelector(".material-icons").textContent = "close";
}

btnCari.addEventListener("click", () => {
  const icon = btnCari.querySelector(".material-icons").textContent;
  if (icon === "search") {
    cariKoordinat();
  } else if (icon === "close") {
    resetCari();
  }
});

inputKoordinat.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const icon = btnCari.querySelector(".material-icons").textContent;
    if (icon === "search") {
      cariKoordinat();
    } else if (icon === "close") {
      resetCari();
    }
  }
});

// Variabel global untuk menyimpan nama wilayah
function updateNavbar(level, kdkec = "", kddesa = "") {
  let html = "";

  if (level === "kab") {
    html = `<span>KAB BOYOLALI</span>`;
  }

  if (level === "kec") {
    const kec = geojsonData.kecamatan.features.find(f => f.properties.kdkec === kdkec);
    const namaKec = kec ? kec.properties.nmkec : kdkec;

    html = `
      <a href="javascript:void(0)" onclick="renderLevelAwal()">KAB BOYOLALI</a>
      <span class="separator">></span>
      <span>${namaKec}</span>
    `;
  }

  if (level === "desa") {
    const kec = geojsonData.kecamatan.features.find(f => f.properties.kdkec === kdkec);
    const namaKec = kec ? kec.properties.nmkec : kdkec;

    const desa = geojsonData.desa.features.find(f => 
      f.properties.kdkec === kdkec && f.properties.kddesa === kddesa
    );
    const namaDesa = desa ? desa.properties.nmdesa : kddesa;

    html = `
      <a href="javascript:void(0)" onclick="renderLevelAwal()">KAB BOYOLALI</a>
      <span class="separator">></span>
      <a href="javascript:void(0)" onclick="zoomKeKecamatan('${kdkec}')">${namaKec}</a>
      <span class="separator">></span>
      <span>${namaDesa}</span>
    `;
  }

  document.getElementById("breadcrumb").innerHTML = html;
}

// init klik/keyboard untuk kolom warna bar
document.querySelectorAll("#kolomWarnaBar .warna-item").forEach(item => {
  const activate = () => {
    // hapus active
    document.querySelectorAll("#kolomWarnaBar .warna-item").forEach(i => i.classList.remove("active"));
    // set active
    item.classList.add("active");
    // ambil field dan panggil update warna
    const field = item.dataset.value || "totalMuatan";
    updateWarnaSLSBerdasarkanMuatan(field);
  };

  item.addEventListener("click", activate);

  // keyboard accessibility (Enter / Space)
  item.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  });
});

