const state = {
  token: "",
  user: null,
  currentRide: null,
  rideTimer: null,
  selectedRating: 5,
  avatarDataUrl: "",
  speakingEnabled: "speechSynthesis" in window,
  mapConfig: null,
  mapsReady: false,
  map: null,
  trafficLayer: null,
  directionsService: null,
  directionsRenderer: null,
  placesAutocomplete: null,
  geocoder: null,
  liveMarker: null,
  routePath: [],
  routeSteps: [],
  routeLine: null,
  routeMarkers: [],
  geolocationWatchId: null,
  lastKnownPosition: null,
  lastPositionSample: null,
  smoothedSpeedKmh: 0,
  deviceHeading: null,
  motionSamples: [],
  liveMotionConfirmed: false,
  trackingActive: false
};

const authScreen = document.querySelector("#authScreen");
const dashboardScreen = document.querySelector("#dashboardScreen");
const driverWorkspace = document.querySelector("#driverWorkspace");
const adminScreen = document.querySelector("#adminScreen");
const adminWorkspace = document.querySelector("#adminWorkspace");
const authMessage = document.querySelector("#authMessage");
const welcomeText = document.querySelector("#welcomeText");
const profileButton = document.querySelector("#profileButton");
const topbarAvatar = document.querySelector("#topbarAvatar");
const profileDrawer = document.querySelector("#profileDrawer");
const profileForm = document.querySelector("#profileForm");
const avatarInput = document.querySelector("#avatarInput");
const profilePreview = document.querySelector("#profilePreview");
const themeSelect = document.querySelector("#themeSelect");
const authThemeSelect = document.querySelector("#authThemeSelect");
const loginSplash = document.querySelector("#loginSplash");
const routeForm = document.querySelector("#routeForm");
const stopsContainer = document.querySelector("#stopsContainer");
const rideMetrics = document.querySelector("#rideMetrics");
const routeNarrative = document.querySelector("#routeNarrative");
const mapCanvas = document.querySelector("#mapCanvas");
const navStatus = document.querySelector("#navStatus");
const beginRideBtn = document.querySelector("#beginRideBtn");
const rerouteBtn = document.querySelector("#rerouteBtn");
const cancelRideBtn = document.querySelector("#cancelRideBtn");
const fullscreenMapBtn = document.querySelector("#fullscreenMapBtn");
const ratingDialog = document.querySelector("#ratingDialog");
const ratingForm = document.querySelector("#ratingForm");
const ratingFeedback = document.querySelector("#ratingFeedback");
const starRow = document.querySelector("#starRow");
const adminMetrics = document.querySelector("#adminMetrics");
const ratingsList = document.querySelector("#ratingsList");
const adminMetricsOnly = document.querySelector("#adminMetricsOnly");
const ratingsListOnly = document.querySelector("#ratingsListOnly");

document.querySelectorAll("[data-auth-tab]").forEach((button) => {
  button.addEventListener("click", () => switchAuthTab(button.dataset.authTab));
});

document.querySelectorAll("[data-toggle-password]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = button.parentElement.querySelector("input");
    input.type = input.type === "password" ? "text" : "password";
  });
});

document.querySelector("#loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  handleLogin(event.currentTarget, "driver");
});

document.querySelector("#adminForm").addEventListener("submit", (event) => {
  event.preventDefault();
  handleLogin(event.currentTarget, "admin");
});

document.querySelector("#registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const raw = Object.fromEntries(new FormData(event.currentTarget).entries());
  const formData = {
    firstName: raw.routeai_register_first_name,
    lastName: raw.routeai_register_last_name,
    email: raw.routeai_register_email,
    mobile: raw.routeai_register_mobile,
    vehicleNumber: raw.routeai_register_vehicle_number,
    vehicleType: raw.routeai_register_vehicle_type,
    password: raw.routeai_register_password,
    confirmPassword: raw.routeai_register_confirm_password
  };
  const result = await api("/api/register", {
    method: "POST",
    body: JSON.stringify(formData)
  });
  authMessage.textContent = result.error || "Registration successful. You can now log in.";
  if (!result.error) {
    event.currentTarget.reset();
    switchAuthTab("login");
  }
});

profileButton.addEventListener("click", () => profileDrawer.classList.remove("hidden"));
document.querySelector("#closeDrawerBtn").addEventListener("click", () => {
  profileDrawer.classList.add("hidden");
});

avatarInput.addEventListener("change", async () => {
  const file = avatarInput.files?.[0];
  if (!file) return;
  state.avatarDataUrl = await fileToDataUrl(file);
  profilePreview.src = state.avatarDataUrl;
});

document.querySelector("#logoutBtn").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  localStorage.removeItem("routeai-token");
  stopRideAnimation();
  stopLiveTracking();
  state.token = "";
  state.user = null;
  state.currentRide = null;
  authScreen.classList.remove("hidden");
  dashboardScreen.classList.add("hidden");
  profileDrawer.classList.add("hidden");
  profileButton.classList.add("hidden");
  topbarAvatar.classList.add("hidden");
  switchAuthTab("login");
});

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = Object.fromEntries(new FormData(event.currentTarget).entries());
  const result = await api("/api/profile", {
    method: "PUT",
    body: JSON.stringify({
      ...formData,
      avatarDataUrl: state.avatarDataUrl
    })
  });
  if (result.user) {
    state.user = result.user;
    hydrateUser();
  }
});

themeSelect.addEventListener("change", async () => {
  applyTheme(themeSelect.value);
  if (authThemeSelect) authThemeSelect.value = themeSelect.value;
  const result = await api("/api/preferences", {
    method: "PUT",
    body: JSON.stringify({ theme: themeSelect.value })
  });
  if (result.user) state.user = result.user;
});

authThemeSelect.addEventListener("change", async () => {
  applyTheme(authThemeSelect.value);
  themeSelect.value = authThemeSelect.value;
  if (state.user) {
    const result = await api("/api/preferences", {
      method: "PUT",
      body: JSON.stringify({ theme: authThemeSelect.value })
    });
    if (result.user) state.user = result.user;
    return;
  }
  sessionStorage.setItem("routeai-theme", authThemeSelect.value);
});

document.querySelector("#addStopBtn").addEventListener("click", () => addStopCard());
document.querySelector("#liveLocationBtn").addEventListener("click", useLiveLocation);

routeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = collectRoutePayload();
  if (!payload) return;

  const endpoint = state.currentRide?.rideId ? `/api/rides/${state.currentRide.rideId}` : "/api/rides";
  const method = state.currentRide?.rideId ? "PUT" : "POST";
  const result = await api(endpoint, {
    method,
    body: JSON.stringify(payload)
  });

  if (result.error) {
    routeNarrative.textContent = result.error;
    return;
  }

  state.currentRide = {
    rideId: result.rideId || state.currentRide.rideId,
    payload,
    ridePlan: result.ridePlan
  };

  if (state.mapsReady) {
    await renderRealRoute(payload);
  } else {
    renderFallbackRidePlan(result.ridePlan);
  }

  navStatus.textContent = method === "POST" ? "Route ready" : "Route updated";
  beginRideBtn.disabled = false;
  rerouteBtn.disabled = false;
  cancelRideBtn.disabled = false;
});

beginRideBtn.addEventListener("click", () => {
  if (!state.currentRide) return;
  beginRideBtn.disabled = true;
  navStatus.textContent = "Navigation active";
  startRideAnimation();
  startLiveTracking();
});

rerouteBtn.addEventListener("click", async () => {
  if (!state.currentRide) return;
  const payload = JSON.parse(JSON.stringify(state.currentRide.payload));
  if (state.lastKnownPosition) {
    payload.start = {
      label: "Current live position",
      lat: state.lastKnownPosition.lat,
      lng: state.lastKnownPosition.lng
    };
  } else {
    payload.start = simulateDeviation(payload.start);
  }

  const result = await api(`/api/rides/${state.currentRide.rideId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });

  if (result.ridePlan) {
    state.currentRide.payload = payload;
    state.currentRide.ridePlan = result.ridePlan;
    if (state.mapsReady) {
      await renderRealRoute(payload);
    } else {
      renderFallbackRidePlan(result.ridePlan);
    }
    navStatus.textContent = "Route recalculated";
    startRideAnimation();
  }
});

cancelRideBtn.addEventListener("click", async () => {
  if (!state.currentRide) return;
  stopRideAnimation();
  stopLiveTracking();
  await api(`/api/rides/${state.currentRide.rideId}/status`, {
    method: "POST",
    body: JSON.stringify({ status: "cancelled" })
  });
  openRatingDialog("Ride cancelled");
});

fullscreenMapBtn.addEventListener("click", async () => {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    setTimeout(() => state.map?.invalidateSize(), 200);
    return;
  }
  await mapCanvas.requestFullscreen();
  setTimeout(() => state.map?.invalidateSize(), 200);
});

ratingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.currentRide?.rideId) {
    await api(`/api/rides/${state.currentRide.rideId}/rating`, {
      method: "POST",
      body: JSON.stringify({
        stars: state.selectedRating,
        feedback: ratingFeedback.value
      })
    });
  }

  ratingDialog.close();
  ratingFeedback.value = "";
  routeForm.reset();
  stopsContainer.innerHTML = "";
  state.currentRide = null;
  stopRideAnimation();
  stopLiveTracking();
  resetPlannerView();
  if (state.user?.role === "admin") fetchAdminSummary();
});

buildStars();
switchAuthTab("login");
bootstrap();

async function bootstrap() {
  localStorage.removeItem("routeai-token");
  state.mapConfig = await api("/api/config");
  initLeafletMap();
  wireAutocomplete("startInput", "startSuggestions");
  wireAutocomplete("endInput", "endSuggestions");
  document.querySelector("#loginForm").reset();
  document.querySelector("#adminForm").reset();
  document.querySelector("#registerForm").reset();
  const initialTheme = sessionStorage.getItem("routeai-theme") || "system";
  authThemeSelect.value = initialTheme;
  themeSelect.value = initialTheme;
  applyTheme(initialTheme);
  setupOrientationTracking();
  await restoreSession();
}

function switchAuthTab(tab) {
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.authTab === tab);
  });
  document.querySelector("#loginForm").classList.toggle("hidden", tab !== "login");
  document.querySelector("#registerForm").classList.toggle("hidden", tab !== "register");
  document.querySelector("#adminForm").classList.toggle("hidden", tab !== "admin");
  authMessage.textContent = "";
}

async function handleLogin(form, role) {
  const raw = Object.fromEntries(new FormData(form).entries());
  const payload = role === "admin"
    ? { email: raw.routeai_admin_email, password: raw.routeai_admin_password }
    : { email: raw.routeai_login_email, password: raw.routeai_login_password };
  const result = await api("/api/login", {
    method: "POST",
    body: JSON.stringify({ ...payload, role })
  });

  if (result.error) {
    authMessage.textContent = result.error;
    return;
  }

  state.token = result.token;
  state.user = result.user;
  await playLoginSplash();
  authScreen.classList.add("hidden");
  dashboardScreen.classList.remove("hidden");
  profileButton.classList.remove("hidden");
  hydrateUser();
  renderWorkspace();
  setTimeout(() => state.map?.invalidateSize(), 250);
  if (role === "admin") fetchAdminSummary();
}

async function restoreSession() {
  if (!state.token) return;
  const result = await api("/api/me");
  if (result.error) {
    localStorage.removeItem("routeai-token");
    state.token = "";
    return;
  }

  state.user = result.user;
  authScreen.classList.add("hidden");
  dashboardScreen.classList.remove("hidden");
  profileButton.classList.remove("hidden");
  hydrateUser();
  renderWorkspace();
  setTimeout(() => state.map?.invalidateSize(), 250);
  if (state.user.role === "admin") fetchAdminSummary();
}

function renderWorkspace() {
  const isAdmin = state.user?.role === "admin";
  driverWorkspace.classList.toggle("hidden", isAdmin);
  adminWorkspace.classList.toggle("hidden", !isAdmin);
  adminScreen.classList.add("hidden");
}

function hydrateUser() {
  welcomeText.textContent = `${state.user.firstName} ${state.user.lastName}`;
  profileForm.firstName.value = state.user.firstName;
  profileForm.lastName.value = state.user.lastName;
  state.avatarDataUrl = state.user.avatarDataUrl || "";
  profilePreview.src = state.avatarDataUrl || avatarPlaceholder();
  topbarAvatar.src = state.avatarDataUrl || avatarPlaceholder();
  topbarAvatar.classList.remove("hidden");
  themeSelect.value = state.user.theme;
  authThemeSelect.value = state.user.theme;
  document.querySelector("#routeVehicleType").value =
    ["bike", "car", "van", "truck"].includes(state.user.vehicleType) ? state.user.vehicleType : "";
  applyTheme(state.user.theme);
  sessionStorage.setItem("routeai-theme", state.user.theme);
}

function avatarPlaceholder() {
  return "data:image/svg+xml;utf8," + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">
      <rect width="100%" height="100%" rx="60" fill="#10304f"/>
      <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-size="42">👤</text>
    </svg>
  `);
}

function playLoginSplash() {
  if (!loginSplash) return Promise.resolve();
  loginSplash.classList.remove("hidden");
  loginSplash.classList.add("active");
  return new Promise((resolve) => {
    window.setTimeout(() => {
      loginSplash.classList.remove("active");
      loginSplash.classList.add("hidden");
      resolve();
    }, 1700);
  });
}

function applyTheme(theme) {
  if (theme === "system") {
    document.body.dataset.theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    return;
  }
  document.body.dataset.theme = theme;
}

function addStopCard(stop = null) {
  const index = stopsContainer.children.length;
  const card = document.createElement("div");
  card.className = "stop-card";
  card.innerHTML = `
    <div class="stop-row">
      <div class="autocomplete-wrap">
        <label>Stop ${index + 1}
          <input class="stop-label" placeholder="Enter delivery stop" autocomplete="off" />
          <div class="suggestions"></div>
        </label>
      </div>
      <label>Minutes
        <div class="stepper">
          <input class="stop-minutes" type="number" min="0" value="${stop?.stopMinutes || 10}" />
          <div class="stepper-buttons">
            <button type="button" class="minute-up">▲</button>
            <button type="button" class="minute-down">▼</button>
          </div>
        </div>
      </label>
      <button class="danger-button remove-stop" type="button">✕</button>
    </div>
  `;

  stopsContainer.appendChild(card);
  const input = card.querySelector(".stop-label");
  const suggestionBox = card.querySelector(".suggestions");
  wireAutocompleteElement(input, suggestionBox);

  if (stop) {
    input.value = stop.label;
    input.dataset.lat = String(stop.lat);
    input.dataset.lng = String(stop.lng);
  }

  const minuteInput = card.querySelector(".stop-minutes");
  card.querySelector(".minute-up").addEventListener("click", () => {
    minuteInput.value = String(Number(minuteInput.value || 0) + 1);
  });
  card.querySelector(".minute-down").addEventListener("click", () => {
    minuteInput.value = String(Math.max(0, Number(minuteInput.value || 0) - 1));
  });
  card.querySelector(".remove-stop").addEventListener("click", () => card.remove());
}

function wireAutocomplete(inputId, suggestionId) {
  wireAutocompleteElement(
    document.querySelector(`#${inputId}`),
    document.querySelector(`#${suggestionId}`)
  );
}

function wireAutocompleteElement(input, suggestionBox) {
  let debounceTimer = null;
  input.addEventListener("input", async () => {
    clearTimeout(debounceTimer);
    const value = input.value.trim();
    if (value.length < 2) {
      suggestionBox.classList.remove("visible");
      suggestionBox.innerHTML = "";
      return;
    }

    debounceTimer = setTimeout(async () => {
      const suggestions = state.mapsReady
        ? await fetchLeafletSuggestions(value)
        : await fetchFallbackSuggestions(value);

      suggestionBox.innerHTML = "";
      suggestions.forEach((location) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "suggestion-item";
        button.textContent = location.label;
        button.addEventListener("click", () => {
          input.value = location.label;
          input.dataset.lat = String(location.lat);
          input.dataset.lng = String(location.lng);
          suggestionBox.classList.remove("visible");
        });
        suggestionBox.appendChild(button);
      });
      suggestionBox.classList.toggle("visible", Boolean(suggestionBox.children.length));
    }, 220);
  });
}

async function fetchFallbackSuggestions(query) {
  const result = await api(`/api/locations?q=${encodeURIComponent(query)}`);
  return (result.locations || []).map((item) => ({
    label: item.name,
    lat: item.lat,
    lng: item.lng
  }));
}

async function fetchLeafletSuggestions(query) {
  const params = new URLSearchParams({ q: query });
  if (state.lastKnownPosition) {
    params.set("liveLat", String(state.lastKnownPosition.lat));
    params.set("liveLng", String(state.lastKnownPosition.lng));
  }
  const response = await api(`/api/place-search?${params.toString()}`);
  return (response.locations || []).map((location) => ({
    label: location.label,
    lat: location.lat,
    lng: location.lng
  }));
}

function useLiveLocation() {
  if (!navigator.geolocation) {
    routeNarrative.textContent = "Live location is not available in this browser.";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      state.lastKnownPosition = { lat, lng };
      const input = document.querySelector("#startInput");
      const label = await reverseGeocode(lat, lng);
      input.value = label;
      input.dataset.lat = String(lat);
      input.dataset.lng = String(lng);
    },
    () => {
      routeNarrative.textContent = "Unable to fetch live location. Please type the start point.";
    }
  );
}

function collectRoutePayload() {
  const start = extractPoint(document.querySelector("#startInput"));
  const end = extractPoint(document.querySelector("#endInput"));
  const vehicleType = document.querySelector("#routeVehicleType").value;
  const stops = [...stopsContainer.querySelectorAll(".stop-card")]
    .map((card) => {
      const point = extractPoint(card.querySelector(".stop-label"), false);
      if (!point) return null;
      point.stopMinutes = Math.max(0, Number(card.querySelector(".stop-minutes").value || 0));
      return point;
    })
    .filter(Boolean);

  if (!start || !end || !vehicleType) {
    routeNarrative.textContent = "Select valid suggestions for the start and destination, then choose a vehicle.";
    return null;
  }

  return { start, end, stops, vehicleType };
}

function extractPoint(input, required = true) {
  const label = input.value.trim();
  const lat = Number(input.dataset.lat);
  const lng = Number(input.dataset.lng);
  if (!label && !required) return null;
  if (!label || Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { label, lat, lng };
}

async function renderRealRoute(payload) {
  const coordinates = [
    [payload.start.lng, payload.start.lat],
    ...payload.stops.map((stop) => [stop.lng, stop.lat]),
    [payload.end.lng, payload.end.lat]
  ];
  const result = await api("/api/road-route", {
    method: "POST",
    body: JSON.stringify({
      coordinates,
      profile: routeProfile(payload.vehicleType)
    })
  });

  if (result.error) {
    const browserRoute = await tryBrowserOsrmRoute(coordinates);
    if (browserRoute) {
      renderOsrmRoadRoute(browserRoute, payload);
      return;
    }
    clearRenderedRoute();
    drawRouteMarkers(payload);
    state.map.fitBounds(L.featureGroup(state.routeMarkers).getBounds(), { padding: [30, 30] });
    routeNarrative.textContent = "Road routing is temporarily unavailable. Please try again in a moment.";
    return;
  }

  if (result.provider === "openrouteservice") {
    renderOrsRoadRoute(result.data, payload);
    return;
  }

  renderOsrmRoadRoute(result.data, payload);
}

function renderOrsRoadRoute(data, payload) {
  const feature = data.features?.[0];
  if (!feature) {
    clearRenderedRoute();
    drawRouteMarkers(payload);
    return;
  }

  if (state.routeLine) state.routeLine.remove();
  if (state.routeMarkers) state.routeMarkers.forEach((marker) => marker.remove());
  const latLngs = feature.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  state.routePath = latLngs.map(([lat, lng]) => ({ lat, lng }));
  state.routeSteps = feature.properties.segments.flatMap((segment) => segment.steps || []);
  state.routeLine = L.polyline(latLngs, {
    color: "#2ba4ff",
    weight: 7,
    opacity: 0.95
  }).addTo(state.map);
  state.map.fitBounds(state.routeLine.getBounds(), { padding: [30, 30] });
  drawRouteMarkers(payload);

  const summary = summarizeOrsRoute(feature, payload);
  renderMetrics(summary);
  routeNarrative.innerHTML = feature.properties.segments
    .flatMap((segment) => segment.steps || [])
    .slice(0, 6)
    .map((step, index) => `${index + 1}. ${step.instruction} • ${Math.round(step.distance)} m`)
    .join("<br />");
}

function renderOsrmRoadRoute(data, payload) {
  const route = data.routes?.[0];
  if (!route) {
    clearRenderedRoute();
    drawRouteMarkers(payload);
    return;
  }

  if (state.routeLine) state.routeLine.remove();
  if (state.routeMarkers) state.routeMarkers.forEach((marker) => marker.remove());
  const latLngs = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  state.routePath = latLngs.map(([lat, lng]) => ({ lat, lng }));
  state.routeSteps = route.legs.flatMap((leg) => leg.steps || []).map((step) => ({
    instruction: formatOsrmInstruction(step),
    distance: step.distance
  }));
  state.routeLine = L.polyline(latLngs, {
    color: "#2ba4ff",
    weight: 7,
    opacity: 0.95
  }).addTo(state.map);
  state.map.fitBounds(state.routeLine.getBounds(), { padding: [30, 30] });
  drawRouteMarkers(payload);
  renderMetrics(summarizeOsrmRoute(route, payload));
  routeNarrative.innerHTML = state.routeSteps
    .slice(0, 6)
    .map((step, index) => `${index + 1}. ${step.instruction} • ${Math.round(step.distance)} m`)
    .join("<br />");
}

function summarizeOrsRoute(feature, payload) {
  const summaryData = feature.properties.summary;
  const distanceMeters = summaryData.distance || 0;
  const durationSeconds = summaryData.duration || 0;
  const stopMinutes = payload.stops.reduce((sum, stop) => sum + Number(stop.stopMinutes || 0), 0);
  const totalSeconds = durationSeconds + (stopMinutes * 60);
  const distanceKm = distanceMeters / 1000;
  const averageSpeed = distanceKm / Math.max(durationSeconds / 3600, 0.1);
  const fuelTable = { bike: 42, car: 15, van: 11, truck: 6 };
  const fuelLiters = distanceKm / fuelTable[payload.vehicleType];
  const arrivalDate = new Date(Date.now() + totalSeconds * 1000);
  const trafficLevel = averageSpeed < 28 ? "High" : averageSpeed < 40 ? "Moderate" : "Light";

  return {
    totalDistanceKm: distanceKm.toFixed(1),
    fuelLiters: fuelLiters.toFixed(1),
    etaLabel: formatDuration(totalSeconds / 60),
    arrivalTimeLabel: arrivalDate.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }),
    averageSpeedKmh: Math.round(averageSpeed),
    trafficLevel
  };
}

function summarizeOsrmRoute(route, payload) {
  const distanceMeters = route.distance || 0;
  const durationSeconds = route.duration || 0;
  const stopMinutes = payload.stops.reduce((sum, stop) => sum + Number(stop.stopMinutes || 0), 0);
  const totalSeconds = durationSeconds + (stopMinutes * 60);
  const distanceKm = distanceMeters / 1000;
  const averageSpeed = distanceKm / Math.max(durationSeconds / 3600, 0.1);
  const fuelLiters = distanceKm / fuelEfficiencyForVehicle(payload.vehicleType);
  const arrivalDate = new Date(Date.now() + totalSeconds * 1000);

  return {
    totalDistanceKm: distanceKm.toFixed(1),
    fuelLiters: fuelLiters.toFixed(1),
    etaLabel: formatDuration(totalSeconds / 60),
    arrivalTimeLabel: arrivalDate.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }),
    averageSpeedKmh: Math.round(averageSpeed),
    trafficLevel: averageSpeed < 28 ? "High" : averageSpeed < 40 ? "Moderate" : "Light"
  };
}

function formatOsrmInstruction(step) {
  if (step.maneuver?.instruction) return step.maneuver.instruction;
  const type = step.maneuver?.type || "continue";
  const modifier = step.maneuver?.modifier ? ` ${step.maneuver.modifier}` : "";
  const roadName = step.name ? ` on ${step.name}` : "";
  return `${type}${modifier}${roadName}`.trim();
}

async function tryBrowserOsrmRoute(coordinates) {
  try {
    const coordString = coordinates.map(([lng, lat]) => `${lng},${lat}`).join(";");
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson&steps=true`
    );
    const data = await response.json();
    return data.routes?.length ? data : null;
  } catch {
    return null;
  }
}

function clearRenderedRoute() {
  if (state.routeLine) {
    state.routeLine.remove();
    state.routeLine = null;
  }
  if (state.routeMarkers?.length) {
    state.routeMarkers.forEach((marker) => marker.remove());
    state.routeMarkers = [];
  }
  state.routePath = [];
  state.routeSteps = [];
}

function renderFallbackRidePlan(ridePlan, payload = state.currentRide?.payload) {
  clearRenderedRoute();
  drawRouteMarkers(payload);
  if (state.routeMarkers.length) {
    state.map.fitBounds(L.featureGroup(state.routeMarkers).getBounds(), { padding: [30, 30] });
  }
  renderMetrics({
    totalDistanceKm: ridePlan.summary.totalDistanceKm,
    fuelLiters: ridePlan.summary.fuelLiters,
    etaLabel: ridePlan.summary.etaLabel,
    arrivalTimeLabel: ridePlan.summary.arrivalTimeLabel,
    averageSpeedKmh: ridePlan.summary.averageSpeedKmh,
    trafficLevel: ridePlan.summary.trafficLevel
  });
  routeNarrative.textContent = "Road routing is not available yet for this route. Markers are shown on the real map.";
}

function renderMetrics(summary) {
  const displaySpeed = state.trackingActive
    ? `${state.liveMotionConfirmed ? summary.averageSpeedKmh : 0} km/h`
    : `${summary.averageSpeedKmh} km/h`;
  const displayEta = state.trackingActive && !state.liveMotionConfirmed
    ? "--"
    : summary.etaLabel;
  const displayArrival = state.trackingActive && !state.liveMotionConfirmed
    ? "--"
    : summary.arrivalTimeLabel;
  const displayTraffic = state.trackingActive && !state.liveMotionConfirmed
    ? "--"
    : summary.trafficLevel;
  rideMetrics.innerHTML = [
    ["Distance", `${summary.totalDistanceKm} km`],
    ["Fuel", `${summary.fuelLiters} L`],
    ["ETA", displayEta],
    ["Arrival", displayArrival],
    ["Speed", displaySpeed],
    ["Traffic", displayTraffic]
  ].map(([label, value]) => `<article><span>${label}</span><strong>${value}</strong></article>`).join("");
}

function startRideAnimation() {
  stopRideAnimation();
  state.trackingActive = true;
  state.liveMotionConfirmed = false;
  state.smoothedSpeedKmh = 0;
  state.motionSamples = [];
  const idlePoint = state.lastKnownPosition || state.currentRide?.payload?.start;
  if (idlePoint) renderIdleTrackingMetrics(idlePoint);
  startLeafletRideAnimation();
}

function startLeafletRideAnimation() {
  if (!state.routePath.length) return;
  if (!state.liveMarker) {
    state.liveMarker = L.marker([state.routePath[0].lat, state.routePath[0].lng], {
      icon: L.divIcon({
        className: "vehicle-live-marker",
        html: '<div style="font-size:24px;">🚚</div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })
    }).addTo(state.map);
  }

  const startPoint = state.lastKnownPosition || state.routePath[0];
  state.liveMarker.setLatLng([startPoint.lat, startPoint.lng]);
  state.map.panTo([startPoint.lat, startPoint.lng]);
  updateLiveMarkerRotation(state.deviceHeading);
  state.smoothedSpeedKmh = 0;
  state.motionSamples = [];
  state.liveMotionConfirmed = false;
  renderIdleTrackingMetrics(startPoint);
  navStatus.textContent = "Live tracking started";
  if (state.routeSteps[0]?.instruction) {
    speakDirection(cleanInstruction(state.routeSteps[0].instruction));
  }
}

async function completeRide() {
  stopRideAnimation();
  stopLiveTracking();
  navStatus.textContent = "Ride completed";
  await api(`/api/rides/${state.currentRide.rideId}/status`, {
    method: "POST",
    body: JSON.stringify({ status: "completed" })
  });
  openRatingDialog("Ride completed");
}

function stopRideAnimation() {
  state.trackingActive = false;
  if (state.liveMarker) {
    state.liveMarker.remove();
    state.liveMarker = null;
  }
  state.smoothedSpeedKmh = 0;
  state.lastPositionSample = null;
  state.motionSamples = [];
  state.liveMotionConfirmed = false;
}

function startLiveTracking() {
  if (!navigator.geolocation || !state.mapsReady || state.geolocationWatchId) return;
  state.geolocationWatchId = navigator.geolocation.watchPosition(
    async (position) => {
      const point = { lat: position.coords.latitude, lng: position.coords.longitude };
      state.lastKnownPosition = point;
      if (state.liveMarker) state.liveMarker.setLatLng([point.lat, point.lng]);
      state.map.panTo([point.lat, point.lng]);
      updateRideProgress(point, position);
      if (typeof position.coords.heading === "number" && !Number.isNaN(position.coords.heading)) {
        updateLiveMarkerRotation(position.coords.heading);
      }
      if (state.routePath.length && isOffRoute(point, state.routePath)) {
        navStatus.textContent = "Off route detected. Re-routing.";
        rerouteBtn.click();
      }
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 4000 }
  );
}

function stopLiveTracking() {
  if (state.geolocationWatchId) {
    navigator.geolocation.clearWatch(state.geolocationWatchId);
    state.geolocationWatchId = null;
  }
}

function isOffRoute(point, routePath) {
  let nearest = Infinity;
  routePath.forEach((routePoint) => {
    nearest = Math.min(nearest, haversineMeters(point, routePoint));
  });
  return nearest > 120;
}

function haversineMeters(a, b) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earth = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const arc = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(arc));
}

function updateRideProgress(point, position) {
  if (!state.currentRide) return;

  const remainingDistanceKm = computeRemainingDistanceKm(point);
  const fuelPerKm = fuelEfficiencyForVehicle(state.currentRide.payload.vehicleType);
  const currentSpeed = extractSpeedKmh(position);
  if (!state.liveMotionConfirmed) {
    renderIdleTrackingMetrics(point);
    return;
  }
  const etaMinutes = currentSpeed > 5 ? (remainingDistanceKm / currentSpeed) * 60 : "--";
  const arrival = typeof etaMinutes === "number"
    ? new Date(Date.now() + etaMinutes * 60_000).toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit"
    })
    : "--";

  renderMetrics({
    totalDistanceKm: remainingDistanceKm.toFixed(1),
    fuelLiters: (remainingDistanceKm / fuelPerKm).toFixed(1),
    etaLabel: typeof etaMinutes === "number" ? formatDuration(etaMinutes) : "--",
    arrivalTimeLabel: arrival,
    averageSpeedKmh: currentSpeed.toFixed(0),
    trafficLevel: currentSpeed < 20 ? "High" : currentSpeed < 35 ? "Moderate" : "Light"
  });

  routeNarrative.textContent = `Remaining distance ${remainingDistanceKm.toFixed(1)} km`;

  const destination = state.currentRide.payload.end;
  if (haversineMeters(point, destination) < 35) {
    completeRide();
  }
}

function renderIdleTrackingMetrics(point) {
  if (!state.currentRide) return;
  state.trackingActive = true;
  const remainingDistanceKm = computeRemainingDistanceKm(point);
  const fuelPerKm = fuelEfficiencyForVehicle(state.currentRide.payload.vehicleType);
  renderMetrics({
    totalDistanceKm: remainingDistanceKm.toFixed(1),
    fuelLiters: (remainingDistanceKm / fuelPerKm).toFixed(1),
    etaLabel: "--",
    arrivalTimeLabel: "--",
    averageSpeedKmh: 0,
    trafficLevel: "--"
  });
  routeNarrative.textContent = `Remaining distance ${remainingDistanceKm.toFixed(1)} km`;
}

function extractSpeedKmh(position) {
  const accuracy = Number(position.coords.accuracy || 9999);
  const currentPoint = {
    lat: position.coords.latitude,
    lng: position.coords.longitude
  };
  const now = Date.now();
  state.lastPositionSample = {
    point: currentPoint,
    time: now
  };

  if (accuracy > 25) {
    state.smoothedSpeedKmh = 0;
    state.motionSamples = [];
    state.liveMotionConfirmed = false;
    return 0;
  }

  state.motionSamples.push({
    point: currentPoint,
    time: now,
    accuracy
  });
  state.motionSamples = state.motionSamples.filter((sample) => now - sample.time <= 30000);

  if (state.motionSamples.length < 5) {
    state.smoothedSpeedKmh = 0;
    state.liveMotionConfirmed = false;
    return 0;
  }

  const oldestSample = state.motionSamples[0];
  const elapsedSeconds = (now - oldestSample.time) / 1000;
  const directDistanceMeters = haversineMeters(oldestSample.point, currentPoint);
  const totalPathMeters = state.motionSamples.slice(1).reduce((sum, sample, index) => {
    return sum + haversineMeters(state.motionSamples[index].point, sample.point);
  }, 0);
  const averageAccuracy = state.motionSamples.reduce((sum, sample) => sum + sample.accuracy, 0) / state.motionSamples.length;
  const stationaryThresholdMeters = Math.max(140, averageAccuracy * 6);
  const movementThresholdMeters = Math.max(180, averageAccuracy * 8);

  if (elapsedSeconds < 18) {
    state.smoothedSpeedKmh = 0;
    state.liveMotionConfirmed = false;
    return 0;
  }

  if (directDistanceMeters < stationaryThresholdMeters || totalPathMeters < movementThresholdMeters) {
    state.smoothedSpeedKmh = 0;
    state.liveMotionConfirmed = false;
    return 0;
  }

  const pathSpeedKmh = (totalPathMeters / 1000) / (elapsedSeconds / 3600);
  let rawSpeed = pathSpeedKmh;
  if (rawSpeed > 80) {
    state.smoothedSpeedKmh = 0;
    state.liveMotionConfirmed = false;
    return 0;
  }

  if (state.smoothedSpeedKmh && Math.abs(rawSpeed - state.smoothedSpeedKmh) > 12) {
    rawSpeed = (state.smoothedSpeedKmh * 0.8) + (rawSpeed * 0.2);
  }

  state.smoothedSpeedKmh = (state.smoothedSpeedKmh * 0.82) + (rawSpeed * 0.18);

  if (state.smoothedSpeedKmh < 8) {
    state.smoothedSpeedKmh = 0;
    state.liveMotionConfirmed = false;
    return 0;
  }

  if (directDistanceMeters >= movementThresholdMeters && totalPathMeters >= movementThresholdMeters * 1.1 && elapsedSeconds >= 18) {
    state.liveMotionConfirmed = true;
  }

  return state.smoothedSpeedKmh;
}

function computeRemainingDistanceKm(point) {
  if (!state.routePath.length) {
    return haversineMeters(point, state.currentRide.payload.end) / 1000;
  }

  let nearestIndex = 0;
  let nearestDistance = Infinity;
  state.routePath.forEach((routePoint, index) => {
    const distance = haversineMeters(point, routePoint);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  let totalMeters = nearestDistance;
  for (let i = nearestIndex; i < state.routePath.length - 1; i += 1) {
    totalMeters += haversineMeters(state.routePath[i], state.routePath[i + 1]);
  }
  return totalMeters / 1000;
}

function fuelEfficiencyForVehicle(vehicleType) {
  const table = {
    bike: 42,
    car: 15,
    van: 11,
    truck: 6
  };
  return table[vehicleType] || 15;
}

function setupOrientationTracking() {
  if (typeof window === "undefined") return;

  const handleOrientation = (event) => {
    const heading =
      typeof event.webkitCompassHeading === "number"
        ? event.webkitCompassHeading
        : typeof event.alpha === "number"
          ? 360 - event.alpha
          : null;

    if (heading === null || Number.isNaN(heading)) return;
    state.deviceHeading = heading;
    updateLiveMarkerRotation(heading);
  };

  window.addEventListener("deviceorientationabsolute", handleOrientation, true);
  window.addEventListener("deviceorientation", handleOrientation, true);
}

function updateLiveMarkerRotation(angle) {
  if (angle === null || angle === undefined) return;
  const markerContent = state.liveMarker?.getElement()?.querySelector("div");
  if (!markerContent) return;
  markerContent.style.transformOrigin = "center center";
  markerContent.style.transform = `rotate(${angle}deg)`;
}

function speakDirection(message) {
  if (!state.speakingEnabled || !message) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(message));
}

function cleanInstruction(instruction) {
  const container = document.createElement("div");
  container.innerHTML = instruction;
  return container.textContent || container.innerText || "";
}

function simulateDeviation(start) {
  return {
    ...start,
    lat: start.lat + 0.015,
    lng: start.lng + 0.008,
    label: `${start.label} (rerouted)`
  };
}

function openRatingDialog(statusText) {
  navStatus.textContent = statusText;
  ratingDialog.showModal();
}

function buildStars() {
  starRow.innerHTML = "";
  for (let i = 1; i <= 5; i += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `star ${i <= state.selectedRating ? "active" : ""}`;
    button.textContent = "★";
    button.addEventListener("click", () => {
      state.selectedRating = i;
      buildStars();
    });
    starRow.appendChild(button);
  }
}

function resetPlannerView() {
  renderMetrics({
    totalDistanceKm: "--",
    fuelLiters: "--",
    etaLabel: "--",
    arrivalTimeLabel: "--",
    averageSpeedKmh: "--",
    trafficLevel: "--"
  });
  routeNarrative.textContent = "Add start, destination, and delivery stops to generate your first route.";
  navStatus.textContent = "Awaiting route";
  beginRideBtn.disabled = true;
  rerouteBtn.disabled = true;
  cancelRideBtn.disabled = true;
  if (state.mapsReady) {
    clearRenderedRoute();
    if (state.liveMarker) state.liveMarker.remove();
    state.liveMarker = null;
    state.map.setView([12.9716, 77.5946], 11);
  } else {
    mapCanvas.innerHTML = "";
  }
}

async function fetchAdminSummary() {
  const result = await api("/api/admin/summary");
  if (result.error) return;

  const metricsMarkup = [
    ["Drivers", result.metrics.drivers],
    ["Active Rides", result.metrics.activeRides],
    ["Completed", result.metrics.completedRides],
    ["Avg Rating", result.metrics.avgRating]
  ].map(([label, value]) => `<article><span>${label}</span><strong>${value}</strong></article>`).join("");

  const ratingsMarkup = result.ratings.length
    ? result.ratings.map((rating) => `
      <article>
        <strong>${rating.name}</strong>
        <p>${"★".repeat(rating.stars)}${"☆".repeat(5 - rating.stars)}</p>
        <p>${rating.feedback || "No written feedback provided."}</p>
      </article>
    `).join("")
    : "<article><strong>No ratings yet.</strong><p>Driver reviews will appear here.</p></article>";

  adminMetrics.innerHTML = metricsMarkup;
  ratingsList.innerHTML = ratingsMarkup;
  adminMetricsOnly.innerHTML = metricsMarkup;
  ratingsListOnly.innerHTML = ratingsMarkup;
}

function initLeafletMap() {
  if (typeof L === "undefined") {
    mapCanvas.innerHTML = `<div class="map-overlay-text">Leaflet failed to load. Check your internet connection.</div>`;
    return;
  }

  state.mapsReady = true;
  state.map = L.map(mapCanvas, {
    zoomControl: true
  }).setView([12.9716, 77.5946], 11);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(state.map);
}

async function reverseGeocode(lat, lng) {
  const response = await api(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
  return response.label || `Current location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
}

function routeProfile(vehicleType) {
  if (vehicleType === "bike") return "cycling-regular";
  if (vehicleType === "truck" || vehicleType === "van") return "driving-hgv";
  return "driving-car";
}

function drawRouteMarkers(payload) {
  state.routeMarkers = [];
  const points = [
    { label: payload.start.label, lat: payload.start.lat, lng: payload.start.lng, emoji: "🚚" },
    ...payload.stops.map((stop) => ({ label: stop.label, lat: stop.lat, lng: stop.lng, emoji: "📦" })),
    { label: payload.end.label, lat: payload.end.lat, lng: payload.end.lng, emoji: "📍" }
  ];

  points.forEach((point) => {
    const marker = L.marker([point.lat, point.lng], {
      icon: L.divIcon({
        className: "route-emoji-marker",
        html: `<div style="font-size:24px;">${point.emoji}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })
    }).addTo(state.map).bindPopup(point.label);
    state.routeMarkers.push(marker);
  });
}

function formatDuration(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (!hours) return `${minutes} mins`;
  if (!minutes) return `${hours} hr`;
  return `${hours} hr ${minutes} mins`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  });
  return response.json();
}
