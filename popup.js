function renderAttributesTable(properties) {
  const rows = Object.entries(properties)
    .filter(([key]) => key !== "geometry" && key !== "boundedBy")
    .map(([key, value]) => `<tr><th>${key}</th><td>${value ?? ""}</td></tr>`)
    .join("");

  if (!rows) {
    return "<p>Khong co thuoc tinh de hien thi.</p>";
  }

  return `<table class="attr-table">${rows}</table>`;
}

function createPopup(map) {
  const container = document.getElementById("popup");
  const content = document.getElementById("popup-content");
  const closer = document.getElementById("popup-closer");
  container.style.display = "none";

  const overlay = new ol.Overlay({
    element: container,
    autoPan: {
      animation: { duration: 250 },
    },
  });

  map.addOverlay(overlay);

  closer.onclick = function () {
    overlay.setPosition(undefined);
    container.style.display = "none";
    closer.blur();
    return false;
  };

  return {
    overlay,
    show: (coordinate, html) => {
      content.innerHTML = html;
      container.style.display = "block";
      overlay.setPosition(coordinate);
    },
    hide: () => {
      overlay.setPosition(undefined);
      container.style.display = "none";
    },
  };
}
