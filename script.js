const map = L.map("map").setView([-7.531, 110.595], 10);

// Basemap
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap",
}).addTo(map);

// Variabel global
let currentLevel = "kecamatan";
let currentKode = null;
let geojsonLayers = {
  kecamatan: null,
  desa: null,
  sls: null,
};
let isTransitioning = false;

// Style umum
const baseStyle = {
  color: "#000",
  weight: 1,
  opacity: 1,
  fillOpacity: 0.3,
};

const hoverStyle = {
  weight: 2,
  fillOpacity: 0.6,
};

// Fungsi debounce klik
function handleClick(callback) {
  if (isTransitioning) return;
  isTransitioning = true;
  callback();
  setTimeout(() => (isTransitioning = false), 800);
}

// Fungsi set level untuk atur label
function setLevel(level) {
  currentLevel = level;
  document.body.className = `level-${level}`;
}

// Fungsi load data GeoJSON
async function loadGeojson(url, kodeFilter, propKode) {
  const res = await fetch(url);
  const data = await res.json();

  if (!kodeFilter) return data;

  return {
    ...data,
    features: data.features.filter(
      (f) => f.properties[propKode] === kodeFilter
    ),
  };
}

// Fungsi tambah layer dengan style dan label
function addLayer(data, level, labelProp, kodeProp, nextLevelFn) {
  const layer = L.geoJSON(data, {
    style: baseStyle,
    onEachFeature: (feature, layer) => {
      layer.on({
        mouseover: () => layer.setStyle(hoverStyle),
        mouseout: () => layer.setStyle(baseStyle),
        click: (e) => {
          e.originalEvent.stopPropagation();
          handleClick(() => nextLevelFn(feature));
        },
      });

      setTimeout(() => {
        const label = feature.properties[labelProp];
        const levelClass = `label label-${level}`;
        layer.bindTooltip(label, {
          permanent: true,
          direction: "center",
          className: levelClass,
        });
      }, 100);
    },
  }).addTo(map);

  geojsonLayers[level] = layer;
  map.flyToBounds(layer.getBounds(), { duration: 0.8 });
}

// Muat peta awal: kecamatan
(async () => {
  setLevel("kecamatan");

  const data = await loadGeojson("data/final_kec_202413309.geojson");
  addLayer(data, "kecamatan", "nmkec", "kdkec", async (feature) => {
    currentKode = feature.properties.kdkec;
    geojsonLayers.kecamatan.remove();
    setLevel("desa");

    const desaData = await loadGeojson(
      "data/final_desa_202413309.geojson",
      currentKode,
      "kdkec"
    );

    addLayer(desaData, "desa", "nmdesa", "kddesa", async (feature) => {
      currentKode = feature.properties.kddesa;
      geojsonLayers.desa.remove();
      setLevel("sls");

      const slsData = await loadGeojson(
        "data/final_sls_202413309.geojson",
        currentKode,
        "kddesa"
      );

      addLayer(slsData, "sls", "nmsls", "kdsls", () => {});
    });
  });
})();

// Tombol kembali
document
  .getElementById("backButton")
  .addEventListener("click", async () => {
    if (currentLevel === "sls") {
      geojsonLayers.sls.remove();
      setLevel("desa");

      const desaData = await loadGeojson(
        "data/final_desa_202413309.geojson",
        currentKode.substring(0, 6), // ambil kode kecamatan
        "kdkec"
      );

      addLayer(desaData, "desa", "nmdesa", "kddesa", async (feature) => {
        currentKode = feature.properties.kddesa;
        geojsonLayers.desa.remove();
        setLevel("sls");

        const slsData = await loadGeojson(
          "data/final_sls_202413309.geojson",
          currentKode,
          "kddesa"
        );

        addLayer(slsData, "sls", "nmsls", "kdsls", () => {});
      });
    } else if (currentLevel === "desa") {
      geojsonLayers.desa.remove();
      setLevel("kecamatan");

      const data = await loadGeojson("data/final_kec_202413309.geojson");
      addLayer(data, "kecamatan", "nmkec", "kdkec", async (feature) => {
        currentKode = feature.properties.kdkec;
        geojsonLayers.kecamatan.remove();
        setLevel("desa");

        const desaData = await loadGeojson(
          "data/final_desa_202413309.geojson",
          currentKode,
          "kdkec"
        );

        addLayer(desaData, "desa", "nmdesa", "kddesa", async (feature) => {
          currentKode = feature.properties.kddesa;
          geojsonLayers.desa.remove();
          setLevel("sls");

          const slsData = await loadGeojson(
            "data/final_sls_202413309.geojson",
            currentKode,
            "kddesa"
          );

          addLayer(slsData, "sls", "nmsls", "kdsls", () => {});
        });
      });
    }
  });
