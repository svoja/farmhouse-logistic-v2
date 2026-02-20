/* Route Radar: live map with branches, factory, cars and path-following animation */
const mapEl = document.getElementById("map");
const radarRefreshBtn = document.getElementById("radar-refresh-now");
const radarLegend = document.getElementById("radar-legend");
const radarInfoContent = document.getElementById("radar-info-content");
const radarLiveBadge = document.getElementById("radar-live-badge");
const carDetailPanel = document.getElementById("car-detail-panel");
const carDetailPlate = document.getElementById("car-detail-plate");
const carDetailType = document.getElementById("car-detail-type");
const carDetailClose = document.getElementById("car-detail-close");
const carDetailRoute = document.getElementById("car-detail-route");
const carDetailOrders = document.getElementById("car-detail-orders");
const carDetailStatus = document.getElementById("car-detail-status");
const carDetailDebug = document.getElementById("car-detail-debug");
const carDetailDebugInTransit = document.getElementById("car-detail-debug-in-transit");
const carDetailDebugComplete = document.getElementById("car-detail-debug-complete");
const radarRouteTypeFilter = document.getElementById("radar-route-type-filter");

let map = null;
let directionsService = null;
let branches = [];
let byCarData = { cars: [] };
let mapMarkers = [];
let routeLines = [];
let carMarkers = [];
let carLabels = [];
let carStopsPerCar = [];
let carSegmentIndex = [];
let carProgress = [];
let carActiveSegment = [];
let carShouldAnimate = [];
let carOffsets = [];
let carPathPerCar = [];
let carPathSegmentBounds = [];
let carSegmentMs = [];
let radarAnimationId = null;
let radarAutoRefreshId = null;
let radarInitialFitDone = false;
let CarLabelOverlay = null;

const BANGKOK = { lat: 13.7563, lng: 100.5018 };
const RADAR_CAR_SEGMENT_MS_LOCAL = 4500;
const RADAR_CAR_SEGMENT_MS_10WHEEL = 14000;
const RADAR_ANIMATION_INTERVAL_MS = 50;
const RADAR_AUTO_REFRESH_MS = 60000; // 1 minute

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function formatStatus(s) {
  const t = { loaded: "Loaded", in_transit: "In transit", delivered: "Delivered", pending: "Planned", planned: "Planned" };
  return t[s] || s;
}

/** Route type filter: '' = all, '1' = Main road, '2' = Small road. Returns cars matching current filter. */
function getRouteTypeFilterValue() {
  if (!radarRouteTypeFilter) return "";
  const v = radarRouteTypeFilter.value;
  return v === "1" || v === "2" ? v : "";
}

function isFirstStopFactory(orders) {
  if (!orders || orders.length === 0) return false;
  const name = String(orders[0].branch_name || "").toLowerCase();
  return name.includes("factory") || name.includes("manu") || name.includes("โรงงาน");
}

function getFilteredCars() {
  const all = (byCarData && byCarData.cars) || [];
  const filter = getRouteTypeFilterValue();
  if (!filter) return all;
  const typeNum = parseInt(filter, 10);
  return all.filter((car) => {
    const orders = car.orders || [];
    const firstIsFactory = isFirstStopFactory(orders);
    if (typeNum === 1) return firstIsFactory;
    if (typeNum === 2) return !firstIsFactory;
    return true;
  });
}

function defineCarLabelOverlay() {
  if (CarLabelOverlay || !window.google || !window.google.maps) return;
  function CarLabelOverlayCtor(position, options) {
    this.position = position;
    this.plate = (options && options.plate) || "";
    this.firstName = (options && options.firstName) || "";
    this.color = (options && options.color) || "#0ea5e9";
    this.title = (options && options.title) || "";
    this.div = null;
    this.setMap(options && options.map);
  }
  CarLabelOverlayCtor.prototype = new google.maps.OverlayView();
  CarLabelOverlayCtor.prototype.onAdd = function () {
    this.div = document.createElement("div");
    this.div.style.cssText =
      "position:absolute;white-space:nowrap;padding:5px 8px;border-radius:8px;font-size:11px;font-weight:700;color:#fff;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);cursor:pointer;line-height:1.2;text-align:center;pointer-events:auto;";
    this.div.style.backgroundColor = this.color;
    this.div.style.borderColor = "#fff";
    this.div.innerHTML =
      "<div>" +
      escapeHtml(this.plate) +
      "</div><div style=\"font-size:10px;font-weight:500;opacity:0.95;\">" +
      escapeHtml(this.firstName) +
      "</div>";
    this.div.title = this.title;
    const self = this;
    this.div.addEventListener("click", function () {
      if (self.onClick) self.onClick();
    });
    this.getPanes().overlayMouseTarget.appendChild(this.div);
  };
  CarLabelOverlayCtor.prototype.draw = function () {
    if (!this.div || !this.position) return;
    const latLng =
      this.position instanceof google.maps.LatLng
        ? this.position
        : new google.maps.LatLng(this.position.lat, this.position.lng);
    const point = this.getProjection().fromLatLngToDivPixel(latLng);
    if (point) {
      this.div.style.left = point.x - this.div.offsetWidth / 2 + "px";
      this.div.style.top = point.y - this.div.offsetHeight / 2 + "px";
    }
  };
  CarLabelOverlayCtor.prototype.onRemove = function () {
    if (this.div && this.div.parentNode) this.div.parentNode.removeChild(this.div);
    this.div = null;
  };
  CarLabelOverlayCtor.prototype.getPosition = function () {
    return this.position
      ? typeof this.position.lat === "function"
        ? { lat: this.position.lat(), lng: this.position.lng() }
        : this.position
      : null;
  };
  CarLabelOverlayCtor.prototype.setPosition = function (latLng) {
    this.position = latLng;
    if (this.div) this.draw();
  };
  CarLabelOverlayCtor.prototype.setTitle = function (t) {
    this.title = t;
    if (this.div) this.div.title = t;
  };
  CarLabelOverlay = CarLabelOverlayCtor;
}

function requestDirections(waypoints) {
  return new Promise((resolve) => {
    if (!directionsService || waypoints.length < 2) {
      resolve([]);
      return;
    }
    const origin = waypoints[0];
    const dest = waypoints[waypoints.length - 1];
    const mid =
      waypoints.length > 2
        ? waypoints.slice(1, -1).map((w) => ({
            location: new google.maps.LatLng(w.lat, w.lng),
            stopover: true,
          }))
        : [];
    directionsService.route(
      {
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(dest.lat, dest.lng),
        waypoints: mid,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status !== google.maps.DirectionsStatus.OK || !result || !result.routes || !result.routes[0]) {
          resolve([]);
          return;
        }
        resolve(result.routes[0].overview_path || []);
      }
    );
  });
}

function getPathSegmentBounds(path, stops) {
  if (!path || path.length === 0 || !stops || stops.length === 0) return null;
  const n = stops.length;
  const bounds = [];
  for (let s = 0; s < n; s++) {
    const stop = stops[s];
    const lat = stop.lat;
    const lng = stop.lng;
    const minIdx = s === 0 ? 0 : bounds[s - 1];
    const maxIdx = s === n - 1 ? path.length - 1 : path.length - 1;
    let bestIdx = minIdx;
    let bestD = 1e30;
    for (let i = minIdx; i <= maxIdx; i++) {
      const p = path[i];
      const plat = typeof p.lat === "function" ? p.lat() : p.lat;
      const plng = typeof p.lng === "function" ? p.lng() : p.lng;
      const d = (plat - lat) * (plat - lat) + (plng - lng) * (plng - lng);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    bounds.push(s === n - 1 ? path.length - 1 : Math.max(bestIdx, minIdx));
  }
  return bounds;
}

function getPositionOnPath(path, startIdx, endIdx, progress) {
  if (!path || path.length === 0) return null;
  const t = Math.min(1, Math.max(0, progress));
  const len = endIdx - startIdx;
  if (len <= 0) {
    const p0 = path[startIdx];
    return p0
      ? { lat: typeof p0.lat === "function" ? p0.lat() : p0.lat, lng: typeof p0.lng === "function" ? p0.lng() : p0.lng }
      : null;
  }
  const exact = startIdx + t * len;
  const low = Math.floor(exact);
  const high = Math.min(path.length - 1, low + 1);
  const u = exact - low;
  const a = path[low];
  const b = path[high];
  const latA = typeof a.lat === "function" ? a.lat() : a.lat;
  const lngA = typeof a.lng === "function" ? a.lng() : a.lng;
  const latB = typeof b.lat === "function" ? b.lat() : b.lat;
  const lngB = typeof b.lng === "function" ? b.lng() : b.lng;
  return { lat: latA + u * (latB - latA), lng: lngA + u * (lngB - lngA) };
}

function interpolateSegment(stops, segIdx, progress) {
  const n = (stops || []).length;
  if (n === 0) return [0, 0];
  if (n === 1) return [stops[0].lat, stops[0].lng];
  const seg = Math.min(segIdx, n - 2);
  const t = Math.min(1, Math.max(0, progress));
  const from = stops[seg];
  const to = stops[seg + 1];
  return [
    from.lat + t * (to.lat - from.lat),
    from.lng + t * (to.lng - from.lng),
  ];
}

function runRadarCarStep() {
  for (let i = 0; i < carMarkers.length; i++) {
    const segmentMs = carSegmentMs[i] > 0 ? carSegmentMs[i] : RADAR_CAR_SEGMENT_MS_LOCAL;
    const dt = RADAR_ANIMATION_INTERVAL_MS / segmentMs;
    if (!carShouldAnimate[i]) continue;
    const stops = carStopsPerCar[i];
    if (!stops || stops.length <= 1) continue;
    const numSegments = stops.length - 1;
    carProgress[i] += dt;
    if (carProgress[i] >= 1) {
      carProgress[i] = 0;
      carSegmentIndex[i] = (carSegmentIndex[i] + 1) % numSegments;
    }
    const seg = carSegmentIndex[i];
    const path = carPathPerCar[i];
    const bounds = carPathSegmentBounds[i];
    if (path && bounds && seg >= 0 && seg < bounds.length - 1) {
      const startIdx = bounds[seg];
      const endIdx = bounds[seg + 1];
      let pos = getPositionOnPath(path, startIdx, endIdx, carProgress[i]);
      if (pos) {
        const off = carOffsets[i];
        if (off) pos = { lat: pos.lat + off[0], lng: pos.lng + off[1] };
        carMarkers[i].setPosition(pos);
      }
    } else {
      const pos = interpolateSegment(stops, seg, carProgress[i]);
      const off = carOffsets[i];
      if (off) pos[0] += off[0], pos[1] += off[1];
      carMarkers[i].setPosition({ lat: pos[0], lng: pos[1] });
    }
    const nextLabel = stops[seg + 1] ? stops[seg + 1].label : "";
    carMarkers[i].setTitle((carLabels[i] || "") + " → " + nextLabel);
  }
}

function initMap() {
  if (!mapEl || map) return;
  if (!window.google || !window.google.maps) return;
  map = new google.maps.Map(mapEl, {
    center: BANGKOK,
    zoom: 10,
    mapTypeControl: true,
    fullscreenControl: true,
  });
  directionsService = new google.maps.DirectionsService();
}

function updateMapMarkers() {
  if (!map || !window.google) return;
  const prevCenter = map.getCenter();
  const prevZoom = map.getZoom();
  const savedLat = prevCenter ? (typeof prevCenter.lat === "function" ? prevCenter.lat() : prevCenter.lat) : null;
  const savedLng = prevCenter ? (typeof prevCenter.lng === "function" ? prevCenter.lng() : prevCenter.lng) : null;
  const savedZoom = typeof prevZoom === "number" ? prevZoom : null;

  mapMarkers.forEach((m) => m.setMap(null));
  mapMarkers = [];
  routeLines.forEach((l) => l.setMap(null));
  routeLines = [];
  carMarkers.forEach((m) => {
    if (m.setMap) m.setMap(null);
  });
  carMarkers = [];
  carStopsPerCar = [];
  carSegmentIndex = [];
  carProgress = [];
  carLabels = [];
  carShouldAnimate = [];
  carActiveSegment = [];
  carOffsets = [];
  carPathPerCar = [];
  carPathSegmentBounds = [];
  carSegmentMs = [];
  if (radarAnimationId) {
    clearInterval(radarAnimationId);
    radarAnimationId = null;
  }

  const withCoords = (branches || []).filter(
    (b) => b.branch_latitude != null && b.branch_longitude != null
  );
  const factoryBranch = withCoords.find(
    (b) => b.branch_id === 11 || (b.branch_name && b.branch_name.toLowerCase().includes("factory"))
  );
  const factoryLatLng = factoryBranch
    ? { lat: Number(factoryBranch.branch_latitude), lng: Number(factoryBranch.branch_longitude) }
    : null;
  const factoryLabel = factoryBranch ? (factoryBranch.branch_name || "Main Factory") : "Main Factory";

  withCoords.forEach((b) => {
    const label = b.branch_name || "Branch " + b.branch_id;
    const pos = { lat: Number(b.branch_latitude), lng: Number(b.branch_longitude) };
    const isFactory = b === factoryBranch;
    const marker = new google.maps.Marker({
      position: pos,
      map: map,
      title: label,
      icon: isFactory
        ? {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 14,
            fillColor: "#ea580c",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 3,
          }
        : null,
    });
    mapMarkers.push(marker);
  });

  const routeCars = getFilteredCars();
  const routeColors = ["#0ea5e9", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2", "#a21caf", "#65a30d"];
  const markerColors = ["#0369a1", "#5b21b6", "#047857", "#b45309", "#b91c1c", "#0e7490", "#701a75", "#4d7c0f"];
  const directionPromises = [];

  routeCars.forEach((car, ci) => {
    const orders = (car.orders || []).filter(
      (o) => o.branch_latitude != null && o.branch_longitude != null
    );
    if (orders.length === 0) return;

    const firstIsFactory = isFirstStopFactory(orders);
    const is10Wheel = firstIsFactory;
    carSegmentMs.push(is10Wheel ? RADAR_CAR_SEGMENT_MS_10WHEEL : RADAR_CAR_SEGMENT_MS_LOCAL);
    const routeColor = routeColors[ci % routeColors.length];
    const markerColor = markerColors[ci % markerColors.length];
    const stops = [];
    if (factoryLatLng && firstIsFactory) stops.push({ lat: factoryLatLng.lat, lng: factoryLatLng.lng, label: factoryLabel });
    orders.forEach((o) => {
      stops.push({
        lat: Number(o.branch_latitude),
        lng: Number(o.branch_longitude),
        label: o.branch_name || "Branch",
      });
    });
    if (factoryLatLng && firstIsFactory && stops.length > 0) {
      stops.push({ lat: factoryLatLng.lat, lng: factoryLatLng.lng, label: factoryLabel + " (return)" });
    }

    directionPromises.push(
      requestDirections(stops).then((path) => ({ ci, routeColor, markerColor, path, stops }))
    );

    const ordersForStops = car.orders || [];
    const hasInTransit = ordersForStops.some((o) => o.delivery_status === "in_transit");
    const inTransitOrderIndex = ordersForStops.findIndex((o) => o.delivery_status === "in_transit");
    const activeSegment = hasInTransit && inTransitOrderIndex >= 0 ? inTransitOrderIndex : 0;
    carStopsPerCar.push(stops);
    const numSegments = Math.max(0, stops.length - 1);
    carSegmentIndex.push(activeSegment);
    carProgress.push(0);
    carLabels.push(car.license_plate || "");
    carShouldAnimate.push(hasInTransit);
    carActiveSegment.push(activeSegment);

    // Spread each car around the same point in a circle (2*pi * index) so they don't overlap
    const totalCars = routeCars.length;
    const radiusDeg = 0.00045;
    const angle = (2 * Math.PI * ci) / Math.max(1, totalCars);
    const latOff = radiusDeg * Math.cos(angle);
    const lngOff = radiusDeg * Math.sin(angle);
    carOffsets.push([latOff, lngOff]);

    const getPos = (segIdx, prog) => {
      if (numSegments === 0) return [stops[0].lat, stops[0].lng];
      const from = stops[segIdx];
      const to = stops[segIdx + 1];
      const t = Math.min(1, Math.max(0, prog));
      return [
        from.lat + t * (to.lat - from.lat),
        from.lng + t * (to.lng - from.lng),
      ];
    };
    let initialPos = getPos(activeSegment, 0);
    initialPos = [initialPos[0] + latOff, initialPos[1] + lngOff];
    const driverName = (ordersForStops[0] && ordersForStops[0].driver_name) ? ordersForStops[0].driver_name : "";
    const firstName = (driverName.trim().split(/\s+/)[0] || "").trim() || "—";
    const destLabel =
      numSegments > 0
        ? (stops[activeSegment + 1] ? stops[activeSegment + 1].label : "")
        : (stops[0] ? stops[0].label : "");

    const carMarker = new CarLabelOverlay(
      { lat: initialPos[0], lng: initialPos[1] },
      {
        plate: car.license_plate || "—",
        firstName: firstName,
        color: markerColor,
        map: map,
        title: (car.license_plate || "") + " · " + firstName + " → " + destLabel,
      }
    );
    carMarker._carIndex = ci;
    carMarker.onClick = function () {
      showCarDetail(ci);
    };
    carMarkers.push(carMarker);
  });

  Promise.all(directionPromises).then((results) => {
    results.forEach((r) => {
      if (r.path && r.path.length > 0) {
        carPathPerCar[r.ci] = r.path;
        carPathSegmentBounds[r.ci] = getPathSegmentBounds(r.path, r.stops);
        const line = new google.maps.Polyline({
          path: r.path,
          geodesic: true,
          strokeColor: r.routeColor || "#0ea5e9",
          strokeOpacity: 0.85,
          strokeWeight: 5,
          map: map,
        });
        routeLines.push(line);
        const pathBounds = carPathSegmentBounds[r.ci];
        const seg = carSegmentIndex[r.ci];
        if (pathBounds && seg >= 0 && seg < pathBounds.length - 1 && carMarkers[r.ci]) {
          const startIdx = pathBounds[seg];
          const p = r.path[startIdx];
          if (p) {
            let pos = typeof p.lat === "function" ? { lat: p.lat(), lng: p.lng() } : p;
            const off = carOffsets[r.ci];
            if (off) pos = { lat: pos.lat + off[0], lng: pos.lng + off[1] };
            carMarkers[r.ci].setPosition(pos);
          }
        }
      }
    });
    const allPoints = [];
    withCoords.forEach((b) => {
      allPoints.push({ lat: Number(b.branch_latitude), lng: Number(b.branch_longitude) });
    });
    routeCars.forEach((car) => {
      (car.orders || []).forEach((o) => {
        if (o.branch_latitude != null && o.branch_longitude != null)
          allPoints.push({ lat: Number(o.branch_latitude), lng: Number(o.branch_longitude) });
      });
    });
    if (allPoints.length > 0) {
      if (!radarInitialFitDone) {
        const b = new google.maps.LatLngBounds();
        allPoints.forEach((p) => b.extend(p));
        map.fitBounds(b, 40);
        radarInitialFitDone = true;
      } else if (savedLat != null && savedLng != null && savedZoom != null) {
        map.setCenter({ lat: savedLat, lng: savedLng });
        map.setZoom(savedZoom);
      }
    }
  });

  if (carMarkers.length > 0) {
    radarAnimationId = setInterval(runRadarCarStep, RADAR_ANIMATION_INTERVAL_MS);
  }
}

function renderInfoPanel() {
  if (!radarInfoContent) return;
  const cars = getFilteredCars();
  const branchCount = (branches || []).filter(
    (b) => b.branch_latitude != null && b.branch_longitude != null
  ).length;
  if (radarLegend) radarLegend.textContent = "Branches: " + branchCount;

  if (cars.length === 0) {
    const filter = getRouteTypeFilterValue();
    const msg = filter
      ? "No cars on route for this route type. Try \"All\" or assign orders on the Routes page."
      : "No cars on route. Assign orders on the Routes page.";
    radarInfoContent.innerHTML = "<p class=\"text-slate-500\">" + msg + "</p>";
    return;
  }
  radarInfoContent.innerHTML = cars
    .map(
      (car, i) => {
        const driverName = (car.orders && car.orders[0] && car.orders[0].driver_name) ? car.orders[0].driver_name : "—";
        const firstName = (driverName.trim().split(/\s+/)[0] || "").trim() || "—";
        return (
          '<button type="button" class="radar-car-btn w-full text-left px-3 py-2.5 rounded-lg border border-slate-200 hover:bg-sky-50 hover:border-sky-200 mb-2 last:mb-0" data-car-index="' +
          i +
          '">' +
          "<div class=\"font-medium text-slate-800\">" +
          escapeHtml(car.license_plate || "—") +
          "</div>" +
          "<div class=\"text-xs text-slate-500\">" +
          escapeHtml(firstName) +
          " · " +
          (car.orders ? car.orders.length : 0) +
          " order(s)</div>" +
          "</button>"
        );
      }
    )
    .join("");
  radarInfoContent.querySelectorAll(".radar-car-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.carIndex, 10);
      if (!isNaN(idx)) showCarDetail(idx);
    });
  });
}

function showCarDetail(carIndex) {
  const cars = getFilteredCars();
  const car = cars[carIndex];
  if (!car || !carDetailPanel) return;
  carDetailPlate.textContent = car.license_plate || "—";
  carDetailType.textContent = car.cars_type_name || "—";
  const orders = car.orders || [];
  const routeStops = [];
  orders.forEach((o) => {
    routeStops.push(escapeHtml(o.branch_name || "—") + " <span class=\"text-slate-400\">(" + formatStatus(o.delivery_status) + ")</span>");
  });
  carDetailRoute.innerHTML = routeStops.length
    ? routeStops.map((s) => "<div class=\"py-0.5\">" + s + "</div>").join("")
    : "<p class=\"text-slate-500\">No stops</p>";
  carDetailOrders.innerHTML = orders.length
    ? orders
        .map(
          (o, i) =>
            "<li class=\"flex justify-between gap-2 py-1 border-b border-slate-100 last:border-0\">" +
            "<span>จุดที่ " + (i + 1) + " — " + escapeHtml(o.branch_name || "—") + "</span>" +
            "<span class=\"text-slate-500\">" + formatStatus(o.delivery_status) + "</span></li>"
        )
        .join("")
    : "<li class=\"text-slate-500\">ไม่มีจุดแวะ</li>";
  const inTransit = orders.filter((o) => o.delivery_status === "in_transit").length;
  const delivered = orders.filter((o) => o.delivery_status === "delivered").length;
  const loaded = orders.filter((o) => o.delivery_status === "loaded").length;
  const parts = [];
  if (loaded > 0) parts.push(loaded + " loaded");
  if (inTransit > 0) parts.push(inTransit + " in transit");
  if (delivered > 0) parts.push(delivered + " delivered");
  carDetailStatus.textContent = parts.length ? parts.join(", ") : "—";
  if (carDetailDebug) {
    const sid = car.shipment_id;
    const isCompleted = (car.status || "").toUpperCase() === "COMPLETED";
    if (sid && !isCompleted) {
      carDetailDebug.classList.remove("hidden");
      carDetailDebug.dataset.shipmentId = String(sid);
    } else {
      carDetailDebug.classList.add("hidden");
      delete carDetailDebug.dataset.shipmentId;
    }
  }
  carDetailPanel.classList.remove("hidden");
}

function closeCarDetail() {
  if (carDetailPanel) carDetailPanel.classList.add("hidden");
}

async function loadData() {
  const [branchesRes, byCarRes] = await Promise.all([
    fetch("/api/branches"),
    fetch("/api/orders/by-car"),
  ]);
  branches = branchesRes.ok ? await branchesRes.json() : [];
  if (!Array.isArray(branches)) branches = [];
  byCarData = byCarRes.ok ? await byCarRes.json() : { cars: [] };
  if (!byCarData.cars) byCarData.cars = [];
}

function refresh() {
  loadData()
    .then(() => {
      updateMapMarkers();
      renderInfoPanel();
    })
    .catch((err) => {
      if (radarInfoContent) {
        radarInfoContent.innerHTML =
          "<p class=\"text-red-500 font-medium\">Failed to load data.</p>" +
          "<p class=\"text-slate-600 text-sm mt-2\">Is the API server running? In a separate terminal run: <code class=\"bg-slate-100 px-1 rounded\">npm run server</code> (port 3001).</p>" +
          "<p class=\"text-slate-500 text-xs mt-1\">" + escapeHtml(err && err.message ? err.message : "Network or server error") + "</p>";
      }
    });
}

function init() {
  if (!window.google || !window.google.maps) return;
  defineCarLabelOverlay();
  initMap();
  refresh();
  if (radarRefreshBtn) radarRefreshBtn.addEventListener("click", refresh);
  if (carDetailClose) carDetailClose.addEventListener("click", closeCarDetail);
  if (carDetailDebugInTransit) {
    carDetailDebugInTransit.addEventListener("click", function () {
      const sid = carDetailDebug && carDetailDebug.dataset.shipmentId;
      if (!sid) return;
      carDetailDebugInTransit.disabled = true;
      fetch("/api/v2/shipments/" + encodeURIComponent(sid) + "/debug/advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "to_in_transit" }),
      })
        .then((r) => r.json())
        .then(() => { refresh(); })
        .catch(() => { if (radarInfoContent) radarInfoContent.innerHTML = "<p class=\"text-red-500\">Debug request failed.</p>"; })
        .finally(() => { carDetailDebugInTransit.disabled = false; });
    });
  }
  if (carDetailDebugComplete) {
    carDetailDebugComplete.addEventListener("click", function () {
      const sid = carDetailDebug && carDetailDebug.dataset.shipmentId;
      if (!sid) return;
      carDetailDebugComplete.disabled = true;
      fetch("/api/v2/shipments/" + encodeURIComponent(sid) + "/debug/advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "complete" }),
      })
        .then((r) => r.json())
        .then(() => { refresh(); closeCarDetail(); })
        .catch(() => { if (radarInfoContent) radarInfoContent.innerHTML = "<p class=\"text-red-500\">Debug request failed.</p>"; })
        .finally(() => { carDetailDebugComplete.disabled = false; });
    });
  }
  if (radarRouteTypeFilter) {
    radarRouteTypeFilter.addEventListener("change", () => {
      updateMapMarkers();
      renderInfoPanel();
      closeCarDetail();
    });
  }
  if (radarAutoRefreshId) clearInterval(radarAutoRefreshId);
  radarAutoRefreshId = setInterval(refresh, RADAR_AUTO_REFRESH_MS);
}

window.initRouteRadar = init;
