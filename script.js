/**********************************************************************
 * MINECRAFT COORDINATE MAP
 * --------------------------------------------------------------------
 * X controls horizontal map position.
 * Z controls vertical map position.
 * Y is stored and displayed for reference only.
 *
 * Version 2:
 * Locations now come from the shared Supabase database instead of
 * localStorage, so everyone using the site sees the same map.
 **********************************************************************/

/**********************************************************************
 * 1) FIXED SETTINGS
 **********************************************************************/

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 700;
const MAP_PADDING = 80;

// When there is only one location (or locations are very close together),
// keep at least this many Minecraft blocks visible in each direction so the
// map does not zoom in absurdly far.
const MIN_VISIBLE_SPAN_BLOCKS = 400;

/**********************************************************************
 * 2) STATE
 **********************************************************************/

let locations = [];
let selectedLocationId = null;
let editingLocationId = null;
let searchText = "";
let databaseReady = false;

/**********************************************************************
 * 3) DOM REFERENCES
 **********************************************************************/

const locationForm = document.getElementById("locationForm");
const locationNameInput = document.getElementById("locationName");
const xCoordInput = document.getElementById("xCoord");
const yCoordInput = document.getElementById("yCoord");
const zCoordInput = document.getElementById("zCoord");
const locationNotesInput = document.getElementById("locationNotes");

const saveLocationBtn = document.getElementById("saveLocationBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const formModeText = document.getElementById("formModeText");
const formMessage = document.getElementById("formMessage");

const mapStatus = document.getElementById("mapStatus");
const gridLayer = document.getElementById("gridLayer");
const markerLayer = document.getElementById("markerLayer");
const emptyLayer = document.getElementById("emptyLayer");
const selectedLocationCard = document.getElementById("selectedLocationCard");

const locationSearch = document.getElementById("locationSearch");
const locationsList = document.getElementById("locationsList");
const locationCount = document.getElementById("locationCount");
const noSearchResults = document.getElementById("noSearchResults");

/**********************************************************************
 * 4) GENERAL HELPERS
 **********************************************************************/

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value) {
  return Number(value).toLocaleString();
}

function formatCoordinates(location) {
  const yDisplay =
    location.y === null ? "—" : formatNumber(location.y);

  return `X ${formatNumber(location.x)} · Y ${yDisplay} · Z ${formatNumber(location.z)}`;
}

function setFormMessage(message, isError = false) {
  formMessage.textContent = message;
  formMessage.classList.toggle("error", isError);
}

function getLocationById(id) {
  return locations.find((location) => location.id === id) || null;
}

function explainDatabaseError(error, action) {
  console.error(`Supabase error while trying to ${action}:`, error);

  if (error && error.message) {
    return `Could not ${action}. ${error.message}`;
  }

  return `Could not ${action}. Please refresh the page and try again.`;
}

/**********************************************************************
 * 5) LOAD THE SHARED MAP
 **********************************************************************/

async function loadSharedMap() {
  saveLocationBtn.disabled = true;
  mapStatus.textContent = "Loading shared locations...";
  locationCount.textContent = "Loading...";
  setFormMessage("Connecting to the shared Realm map...");

  try {
    if (!window.realmDatabase) {
      throw new Error("Database connection file did not load.");
    }

    locations = await window.realmDatabase.getLocations();
    databaseReady = true;

    // If a selected or edited location disappeared since our last refresh,
    // safely clear that state.
    if (selectedLocationId && !getLocationById(selectedLocationId)) {
      selectedLocationId = null;
    }

    if (editingLocationId && !getLocationById(editingLocationId)) {
      cancelEditing();
    }

    renderAll();
    setFormMessage("Shared map connected.");
  } catch (error) {
    databaseReady = false;
    locations = [];
    renderAll();
    mapStatus.textContent = "Could not load the shared map.";
    locationCount.textContent = "Connection error";
    setFormMessage(explainDatabaseError(error, "load the shared map"), true);
  } finally {
    saveLocationBtn.disabled = !databaseReady;
  }
}

/**********************************************************************
 * 6) FORM: ADD / EDIT LOCATIONS
 **********************************************************************/

locationForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!databaseReady) {
    setFormMessage("The shared database is not connected yet.", true);
    return;
  }

  const name = locationNameInput.value.trim();
  const x = Number(xCoordInput.value);

  const yText = yCoordInput.value.trim();
  const y = yText === "" ? null : Number(yText);

  const z = Number(zCoordInput.value);
  const notes = locationNotesInput.value.trim();

  if (!name) {
    setFormMessage("Give this location a name.", true);
    locationNameInput.focus();
    return;
  }

  if (!Number.isFinite(x) || !Number.isFinite(z)) {
  setFormMessage("X and Z must both be valid numbers.", true);
  return;
  }

  if (y !== null && !Number.isFinite(y)) {
    setFormMessage("Y must be a valid number or left blank.", true);
    return;
  }

  // Minecraft coordinates can be enormous, but this catches accidental
  // absurd entries while still leaving far more room than a normal map needs.
  const coordinateLimit = 30000000;
  if ([x, z].some((value) => Math.abs(value) > coordinateLimit)) {
    setFormMessage("X and Z must be between -30,000,000 and 30,000,000.", true);
    return;
  }

  saveLocationBtn.disabled = true;
  cancelEditBtn.disabled = true;

  try {
    if (editingLocationId) {
      const existing = getLocationById(editingLocationId);

      if (!existing) {
        cancelEditing();
        setFormMessage("That location no longer exists.", true);
        return;
      }

      const updatedLocation = await window.realmDatabase.updateLocation(
        editingLocationId,
        { name, x, y, z, notes }
      );

      const index = locations.findIndex(
        (location) => location.id === editingLocationId
      );

      if (index !== -1) {
        locations[index] = updatedLocation;
      }

      selectedLocationId = updatedLocation.id;
      cancelEditing(false);
      setFormMessage(`Updated ${name}.`);
    } else {
      const newLocation = await window.realmDatabase.addLocation({
        name,
        x,
        y,
        z,
        notes,
      });

      locations.push(newLocation);
      selectedLocationId = newLocation.id;

      locationForm.reset();
      setFormMessage(`Added ${name} to the shared map.`);
      locationNameInput.focus();
    }

    renderAll();
  } catch (error) {
    setFormMessage(
      explainDatabaseError(
        error,
        editingLocationId ? "update this location" : "add this location"
      ),
      true
    );
  } finally {
    saveLocationBtn.disabled = false;
    cancelEditBtn.disabled = false;
  }
});

cancelEditBtn.addEventListener("click", () => {
  cancelEditing();
  setFormMessage("Edit cancelled.");
});

function beginEditing(id) {
  const location = getLocationById(id);
  if (!location) return;

  editingLocationId = id;
  selectedLocationId = id;

  locationNameInput.value = location.name;
  xCoordInput.value = location.x;
  yCoordInput.value = location.y;
  zCoordInput.value = location.z;
  locationNotesInput.value = location.notes || "";

  saveLocationBtn.textContent = "Save changes";
  cancelEditBtn.classList.remove("hidden");
  formModeText.textContent = `Editing ${location.name}.`;
  setFormMessage("");

  renderAll();
  locationNameInput.focus();
  locationForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelEditing(clearForm = true) {
  editingLocationId = null;
  saveLocationBtn.textContent = "Add location";
  cancelEditBtn.classList.add("hidden");
  formModeText.textContent = "Enter a named place from your world.";

  if (clearForm) {
    locationForm.reset();
  }
}

async function deleteLocation(id) {
  const location = getLocationById(id);
  if (!location) return;

  const shouldDelete = window.confirm(`Delete “${location.name}” from the shared map?`);
  if (!shouldDelete) return;

  try {
    await window.realmDatabase.deleteLocation(id);

    locations = locations.filter((item) => item.id !== id);

    if (selectedLocationId === id) {
      selectedLocationId = null;
    }

    if (editingLocationId === id) {
      cancelEditing();
    }

    setFormMessage(`Deleted ${location.name} from the shared map.`);
    renderAll();
  } catch (error) {
    setFormMessage(explainDatabaseError(error, "delete this location"), true);
  }
}

/**********************************************************************
 * 7) SEARCH / LOCATION LIST
 **********************************************************************/

locationSearch.addEventListener("input", () => {
  searchText = locationSearch.value.trim().toLowerCase();
  renderLocationList();
});

function getFilteredLocations() {
  if (!searchText) return locations;

  return locations.filter((location) => {
    const searchable =
      `${location.name} ${location.notes || ""} ${location.x} ${location.y} ${location.z}`.toLowerCase();

    return searchable.includes(searchText);
  });
}

function renderLocationList() {
  locationsList.replaceChildren();

  const filteredLocations = getFilteredLocations();

  locationCount.textContent = `${locations.length} shared ${locations.length === 1 ? "location" : "locations"}`;

  noSearchResults.classList.toggle(
    "hidden",
    !(locations.length > 0 && filteredLocations.length === 0)
  );

  if (locations.length === 0) {
    const message = document.createElement("p");
    message.className = "empty-list-message";
    message.textContent = databaseReady
      ? "Nothing here yet. Add your first shared waypoint above."
      : "Waiting for the shared map to connect.";
    locationsList.appendChild(message);
    return;
  }

  const sorted = [...filteredLocations].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

  sorted.forEach((location) => {
    const row = document.createElement("article");
    row.className = "location-row";
    row.classList.toggle("selected", selectedLocationId === location.id);

    const mainButton = document.createElement("button");
    mainButton.type = "button";
    mainButton.className = "location-main-button";
    mainButton.setAttribute("aria-label", `Show ${location.name} on the map`);
    mainButton.innerHTML = `
      <span class="location-name">${escapeHtml(location.name)}</span>
      <span class="location-coords">${escapeHtml(formatCoordinates(location))}</span>
      ${location.notes ? `<span class="location-notes">${escapeHtml(location.notes)}</span>` : ""}
    `;
    mainButton.addEventListener("click", () => selectLocation(location.id));

    const actions = document.createElement("div");
    actions.className = "location-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "location-action";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => beginEditing(location.id));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "location-action delete";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteLocation(location.id));

    actions.append(editButton, deleteButton);
    row.append(mainButton, actions);
    locationsList.appendChild(row);
  });
}

/**********************************************************************
 * 8) MAP MATH
 **********************************************************************/

function getMapTransform() {
  if (locations.length === 0) {
    return {
      centerX: 0,
      centerZ: 0,
      scale: 1,
      blocksPerPixel: 1,
      visibleMinX: -500,
      visibleMaxX: 500,
      visibleMinZ: -350,
      visibleMaxZ: 350,
    };
  }

  const xs = locations.map((location) => Number(location.x));
  const zs = locations.map((location) => Number(location.z));

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);

  let spanX = Math.max(maxX - minX, MIN_VISIBLE_SPAN_BLOCKS);
  let spanZ = Math.max(maxZ - minZ, MIN_VISIBLE_SPAN_BLOCKS * 0.7);

  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;

  // Add breathing room around the outermost locations.
  spanX *= 1.22;
  spanZ *= 1.22;

  const usableWidth = MAP_WIDTH - MAP_PADDING * 2;
  const usableHeight = MAP_HEIGHT - MAP_PADDING * 2;

  // Use one scale for both axes. That means 100 blocks east takes exactly
  // the same screen distance as 100 blocks south.
  const scale = Math.min(usableWidth / spanX, usableHeight / spanZ);

  const visibleSpanX = MAP_WIDTH / scale;
  const visibleSpanZ = MAP_HEIGHT / scale;

  return {
    centerX,
    centerZ,
    scale,
    blocksPerPixel: 1 / scale,
    visibleMinX: centerX - visibleSpanX / 2,
    visibleMaxX: centerX + visibleSpanX / 2,
    visibleMinZ: centerZ - visibleSpanZ / 2,
    visibleMaxZ: centerZ + visibleSpanZ / 2,
  };
}

function mapXToScreen(x, transform) {
  return MAP_WIDTH / 2 + (x - transform.centerX) * transform.scale;
}

function mapZToScreen(z, transform) {
  return MAP_HEIGHT / 2 + (z - transform.centerZ) * transform.scale;
}

function chooseGridStep(visibleSpanBlocks) {
  // Aim for roughly 8–12 major grid intervals and choose human-friendly
  // Minecraft distances such as 50, 100, 500, 1000, etc.
  const target = visibleSpanBlocks / 9;
  const exponent = Math.floor(Math.log10(Math.max(target, 1)));
  const magnitude = 10 ** exponent;
  const normalized = target / magnitude;

  let nice;

  if (normalized <= 1) nice = 1;
  else if (normalized <= 2) nice = 2;
  else if (normalized <= 5) nice = 5;
  else nice = 10;

  return nice * magnitude;
}

/**********************************************************************
 * 9) MAP RENDERING
 **********************************************************************/

function renderMap() {
  gridLayer.replaceChildren();
  markerLayer.replaceChildren();

  const hasLocations = locations.length > 0;
  emptyLayer.classList.toggle("hidden", hasLocations);

  if (!hasLocations) {
    mapStatus.textContent = databaseReady
      ? "Add your first location to start the shared map."
      : "Loading shared locations...";
    selectedLocationCard.classList.add("hidden");
    return;
  }

  const transform = getMapTransform();
  const visibleSpanX = transform.visibleMaxX - transform.visibleMinX;
  const visibleSpanZ = transform.visibleMaxZ - transform.visibleMinZ;
  const majorStep = chooseGridStep(Math.max(visibleSpanX, visibleSpanZ));
  const minorStep = majorStep / 5;

  drawGrid(transform, minorStep, majorStep);
  drawMarkers(transform);

  const blocksPer100Pixels = Math.round(transform.blocksPerPixel * 100);

  mapStatus.textContent =
    `${locations.length} ${locations.length === 1 ? "location" : "locations"} · ` +
    `about ${formatNumber(blocksPer100Pixels)} blocks per 100 screen pixels`;

  renderSelectedLocation();
}

function drawGrid(transform, minorStep, majorStep) {
  const ns = "http://www.w3.org/2000/svg";

  const firstX =
    Math.floor(transform.visibleMinX / minorStep) * minorStep;
  const firstZ =
    Math.floor(transform.visibleMinZ / minorStep) * minorStep;

  const maxGridLines = 150;
  let lineCount = 0;

  for (
    let x = firstX;
    x <= transform.visibleMaxX && lineCount < maxGridLines;
    x += minorStep
  ) {
    lineCount += 1;

    const screenX = mapXToScreen(x, transform);
    if (screenX < 0 || screenX > MAP_WIDTH) continue;

    const isAxis = Math.abs(x) < minorStep / 1000;
    const isMajor = isMultipleOf(x, majorStep);

    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", screenX);
    line.setAttribute("x2", screenX);
    line.setAttribute("y1", 0);
    line.setAttribute("y2", MAP_HEIGHT);
    line.setAttribute(
      "class",
      isAxis
        ? "axis-line"
        : isMajor
          ? "grid-line-major"
          : "grid-line-minor"
    );
    gridLayer.appendChild(line);

    if (isMajor && screenX > 36 && screenX < MAP_WIDTH - 36) {
      const label = document.createElementNS(ns, "text");
      label.setAttribute("x", screenX + 5);
      label.setAttribute("y", 18);
      label.setAttribute("class", "grid-label");
      label.textContent = `X ${formatCompactNumber(x)}`;
      gridLayer.appendChild(label);
    }
  }

  lineCount = 0;

  for (
    let z = firstZ;
    z <= transform.visibleMaxZ && lineCount < maxGridLines;
    z += minorStep
  ) {
    lineCount += 1;

    const screenY = mapZToScreen(z, transform);
    if (screenY < 0 || screenY > MAP_HEIGHT) continue;

    const isAxis = Math.abs(z) < minorStep / 1000;
    const isMajor = isMultipleOf(z, majorStep);

    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", 0);
    line.setAttribute("x2", MAP_WIDTH);
    line.setAttribute("y1", screenY);
    line.setAttribute("y2", screenY);
    line.setAttribute(
      "class",
      isAxis
        ? "axis-line"
        : isMajor
          ? "grid-line-major"
          : "grid-line-minor"
    );
    gridLayer.appendChild(line);

    if (isMajor && screenY > 28 && screenY < MAP_HEIGHT - 20) {
      const label = document.createElementNS(ns, "text");
      label.setAttribute("x", 8);
      label.setAttribute("y", screenY - 5);
      label.setAttribute("class", "grid-label");
      label.textContent = `Z ${formatCompactNumber(z)}`;
      gridLayer.appendChild(label);
    }
  }
}

function isMultipleOf(value, step) {
  const ratio = value / step;
  return Math.abs(ratio - Math.round(ratio)) < 0.000001;
}

function formatCompactNumber(value) {
  const absolute = Math.abs(value);

  if (absolute >= 1000000) {
    return `${trimDecimal(value / 1000000)}m`;
  }

  if (absolute >= 1000) {
    return `${trimDecimal(value / 1000)}k`;
  }

  return formatNumber(Math.round(value));
}

function trimDecimal(value) {
  return Number(value.toFixed(1)).toString();
}

function drawMarkers(transform) {
  const ns = "http://www.w3.org/2000/svg";

  locations.forEach((location) => {
    const x = mapXToScreen(Number(location.x), transform);
    const y = mapZToScreen(Number(location.z), transform);

    const group = document.createElementNS(ns, "g");
    group.setAttribute("class", "marker-button");
    group.classList.toggle("selected", selectedLocationId === location.id);
    group.setAttribute("role", "button");
    group.setAttribute("tabindex", "0");
    group.setAttribute(
      "aria-label",
      `${location.name}, ${formatCoordinates(location)}`
    );

    const halo = document.createElementNS(ns, "circle");
    halo.setAttribute("cx", x);
    halo.setAttribute("cy", y);
    halo.setAttribute("r", 10);
    halo.setAttribute("class", "marker-halo");

    const dot = document.createElementNS(ns, "circle");
    dot.setAttribute("cx", x);
    dot.setAttribute("cy", y);
    dot.setAttribute("r", 8);
    dot.setAttribute("class", "marker-dot");

    const labelText =
      location.name.length > 30
        ? `${location.name.slice(0, 28)}…`
        : location.name;

    const estimatedWidth = Math.max(56, labelText.length * 7.5 + 18);
    const labelX = Math.min(
      Math.max(x + 14, 5),
      MAP_WIDTH - estimatedWidth - 5
    );
    const labelY = Math.min(
      Math.max(y - 27, 22),
      MAP_HEIGHT - 10
    );

    const labelBg = document.createElementNS(ns, "rect");
    labelBg.setAttribute("x", labelX);
    labelBg.setAttribute("y", labelY - 17);
    labelBg.setAttribute("width", estimatedWidth);
    labelBg.setAttribute("height", 24);
    labelBg.setAttribute("rx", 6);
    labelBg.setAttribute("class", "marker-label-bg");

    const label = document.createElementNS(ns, "text");
    label.setAttribute("x", labelX + 9);
    label.setAttribute("y", labelY);
    label.setAttribute("class", "marker-label");
    label.textContent = labelText;

    group.append(halo, dot, labelBg, label);

    group.addEventListener("click", () => {
      selectLocation(location.id);
    });

    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectLocation(location.id);
      }
    });

    markerLayer.appendChild(group);
  });
}

/**********************************************************************
 * 10) SELECTION
 **********************************************************************/

function selectLocation(id) {
  if (!getLocationById(id)) return;

  selectedLocationId = id;
  renderMap();
  renderLocationList();
}

function renderSelectedLocation() {
  const location = getLocationById(selectedLocationId);

  if (!location) {
    selectedLocationCard.classList.add("hidden");
    selectedLocationCard.replaceChildren();
    return;
  }

  selectedLocationCard.classList.remove("hidden");
  selectedLocationCard.innerHTML = `
    <div class="selected-card-main">
      <p class="selected-card-name">${escapeHtml(location.name)}</p>
      <p class="selected-card-coords">${escapeHtml(formatCoordinates(location))}</p>
      ${location.notes ? `<p class="selected-card-notes">${escapeHtml(location.notes)}</p>` : ""}
    </div>
    <button id="selectedEditBtn" class="location-action" type="button">Edit</button>
  `;

  document
    .getElementById("selectedEditBtn")
    .addEventListener("click", () => {
      beginEditing(location.id);
    });
}

/**********************************************************************
 * 11) FULL RENDER
 **********************************************************************/

function renderAll() {
  renderMap();
  renderLocationList();
}

/**********************************************************************
 * 12) START THE APP
 **********************************************************************/

renderAll();
loadSharedMap();
