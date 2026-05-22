const GEOSERVER_WMS_URL = "/geoserver/wms";
const GEOSERVER_WFS_URL = "/geoserver/wfs";
const WORKSPACE = "BinhDuong";

const defaultCenter = ol.proj.fromLonLat([106.65, 11.05]);
const defaultZoom = 10;

function createWmsLayer(layerName, title, visible = true) {
  return new ol.layer.Tile({
    title,
    name: layerName,
    visible,
    source: new ol.source.TileWMS({
      url: GEOSERVER_WMS_URL,
      params: {
        LAYERS: `${WORKSPACE}:${layerName}`,
        VERSION: "1.1.1",
        FORMAT: "image/png",
        TRANSPARENT: true,
        TILED: true,
      },
      serverType: "geoserver",
    }),
  });
}

const osmLayer = new ol.layer.Tile({
  title: "OpenStreetMap",
  name: "OSM",
  type: "base",
  visible: true,
  source: new ol.source.OSM(),
});
osmLayer.setZIndex(0);

const diaGioiLayer = createWmsLayer("Dia_gioi_hanh_chinh_Binh_Duong", "Dia gioi hanh chinh", false);
const ranhGioiLayer = createWmsLayer("Ranh_gioi_Binh_Duong", "Ranh gioi Binh Duong", false);
const duongLayer = createWmsLayer("Duong_giao_thong", "Duong giao thong", false);
const songLayer = createWmsLayer("Song", "Song", false);
const truongHocLayer = createWmsLayer("Truong_hoc", "Truong hoc", false);
const ubndLayer = createWmsLayer("UBND", "UBND", false);
const congVienLayer = createWmsLayer("cong_vien", "Cong vien", false);
const vungDemLayer = createWmsLayer("vung_dem", "Vung dem", false);

vungDemLayer.setZIndex(1);
ranhGioiLayer.setZIndex(5);
diaGioiLayer.setZIndex(10);
duongLayer.setZIndex(12);
songLayer.setZIndex(13);
truongHocLayer.setZIndex(14);
ubndLayer.setZIndex(15);
congVienLayer.setZIndex(16);

const overlayLayers = [
  vungDemLayer,
  diaGioiLayer,
  ranhGioiLayer,
  duongLayer,
  songLayer,
  truongHocLayer,
  ubndLayer,
  congVienLayer,
];

const allLayers = [osmLayer, ...overlayLayers];
