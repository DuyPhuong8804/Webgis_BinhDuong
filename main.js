/* global ol, allLayers, overlayLayers, GEOSERVER_WMS_URL, GEOSERVER_WFS_URL, WORKSPACE, defaultCenter, defaultZoom, createPopup, renderAttributesTable */

const measureSource = new ol.source.Vector();
const measureLayer = new ol.layer.Vector({
  source: measureSource,
  style: new ol.style.Style({
    stroke: new ol.style.Stroke({ color: "#00594e", width: 2 }),
    fill: new ol.style.Fill({ color: "rgba(15,106,93,0.2)" }),
    image: new ol.style.Circle({
      radius: 5,
      fill: new ol.style.Fill({ color: "#00594e" }),
      stroke: new ol.style.Stroke({ color: "#ffffff", width: 1 }),
    }),
  }),
});
measureLayer.setZIndex(5000);

const queryResultSource = new ol.source.Vector();
const queryResultLayer = new ol.layer.Vector({
  source: queryResultSource,
  style: (feature) => {
    const type = feature.getGeometry().getType();
    if (type === "Point" || type === "MultiPoint") {
      return new ol.style.Style({
        image: new ol.style.Circle({
          radius: 7,
          fill: new ol.style.Fill({ color: "#ff3b3b" }),
          stroke: new ol.style.Stroke({ color: "#ffffff", width: 2 }),
        }),
      });
    }

    if (type === "LineString" || type === "MultiLineString") {
      return new ol.style.Style({
        stroke: new ol.style.Stroke({ color: "#ff3b3b", width: 4 }),
      });
    }

    return new ol.style.Style({
      fill: new ol.style.Fill({ color: "rgba(255,59,59,0.2)" }),
      stroke: new ol.style.Stroke({ color: "#ff3b3b", width: 2 }),
    });
  },
});
queryResultLayer.setZIndex(1000);

class LayerSwitcher extends ol.control.Control {
  constructor(options = {}) {
    const element = document.createElement("div");
    element.className = "ol-unselectable ol-control custom-layer-switcher";

    const button = document.createElement("button");
    button.textContent = "Layer Switch";

    const content = document.createElement("div");
    content.className = "content";
    content.style.display = "none";

    element.appendChild(button);
    element.appendChild(content);
    super({ element, target: options.target });

    button.addEventListener("click", () => {
      content.style.display = content.style.display === "none" ? "block" : "none";
    });

    this.contentEl = content;
  }

  setMap(map) {
    super.setMap(map);
    if (map) {
      this.renderLayers(map);
    }
  }

  renderLayers(map) {
    this.contentEl.innerHTML = "";
    map.getLayers().forEach((layer) => {
      const name = layer.get("name") || layer.get("title");
      if (!name) {
        return;
      }

      const row = document.createElement("label");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "6px";
      row.style.marginBottom = "6px";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = layer.getVisible();
      cb.addEventListener("change", () => {
        layer.setVisible(cb.checked);
      });

      const txt = document.createElement("span");
      txt.textContent = layer.get("title") || name;

      row.appendChild(cb);
      row.appendChild(txt);
      this.contentEl.appendChild(row);
    });
  }
}

const mousePositionControl = new ol.control.MousePosition({
  coordinateFormat: (coord) => {
    if (!coord) {
      document.getElementById("mouse-position").textContent = "Toa do: --";
      return "";
    }
    const lonLat = ol.proj.toLonLat(coord);
    const text = `${lonLat[0].toFixed(6)}, ${lonLat[1].toFixed(6)}`;
    document.getElementById("mouse-position").textContent = `Toa do: ${text}`;
    return "";
  },
  projection: "EPSG:3857",
});

const scaleLineControl = new ol.control.ScaleLine({ units: "metric" });
const LAYER_EXTENTS_4326 = {
  Dia_gioi_hanh_chinh_Binh_Duong: [106.2, 10.85, 107.05, 11.55],
  Ranh_gioi_Binh_Duong: [106.2, 10.85, 107.05, 11.55],
  Duong_giao_thong: [106.2, 10.85, 107.05, 11.55],
  Song: [106.2, 10.85, 107.05, 11.55],
  Truong_hoc: [106.2, 10.85, 107.05, 11.55],
  UBND: [106.2, 10.85, 107.05, 11.55],
  cong_vien: [106.2, 10.85, 107.05, 11.55],
  vung_dem: [106.2, 10.85, 107.05, 11.55],
};

const map = new ol.Map({
  target: "map",
  layers: [...allLayers, measureLayer, queryResultLayer],
  view: new ol.View({
    center: defaultCenter,
    zoom: defaultZoom,
    projection: "EPSG:3857",
  }),
  controls: ol.control.defaults().extend([
    new ol.control.ZoomSlider(),
    new ol.control.FullScreen(),
    new ol.control.OverviewMap({ layers: [new ol.layer.Tile({ source: new ol.source.OSM() })] }),
    mousePositionControl,
    scaleLineControl,
    new LayerSwitcher(),
  ]),
});

window.addEventListener("load", () => map.updateSize());
window.addEventListener("resize", () => map.updateSize());

const popup = createPopup(map);

function showSelectedInfo(title, htmlContent) {
  const container = document.getElementById("selected-info");
  if (!container) {
    return;
  }

  container.classList.remove("empty");
  container.innerHTML = `<h3>${title}</h3>${htmlContent}`;
}

function clearSelectedInfo() {
  const container = document.getElementById("selected-info");
  if (!container) {
    return;
  }

  container.classList.add("empty");
  container.innerHTML = "Nhấp vào bản đồ để xem thông tin đối tượng.";
}

function renderSelectedFields(layerName, properties) {
  const fields = layerName === "Dia_gioi_hanh_chinh_Binh_Duong" ? ["name", "population", "area"] : ["name"];
  const rows = fields
    .map((field) => `<tr><th>${field}</th><td>${properties?.[field] ?? ""}</td></tr>`)
    .join("");

  return rows ? `<table class="attr-table">${rows}</table>` : "<p>Khong co thuoc tinh de hien thi.</p>";
}

function setQueryCount(count) {
  const el = document.getElementById("query-count");
  if (el) {
    el.textContent = `Số lượng kết quả: ${count}`;
  }
}

function renderQueryAttributes(headers, rows) {
  const container = document.getElementById("query-attributes");
  if (!container) {
    return;
  }

  if (!rows.length) {
    container.classList.add("empty");
    container.innerHTML = "Không có kết quả.";
    return;
  }

  const headHtml = headers.map((h) => `<th>${h}</th>`).join("");
  const bodyHtml = rows
    .map((row) => `<tr>${row.map((value) => `<td>${value ?? ""}</td>`).join("")}</tr>`)
    .join("");

  container.classList.remove("empty");
  container.innerHTML = `<table class="attr-table"><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
}

function clearQueryResults() {
  queryResultSource.clear();
  setQueryCount(0);
  const container = document.getElementById("query-attributes");
  if (container) {
    container.classList.add("empty");
    container.innerHTML = "Chưa có kết quả truy vấn.";
  }
}

function renderQueryResults(rows) {
  const container = document.getElementById("query-attributes");
  if (!container) {
    return;
  }

  if (!rows.length) {
    container.classList.add("empty");
    container.innerHTML = "Không có kết quả.";
    return;
  }

  const headers = [...new Set(rows.flatMap((row) => Object.keys(row).filter((key) => key !== "geometry")))];
  const headHtml = headers.map((header) => `<th>${header}</th>`).join("");
  const bodyHtml = rows
    .map((row) => `<tr>${headers.map((header) => `<td>${row[header] ?? ""}</td>`).join("")}</tr>`)
    .join("");

  container.classList.remove("empty");
  container.innerHTML = `<table class="attr-table"><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
}

function renderQueryGeometries(rows) {
  queryResultSource.clear();

  const features = rows
    .filter((row) => row.geometry)
    .map((row) => {
      const properties = Object.fromEntries(Object.entries(row).filter(([key]) => key !== "geometry"));
      return {
        type: "Feature",
        geometry: row.geometry,
        properties,
      };
    });

  if (!features.length) {
    return;
  }

  const olFeatures = new ol.format.GeoJSON().readFeatures(
    { type: "FeatureCollection", features },
    {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857",
    },
  );

  queryResultSource.addFeatures(olFeatures);
}

async function fetchWfs(layerName, { cql, maxFeatures = 500 } = {}) {
  const params = new URLSearchParams({
    service: "WFS",
    version: "1.1.0",
    request: "GetFeature",
    typeName: `${WORKSPACE}:${layerName}`,
    outputFormat: "application/json",
    srsName: "EPSG:4326",
    maxFeatures: String(maxFeatures),
  });

  if (cql) {
    params.set("CQL_FILTER", cql);
  }

  const response = await fetch(`${GEOSERVER_WFS_URL}?${params.toString()}`, { mode: "same-origin" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

function toOlFeatures(geojson) {
  return new ol.format.GeoJSON().readFeatures(geojson, {
    dataProjection: "EPSG:4326",
    featureProjection: "EPSG:3857",
  });
}

function fitResultLayer() {
  const extent = queryResultSource.getExtent();
  if (extent && !ol.extent.isEmpty(extent)) {
    map.getView().fit(extent, { padding: [30, 30, 30, 30], duration: 250, maxZoom: 15 });
  }
}

function distanceMeters(coordA3857, coordB3857) {
  const a = ol.proj.toLonLat(coordA3857);
  const b = ol.proj.toLonLat(coordB3857);
  return ol.sphere.getDistance(a, b);
}

function measureDistanceMeters(coordA3857, coordB3857) {
  const dx = coordB3857[0] - coordA3857[0];
  const dy = coordB3857[1] - coordA3857[1];
  return Math.hypot(dx, dy);
}

function polygonAreaMeters(coords3857) {
  let sum = 0;
  for (let i = 0; i < coords3857.length - 1; i += 1) {
    const [x1, y1] = coords3857[i];
    const [x2, y2] = coords3857[i + 1];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

function representativeCoordinate(geometry) {
  const type = geometry.getType();
  if (type === "Point") {
    return geometry.getCoordinates();
  }
  if (type === "MultiPoint") {
    const coords = geometry.getCoordinates();
    return coords.length ? coords[0] : ol.extent.getCenter(geometry.getExtent());
  }
  return ol.extent.getCenter(geometry.getExtent());
}

function isPointInRing(point, ring) {
  let inside = false;
  const x = point[0];
  const y = point[1];

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

function isPointInPolygonCoords(point, polygonCoords) {
  if (!polygonCoords.length) {
    return false;
  }

  if (!isPointInRing(point, polygonCoords[0])) {
    return false;
  }

  for (let i = 1; i < polygonCoords.length; i += 1) {
    if (isPointInRing(point, polygonCoords[i])) {
      return false;
    }
  }

  return true;
}

function geometryContainsPoint(geometry, point) {
  const type = geometry.getType();
  if (type === "Polygon") {
    return isPointInPolygonCoords(point, geometry.getCoordinates());
  }

  if (type === "MultiPolygon") {
    return geometry.getCoordinates().some((polygonCoords) => isPointInPolygonCoords(point, polygonCoords));
  }

  return geometry.intersectsExtent(ol.extent.boundingExtent([point]));
}

function normalizeViText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLowerCase();
}

async function runQueryQ1() {
  const data = await fetchWfs("Dia_gioi_hanh_chinh_Binh_Duong", { maxFeatures: 1000 });
  const features = toOlFeatures(data);
  const filteredFeatures = [];
  const rows = [];

  (data.features || []).forEach((f, idx) => {
    const name = f.properties?.name || "";
    if (normalizeViText(name).startsWith("phuong")) {
      if (features[idx]) {
        filteredFeatures.push(features[idx].clone());
      }
      rows.push([name, f.properties?.population, f.properties?.area]);
    }
  });

  queryResultSource.addFeatures(filteredFeatures);
  setQueryCount(rows.length);
  renderQueryAttributes(["name", "population", "area"], rows);
}

async function runQueryQ2() {
  const adminData = await fetchWfs("Dia_gioi_hanh_chinh_Binh_Duong", { maxFeatures: 500 });
  const adminFeatures = toOlFeatures(adminData);
  const adminIndex = (adminData.features || []).findIndex((f) => normalizeViText(f.properties?.name).includes("di an"));
  if (adminIndex < 0 || !adminFeatures[adminIndex]) {
    setQueryCount(0);
    renderQueryAttributes(["name"], []);
    return;
  }

  const adminGeom = adminFeatures[adminIndex].getGeometry();
  const schoolData = await fetchWfs("Truong_hoc", { maxFeatures: 2000 });
  const schoolFeatures = toOlFeatures(schoolData);

  const matchedRows = [];
  const matchedFeatures = [adminFeatures[adminIndex].clone()];
  schoolFeatures.forEach((feature, idx) => {
    const schoolGeom = feature.getGeometry();
    const schoolCoord = representativeCoordinate(schoolGeom);
    if (geometryContainsPoint(adminGeom, schoolCoord)) {
      matchedFeatures.push(feature.clone());
      matchedRows.push([schoolData.features[idx]?.properties?.name]);
    }
  });

  queryResultSource.addFeatures(matchedFeatures);
  setQueryCount(matchedRows.length);
  renderQueryAttributes(["name"], matchedRows);
}

async function runQueryQ3() {
  const schoolData = await fetchWfs("Truong_hoc", { maxFeatures: 1 });
  const schoolFeatures = toOlFeatures(schoolData);
  if (!schoolFeatures.length) {
    setQueryCount(0);
    renderQueryAttributes(["name", "distance_m"], []);
    return;
  }

  const schoolPoint = representativeCoordinate(schoolFeatures[0].getGeometry());
  const roadData = await fetchWfs("Duong_giao_thong", { maxFeatures: 5000 });
  const roadFeatures = toOlFeatures(roadData);

  const rows = [];
  const matched = [schoolFeatures[0].clone()];
  roadFeatures.forEach((road, idx) => {
    const closest = road.getGeometry().getClosestPoint(schoolPoint);
    const d = distanceMeters(schoolPoint, closest);
    if (d <= 500) {
      matched.push(road.clone());
      rows.push([roadData.features[idx]?.properties?.name || "(khong ten)", Math.round(d)]);
    }
  });

  queryResultSource.addFeatures(matched);
  setQueryCount(rows.length);
  renderQueryAttributes(["name", "distance_m"], rows);
}

async function runQueryQ4() {
  const schoolData = await fetchWfs("Truong_hoc", { maxFeatures: 1 });
  const schoolFeatures = toOlFeatures(schoolData);
  if (!schoolFeatures.length) {
    setQueryCount(0);
    renderQueryAttributes(["name", "distance_m"], []);
    return;
  }

  const ubndData = await fetchWfs("UBND", { maxFeatures: 2000 });
  const ubndFeatures = toOlFeatures(ubndData);
  const schoolPoint = representativeCoordinate(schoolFeatures[0].getGeometry());

  let nearest = null;
  let nearestDist = Number.POSITIVE_INFINITY;
  let nearestIndex = -1;

  ubndFeatures.forEach((feature, idx) => {
    const ubndPoint = feature.getGeometry().getClosestPoint(schoolPoint);
    const d = distanceMeters(schoolPoint, ubndPoint);
    if (d < nearestDist) {
      nearest = feature;
      nearestDist = d;
      nearestIndex = idx;
    }
  });

  if (!nearest) {
    setQueryCount(0);
    renderQueryAttributes(["name", "distance_m"], []);
    return;
  }

  queryResultSource.addFeatures([schoolFeatures[0].clone(), nearest.clone()]);
  setQueryCount(1);
  renderQueryAttributes(["name", "distance_m"], [[ubndData.features[nearestIndex]?.properties?.name || "(khong ten)", Math.round(nearestDist)]]);
}

async function runQueryQ5() {
  const adminData = await fetchWfs("Dia_gioi_hanh_chinh_Binh_Duong", { maxFeatures: 500 });
  const adminFeatures = toOlFeatures(adminData);
  const schoolData = await fetchWfs("Truong_hoc", { maxFeatures: 5000 });
  const schoolFeatures = toOlFeatures(schoolData);

  const rows = [];
  const highlight = [];
  adminFeatures.forEach((admin, idx) => {
    const count = schoolFeatures.reduce((sum, school) => {
      const c = representativeCoordinate(school.getGeometry());
      return admin.getGeometry().intersectsCoordinate(c) ? sum + 1 : sum;
    }, 0);

    rows.push([adminData.features[idx]?.properties?.name, count]);
    if (count > 0) {
      highlight.push(admin.clone());
    }
  });

  rows.sort((a, b) => b[1] - a[1]);
  queryResultSource.addFeatures(highlight);
  setQueryCount(rows.length);
  renderQueryAttributes(["name", "so_truong_hoc"], rows);
}

async function runSpatialQuery() {
  clearQueryResults();
  const queryId = document.getElementById("querySelect")?.value;

  try {
    if (!queryId) {
      throw new Error("Chua chon truy van.");
    }

    if (queryId === "q1") {
      await runQueryQ1();
      return;
    }

    if (queryId === "q2") {
      await runQueryQ2();
      return;
    }

    const response = await fetch(`/api/query/${queryId}`);
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    const rows = data.rows || [];
    setQueryCount(rows.length);
    renderQueryResults(rows);
    renderQueryGeometries(rows);
  } catch (err) {
    setQueryCount(0);
    renderQueryAttributes(["error"], [[err.message]]);
  }
}

function updateScaleText() {
  const view = map.getView();
  const resolution = view.getResolution();
  const projection = view.getProjection();
  const mpu = projection.getMetersPerUnit();
  const dpi = 25.4 / 0.28;
  const scale = resolution * mpu * 39.37 * dpi;
  document.getElementById("map-scale").textContent = `Ti le: 1:${Math.round(scale).toLocaleString("vi-VN")}`;
}

map.getView().on("change:resolution", updateScaleText);
updateScaleText();

document.getElementById("btnZoomIn").addEventListener("click", () => {
  const view = map.getView();
  view.setZoom(view.getZoom() + 1);
});

document.getElementById("btnZoomOut").addEventListener("click", () => {
  const view = map.getView();
  view.setZoom(view.getZoom() - 1);
});

document.getElementById("btnHome").addEventListener("click", () => {
  const view = map.getView();
  view.setCenter(defaultCenter);
  view.setZoom(defaultZoom);
});

function zoomToLayerExtent(layerName) {
  const extent4326 = LAYER_EXTENTS_4326[layerName] || [106.2, 10.85, 107.05, 11.55];
  const extent3857 = ol.proj.transformExtent(extent4326, "EPSG:4326", "EPSG:3857");
  map.getView().fit(extent3857, { padding: [30, 30, 30, 30], duration: 350, maxZoom: 14 });
}

let measureMode = null;
let measurePoints = [];
let suppressInfoClick = false;
let infoEnabled = false;

function showMeasureResult(title, htmlContent) {
  const container = document.getElementById("measure-result");
  if (!container) {
    return;
  }

  container.classList.remove("empty");
  container.innerHTML = `<h3>${title}</h3>${htmlContent}`;
}

function clearMeasureResult() {
  const container = document.getElementById("measure-result");
  if (!container) {
    return;
  }

  container.classList.add("empty");
  container.innerHTML = "Chưa có kết quả đo đạc.";
}

function setInfoEnabled(enabled) {
  infoEnabled = enabled;

  const button = document.getElementById("btnToggleInfo");
  if (button) {
    button.classList.toggle("is-on", enabled);
    button.textContent = enabled ? "Tắt thông tin" : "Bật thông tin";
  }

  if (!enabled) {
    clearSelectedInfo();
    popup.hide();
  }
}

function finishMeasure() {
  measureMode = null;
  measurePoints = [];
}

function startMeasure(type) {
  finishMeasure();
  measureSource.clear();
  clearMeasureResult();
  measureMode = type;
}

function addMeasurePoint(coordinate) {
  measurePoints.push(coordinate);
  measureSource.clear();

  measurePoints.forEach((pointCoordinate) => {
    measureSource.addFeature(new ol.Feature(new ol.geom.Point(pointCoordinate)));
  });

  if (measureMode === "LineString" && measurePoints.length >= 2) {
    const linePoints = measurePoints.slice(0, 2);
    measureSource.addFeature(new ol.Feature(new ol.geom.LineString(linePoints)));
    const length = measureDistanceMeters(linePoints[0], linePoints[1]);
    showMeasureResult("Kết quả đo khoảng cách", `<p>Khoảng cách: ${length.toFixed(2)} m</p>`);
    finishMeasure();
    return;
  }

  if (measureMode === "Polygon") {
    if (measurePoints.length >= 2) {
      measureSource.addFeature(new ol.Feature(new ol.geom.LineString(measurePoints.slice())));
    }

    if (measurePoints.length >= 4) {
      const ring = measurePoints.slice(0, 4);
      const closedRing = [...ring, ring[0]];
      const polygon = new ol.geom.Polygon([closedRing]);
      measureSource.clear();
      measurePoints.slice(0, 4).forEach((pointCoordinate) => {
        measureSource.addFeature(new ol.Feature(new ol.geom.Point(pointCoordinate)));
      });
      measureSource.addFeature(new ol.Feature(polygon));

      const area = polygonAreaMeters(closedRing);
      showMeasureResult("Kết quả đo diện tích", `<p>Diện tích: ${area.toFixed(2)} m²</p>`);
      finishMeasure();
    }
  }
}

function handleMeasureClick(evt) {
  if (!measureMode) {
    return false;
  }

  suppressInfoClick = true;
  addMeasurePoint(evt.coordinate);
  return true;
}

document.getElementById("btnMeasureLength").addEventListener("click", () => startMeasure("LineString"));
document.getElementById("btnMeasureArea").addEventListener("click", () => startMeasure("Polygon"));
document.getElementById("btnClearMeasure").addEventListener("click", () => {
  finishMeasure();
  measureSource.clear();
  clearMeasureResult();
  popup.hide();
});

function getTopVisibleWmsLayer() {
  const visible = overlayLayers.filter((layer) => layer.getVisible() && layer.get("name") !== "vung_dem");
  return visible.length ? visible[visible.length - 1] : overlayLayers[0];
}

function buildWmsGetFeatureInfoUrl(layer, coordinate) {
  const source = layer.getSource();
  const extent = map.getView().calculateExtent(map.getSize());
  const size = map.getSize();
  const params = source.getParams();
  const baseUrl = source.getUrls ? source.getUrls()[0] : source.getUrl();

  const x = Math.floor((coordinate[0] - extent[0]) / map.getView().getResolution());
  const y = Math.floor((extent[3] - coordinate[1]) / map.getView().getResolution());

  const query = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: params.VERSION || "1.1.1",
    REQUEST: "GetFeatureInfo",
    LAYERS: params.LAYERS,
    QUERY_LAYERS: params.LAYERS,
    STYLES: params.STYLES || "",
    BBOX: extent.join(","),
    FEATURE_COUNT: "1",
    HEIGHT: String(size[1]),
    WIDTH: String(size[0]),
    INFO_FORMAT: "application/json",
    SRS: map.getView().getProjection().getCode(),
    X: String(x),
    Y: String(y),
  });

  return `${baseUrl}?${query.toString()}`;
}

map.on("click", (evt) => {
  handleMeasureClick(evt);
});

map.on("singleclick", async (evt) => {
  if (suppressInfoClick) {
    suppressInfoClick = false;
    return;
  }

  if (handleMeasureClick(evt)) {
    return;
  }

  if (!infoEnabled) {
    return;
  }

  const visibleLayers = overlayLayers.filter((layer) => layer.getVisible() && layer.get("name") !== "vung_dem");
  const targetLayers = visibleLayers.length ? visibleLayers.slice().reverse() : [getTopVisibleWmsLayer()];

  showSelectedInfo("Thong tin doi tuong", "<p>Dang lay thong tin doi tuong...</p>");
  popup.show(evt.coordinate, `<p>Dang lay thong tin doi tuong...</p>`);

  for (const layer of targetLayers) {
    const title = layer.get("title") || layer.get("name") || "Thong tin doi tuong";

    try {
      const url = buildWmsGetFeatureInfoUrl(layer, evt.coordinate);
      const response = await fetch(url, { mode: "same-origin" });
      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const features = data.features || [];

      if (!features.length) {
        continue;
      }

      const properties = features[0].properties || {};
      const html = renderSelectedFields(layer.get("name"), properties);

      popup.show(evt.coordinate, `<strong>${title}</strong><p>Da chon 1 doi tuong.</p>`);
      showSelectedInfo(title, html);
      return;
    } catch (err) {
      // Thu layer tiep theo.
    }
  }

  const emptyHtml = "<p>Khong tim thay doi tuong tai vi tri nay.</p>";
  popup.show(evt.coordinate, emptyHtml);
  showSelectedInfo("Thong tin doi tuong", emptyHtml);
});

document.getElementById("btnRunQuery")?.addEventListener("click", runSpatialQuery);
document.getElementById("btnClearQuery")?.addEventListener("click", () => {
  clearQueryResults();
});

document.getElementById("btnToggleInfo")?.addEventListener("click", () => {
  setInfoEnabled(!infoEnabled);
});

