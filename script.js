/**********************************************************************
 * MINECRAFT COORDINATE MAP
 * --------------------------------------------------------------------
 * X controls horizontal map position.
 * Z controls vertical map position.
 * Y is stored and displayed for reference only.
 *
 * Version 6.1:
 * Dimension-aware waypoints, vertical map layers, an "all overworld layers"
 * composite view, shared chunk biomes, optional Y, Minecraft 16×16 chunk
 * borders, zoom/pan/Fit Map controls, biome overlays, and chunk selection.
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

// Minecraft chunks are always 16 blocks wide on X and Z.
const CHUNK_SIZE = 16;

// If the map is so zoomed out that thousands of exact chunk lines would
// be required, we stop drawing the full grid to keep phones responsive.
// The selected location's chunk is still highlighted and described.
const MAX_CHUNK_LINES = 2200;

// Hide individual chunk borders when one 16-block chunk would be too tiny
// to read on the actual screen. Zooming in makes them appear automatically.
const MIN_CHUNK_SCREEN_PIXELS = 8;

// Map navigation settings.
const MAX_MAP_SCALE = 12;
const ZOOM_BUTTON_FACTOR = 1.4;
const WHEEL_ZOOM_SPEED = 0.0015;
const KEYBOARD_PAN_FRACTION = 0.12;
const PAN_CLICK_THRESHOLD_PX = 6;

// Special map-only view. This is NOT stored in Supabase as a location layer.
const ALL_MAP_LAYERS_ID = "__all__";

/**********************************************************************
 * 2) STATE
 **********************************************************************/

let locations = [];
let selectedLocationId = null;
let editingLocationId = null;
let searchText = "";
let databaseReady = false;

// Current world-map context.
let selectedDimensionId = "overworld";
let selectedMapLayerId = "surface";

// Shared biome assignments. One record = one Minecraft chunk.
let chunkBiomes = [];
let biomeDatabaseReady = false;
let biomeOverlayEnabled = false;
let selectedBiomeChunk = null;

// Used to prevent a completed drag from also being treated as a chunk click.
let suppressMapClickUntil = 0;

// Current map camera. These are Minecraft world coordinates plus a scale
// measured in SVG map units per Minecraft block.
let mapViewCenterX = 0;
let mapViewCenterZ = 0;
let mapViewScale = null;

// Mouse-drag panning state.
let panState = null;

// Wheel/drag events can fire very quickly, so map redraws are grouped into
// animation frames instead of rebuilding the SVG dozens of times at once.
let pendingMapRenderFrame = null;

/**********************************************************************
 * 3) DOM REFERENCES
 **********************************************************************/

const locationForm = document.getElementById("locationForm");
const locationNameInput = document.getElementById("locationName");
const xCoordInput = document.getElementById("xCoord");
const yCoordInput = document.getElementById("yCoord");
const zCoordInput = document.getElementById("zCoord");
const locationNotesInput = document.getElementById("locationNotes");
const locationDimensionSelect =
  document.getElementById("locationDimension");
const locationLayerSelect =
  document.getElementById("locationLayer");

const saveLocationBtn = document.getElementById("saveLocationBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const formModeText = document.getElementById("formModeText");
const formMessage = document.getElementById("formMessage");

const mapStatus = document.getElementById("mapStatus");
const dimensionSelect = document.getElementById("dimensionSelect");
const mapLayerSelect = document.getElementById("mapLayerSelect");
const worldContextDescription =
  document.getElementById("worldContextDescription");
const mapSvg = document.getElementById("mapSvg");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const zoomInBtn = document.getElementById("zoomInBtn");
const fitMapBtn = document.getElementById("fitMapBtn");
const biomeToggleBtn = document.getElementById("biomeToggleBtn");
const mapZoomLabel = document.getElementById("mapZoomLabel");
const mapFrame = document.querySelector(".map-frame");
const biomeTooltip = document.getElementById("biomeTooltip");

const biomeLayer = document.getElementById("biomeLayer");
const gridLayer = document.getElementById("gridLayer");
const chunkLayer = document.getElementById("chunkLayer");
const biomeSelectionLayer = document.getElementById("biomeSelectionLayer");
const markerLayer = document.getElementById("markerLayer");
const emptyLayer = document.getElementById("emptyLayer");
const selectedLocationCard = document.getElementById("selectedLocationCard");

const biomeEditorCard = document.getElementById("biomeEditorCard");
const biomeContextLabel = document.getElementById("biomeContextLabel");
const biomeChunkCoords = document.getElementById("biomeChunkCoords");
const biomeCurrentSwatch = document.getElementById("biomeCurrentSwatch");
const biomeCurrentBadge = document.getElementById("biomeCurrentBadge");
const biomeForm = document.getElementById("biomeForm");
const biomeSelect = document.getElementById("biomeSelect");
const biomeColorPreview = document.getElementById("biomeColorPreview");
const biomeNotes = document.getElementById("biomeNotes");
const saveBiomeBtn = document.getElementById("saveBiomeBtn");
const clearBiomeBtn = document.getElementById("clearBiomeBtn");
const biomeFormMessage = document.getElementById("biomeFormMessage");

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
  const yDisplay = location.y === null ? "—" : formatNumber(location.y);

  return `X ${formatNumber(location.x)} · Y ${yDisplay} · Z ${formatNumber(location.z)}`;
}

function setFormMessage(message, isError = false) {
  formMessage.textContent = message;
  formMessage.classList.toggle("error", isError);
}

function getLocationById(id) {
  return locations.find((location) => location.id === id) || null;
}

function isBiomeFeatureEnabled() {
  return getWorldConfig().biomeFeatureEnabled !== false;
}

function isAllLayersView() {
  return (
    selectedDimensionId === "overworld" &&
    selectedMapLayerId === ALL_MAP_LAYERS_ID
  );
}

function supportsAllLayersMapView(dimensionId) {
  const dimension = getDimensionDefinition(dimensionId);

  return (
    dimensionId === "overworld" &&
    Array.isArray(dimension?.layers) &&
    dimension.layers.length > 1
  );
}

function canUseBiomeFeatureInCurrentContext() {
  return isBiomeFeatureEnabled() && !isAllLayersView();
}

function getWorldConfig() {
  return window.WORLD_CONFIG || {
    defaultDimension: "overworld",
    dimensions: [
      {
        id: "overworld",
        label: "Overworld",
        enabled: true,
        defaultLayer: "surface",
        layers: [
          { id: "surface", label: "Surface" },
        ],
      },
    ],
  };
}

function getEnabledDimensions() {
  return getWorldConfig().dimensions.filter(
    (dimension) => dimension.enabled !== false
  );
}

function getDimensionDefinition(dimensionId) {
  return (
    getWorldConfig().dimensions.find(
      (dimension) => dimension.id === dimensionId
    ) || null
  );
}

function getLayerDefinition(dimensionId, layerId) {
  const dimension = getDimensionDefinition(dimensionId);

  return (
    dimension?.layers?.find(
      (layer) => layer.id === layerId
    ) || null
  );
}

function getDefaultLayerId(dimensionId) {
  const dimension = getDimensionDefinition(dimensionId);

  return (
    dimension?.defaultLayer ||
    dimension?.layers?.[0]?.id ||
    "surface"
  );
}

function getDimensionLabel(dimensionId) {
  return (
    getDimensionDefinition(dimensionId)?.label ||
    dimensionId
  );
}

function getLayerLabel(dimensionId, layerId) {
  if (
    dimensionId === "overworld" &&
    layerId === ALL_MAP_LAYERS_ID
  ) {
    return "all layers";
  }

  return (
    getLayerDefinition(dimensionId, layerId)?.label ||
    layerId
  );
}

function formatMapContext(
  dimensionId = selectedDimensionId,
  layerId = selectedMapLayerId
) {
  return (
    `${getDimensionLabel(dimensionId)} · ` +
    `${getLayerLabel(dimensionId, layerId)}`
  );
}

function getVisibleLocations() {
  return locations.filter((location) => {
    if (location.dimension !== selectedDimensionId) {
      return false;
    }

    // Composite Overworld view: show every Overworld waypoint, whether it
    // belongs to Surface, Underground, Bottom, or all layers.
    if (isAllLayersView()) {
      return true;
    }

    return (
      location.mapLayer === null ||
      location.mapLayer === selectedMapLayerId
    );
  });
}

function getCurrentChunkBiomes() {
  // A single X/Z chunk may have different biomes on Surface, Underground,
  // and Bottom, so a combined biome overlay would be misleading.
  if (isAllLayersView()) {
    return [];
  }

  return chunkBiomes.filter(
    (assignment) =>
      assignment.dimension === selectedDimensionId &&
      assignment.mapLayer === selectedMapLayerId
  );
}

function hasMapContent() {
  return (
    getVisibleLocations().length > 0 ||
    getCurrentChunkBiomes().length > 0
  );
}

function getBiomeOptions() {
  return Array.isArray(window.BIOME_OPTIONS)
    ? window.BIOME_OPTIONS
    : [];
}

function getBiomeOptionsForContext(
  dimensionId = selectedDimensionId,
  layerId = selectedMapLayerId
) {
  if (
    dimensionId === "overworld" &&
    layerId === ALL_MAP_LAYERS_ID
  ) {
    return [];
  }

  return getBiomeOptions().filter((biome) => {
    const dimensionsOkay =
      !Array.isArray(biome.dimensions) ||
      biome.dimensions.includes(dimensionId);

    const layersOkay =
      !Array.isArray(biome.layers) ||
      biome.layers.includes(layerId);

    return dimensionsOkay && layersOkay;
  });
}

function getBiomeDefinition(biomeId) {
  return (
    getBiomeOptions().find((biome) => biome.id === biomeId) || null
  );
}

function getBiomeColor(biomeId) {
  const definition = getBiomeDefinition(biomeId);
  return definition?.color || "#8a8f8b";
}

function getBiomeLabel(biomeId) {
  const definition = getBiomeDefinition(biomeId);
  return definition?.label || biomeId || "Unknown biome";
}

function getChunkKey(
  chunkX,
  chunkZ,
  dimensionId = selectedDimensionId,
  layerId = selectedMapLayerId
) {
  return `${dimensionId}|${layerId}|${chunkX},${chunkZ}`;
}

function getChunkBiome(
  chunkX,
  chunkZ,
  dimensionId = selectedDimensionId,
  layerId = selectedMapLayerId
) {
  return (
    chunkBiomes.find(
      (assignment) =>
        assignment.dimension === dimensionId &&
        assignment.mapLayer === layerId &&
        assignment.chunkX === chunkX &&
        assignment.chunkZ === chunkZ
    ) || null
  );
}

function formatLocationScope(location) {
  const dimensionLabel = getDimensionLabel(location.dimension);

  if (location.mapLayer === null) {
    return `${dimensionLabel} · all layers`;
  }

  return (
    `${dimensionLabel} · ` +
    getLayerLabel(location.dimension, location.mapLayer)
  );
}

function getChunkInfoFromChunkCoords(chunkX, chunkZ) {
  const minX = chunkX * CHUNK_SIZE;
  const maxX = minX + CHUNK_SIZE - 1;
  const minZ = chunkZ * CHUNK_SIZE;
  const maxZ = minZ + CHUNK_SIZE - 1;

  return {
    chunkX,
    chunkZ,
    minX,
    maxX,
    minZ,
    maxZ,
  };
}

function formatChunkInfoFromChunkCoords(chunkX, chunkZ) {
  const chunk = getChunkInfoFromChunkCoords(chunkX, chunkZ);

  return (
    `chunk coords ${formatNumber(chunk.chunkX)}, ${formatNumber(chunk.chunkZ)}\n` +
    `X: ${formatNumber(chunk.minX)} to ${formatNumber(chunk.maxX)}\n` +
    `Z: ${formatNumber(chunk.minZ)} to ${formatNumber(chunk.maxZ)}`
  );
}

function setBiomeFormMessage(message, isError = false) {
  biomeFormMessage.textContent = message;
  biomeFormMessage.classList.toggle("error", isError);
}

function getChunkInfo(x, z) {
  // Math.floor is important here because Minecraft chunks extend through
  // negative coordinates too. Example: X -1 belongs to chunk -1, not chunk 0.
  const chunkX = Math.floor(Number(x) / CHUNK_SIZE);
  const chunkZ = Math.floor(Number(z) / CHUNK_SIZE);

  const minX = chunkX * CHUNK_SIZE;
  const maxX = minX + CHUNK_SIZE - 1;
  const minZ = chunkZ * CHUNK_SIZE;
  const maxZ = minZ + CHUNK_SIZE - 1;

  return {
    chunkX,
    chunkZ,
    minX,
    maxX,
    minZ,
    maxZ,
  };
}

function formatChunkInfo(location) {
  const chunk = getChunkInfo(location.x, location.z);

  return formatChunkInfoFromChunkCoords(
    chunk.chunkX,
    chunk.chunkZ
  );
}

function explainDatabaseError(error, action) {
  console.error(`Supabase error while trying to ${action}:`, error);

  if (error && error.message) {
    return `Could not ${action}. ${error.message}`;
  }

  return `Could not ${action}. Please refresh the page and try again.`;
}

/**********************************************************************
 * 5) DIMENSION + MAP-LAYER CONTROLS
 **********************************************************************/

function populateDimensionSelect(selectElement) {
  const previousValue = selectElement.value;
  selectElement.replaceChildren();

  getEnabledDimensions().forEach((dimension) => {
    const option = document.createElement("option");
    option.value = dimension.id;
    option.textContent = dimension.label;
    selectElement.appendChild(option);
  });

  if (
    previousValue &&
    getEnabledDimensions().some(
      (dimension) => dimension.id === previousValue
    )
  ) {
    selectElement.value = previousValue;
  }
}

function populateMapLayerSelect(
  selectElement,
  dimensionId,
  {
    includeAllLayers = false,
    includeCombinedView = false,
    preferredValue = null,
  } = {}
) {
  const dimension = getDimensionDefinition(dimensionId);
  selectElement.replaceChildren();

  if (
    includeCombinedView &&
    supportsAllLayersMapView(dimensionId)
  ) {
    const combinedOption = document.createElement("option");
    combinedOption.value = ALL_MAP_LAYERS_ID;
    combinedOption.textContent = "all overworld layers";
    selectElement.appendChild(combinedOption);
  }

  if (includeAllLayers) {
    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = `All ${dimension?.label || dimensionId} layers`;
    selectElement.appendChild(allOption);
  }

  (dimension?.layers || []).forEach((layer) => {
    const option = document.createElement("option");
    option.value = layer.id;
    option.textContent = layer.label;
    selectElement.appendChild(option);
  });

  if (
    preferredValue !== null &&
    Array.from(selectElement.options).some(
      (option) => option.value === preferredValue
    )
  ) {
    selectElement.value = preferredValue;
  } else if (!includeAllLayers) {
    selectElement.value = getDefaultLayerId(dimensionId);
  }
}

function updateWorldContextDescription() {
  if (isAllLayersView()) {
    worldContextDescription.textContent =
      "surface, underground, and bottom locations shown together.";
    return;
  }

  const layer = getLayerDefinition(
    selectedDimensionId,
    selectedMapLayerId
  );

  worldContextDescription.textContent =
    layer?.description || formatMapContext();
}

function syncLocationFormContextToMap() {
  if (editingLocationId) return;

  locationDimensionSelect.value = selectedDimensionId;

  populateMapLayerSelect(
    locationLayerSelect,
    selectedDimensionId,
    {
      includeAllLayers: true,
      preferredValue: isAllLayersView()
        ? ""
        : selectedMapLayerId,
    }
  );
}

function setWorldContext(
  dimensionId,
  layerId = null,
  {
    refit = true,
    clearSelections = true,
  } = {}
) {
  const dimension =
    getDimensionDefinition(dimensionId) ||
    getEnabledDimensions()[0];

  if (!dimension) return;

  selectedDimensionId = dimension.id;

  mapSvg.classList.toggle(
  "nether-map",
  selectedDimensionId === "nether"
);

  const validLayer =
    (
      layerId === ALL_MAP_LAYERS_ID &&
      supportsAllLayersMapView(dimension.id)
    )
      ? ALL_MAP_LAYERS_ID
      : dimension.layers?.some(
          (layer) => layer.id === layerId
        )
        ? layerId
        : getDefaultLayerId(dimension.id);

  selectedMapLayerId = validLayer;

  dimensionSelect.value = selectedDimensionId;

  populateMapLayerSelect(
    mapLayerSelect,
    selectedDimensionId,
    {
      includeCombinedView: true,
      preferredValue: selectedMapLayerId,
    }
  );

  updateWorldContextDescription();

  if (clearSelections) {
    selectedLocationId = null;
    selectedBiomeChunk = null;
    hideBiomeTooltip();
    setBiomeFormMessage("");
  }

  if (!editingLocationId) {
    syncLocationFormContextToMap();
  }

  populateBiomeDropdown();
  updateBiomeFeatureAvailability();

  if (refit) {
    fitMapToLocations(false);
  }

  renderAll();
}

function updateBiomeFeatureAvailability() {
  const globallyEnabled = isBiomeFeatureEnabled();
  const contextAllowsBiomes =
    canUseBiomeFeatureInCurrentContext();

  biomeToggleBtn.classList.toggle(
    "hidden",
    !globallyEnabled
  );

  const usable =
    globallyEnabled &&
    contextAllowsBiomes &&
    biomeDatabaseReady &&
    getBiomeOptionsForContext().length > 0;

  biomeToggleBtn.disabled = !usable;

  if (isAllLayersView()) {
    biomeToggleBtn.title =
      "choose a specific overworld layer to view or assign biomes";
  } else {
    biomeToggleBtn.title =
      "show or hide assigned biome colors";
  }

  if (!contextAllowsBiomes && biomeOverlayEnabled) {
    biomeOverlayEnabled = false;
    selectedBiomeChunk = null;

    biomeToggleBtn.classList.remove("is-active");
    biomeToggleBtn.setAttribute("aria-pressed", "false");
    biomeToggleBtn.textContent = "Biomes off";

    hideBiomeTooltip();
    biomeEditorCard.classList.add("hidden");
  }
}

function initializeWorldControls() {
  populateDimensionSelect(dimensionSelect);
  populateDimensionSelect(locationDimensionSelect);

  if (!isBiomeFeatureEnabled()) {
    biomeToggleBtn.classList.add("hidden");
    biomeEditorCard.classList.add("hidden");
  }

  const configuredDefault = getWorldConfig().defaultDimension;
  const enabledIds = getEnabledDimensions().map(
    (dimension) => dimension.id
  );

  selectedDimensionId = enabledIds.includes(configuredDefault)
    ? configuredDefault
    : enabledIds[0] || "overworld";

  selectedMapLayerId =
    selectedDimensionId === "overworld"
      ? ALL_MAP_LAYERS_ID
      : getDefaultLayerId(selectedDimensionId);

  dimensionSelect.value = selectedDimensionId;

  populateMapLayerSelect(
    mapLayerSelect,
    selectedDimensionId,
    {
      includeCombinedView: true,
      preferredValue: selectedMapLayerId,
    }
  );

  locationDimensionSelect.value = selectedDimensionId;

  populateMapLayerSelect(
    locationLayerSelect,
    selectedDimensionId,
    {
      includeAllLayers: true,
      preferredValue: selectedMapLayerId,
    }
  );

  updateWorldContextDescription();
  updateBiomeFeatureAvailability();
}

dimensionSelect.addEventListener("change", () => {
  setWorldContext(
    dimensionSelect.value,
    getDefaultLayerId(dimensionSelect.value)
  );
});

mapLayerSelect.addEventListener("change", () => {
  setWorldContext(
    selectedDimensionId,
    mapLayerSelect.value
  );
});

locationDimensionSelect.addEventListener("change", () => {
  populateMapLayerSelect(
    locationLayerSelect,
    locationDimensionSelect.value,
    {
      includeAllLayers: true,
      preferredValue: "",
    }
  );
});

/**********************************************************************
 * 6) LOAD THE SHARED MAP
 **********************************************************************/

async function loadSharedMap() {
  saveLocationBtn.disabled = true;
  biomeToggleBtn.disabled = true;
  mapStatus.textContent = "Loading shared locations...";
  locationCount.textContent = "Loading...";
  setFormMessage("Connecting to the shared Realm map...");

  if (!window.realmDatabase) {
    databaseReady = false;
    biomeDatabaseReady = false;
    setFormMessage("Database connection file did not load.", true);
    return;
  }

  // Locations are the original map feature, so load them independently.
  try {
    locations = await window.realmDatabase.getLocations();
    databaseReady = true;
  } catch (error) {
    databaseReady = false;
    locations = [];
    console.error("Could not load shared locations:", error);
  }

  // Biomes are a separate table. If that table has not been created yet,
  // waypoint mapping still works; only the biome controls stay disabled.
  try {
    chunkBiomes = await window.realmDatabase.getChunkBiomes();
    biomeDatabaseReady = true;
  } catch (error) {
    biomeDatabaseReady = false;
    chunkBiomes = [];
    console.error("Could not load chunk biomes:", error);
  }

  fitMapToLocations(false);

  if (selectedLocationId && !getLocationById(selectedLocationId)) {
    selectedLocationId = null;
  }

  if (editingLocationId && !getLocationById(editingLocationId)) {
    cancelEditing();
  }

  populateBiomeDropdown();
  renderAll();

  if (databaseReady) {
    setFormMessage("Shared map connected.");
  } else {
    setFormMessage("Could not load the shared waypoint database.", true);
  }

  if (!biomeDatabaseReady) {
    setBiomeFormMessage(
      "Dimension/layer biome data is not connected yet. Run the V6 Supabase setup, then refresh.",
      true
    );
  }

  saveLocationBtn.disabled = !databaseReady;
  updateBiomeFeatureAvailability();
}

/**********************************************************************
 * 7) FORM: ADD / EDIT LOCATIONS
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
  const dimension = locationDimensionSelect.value;
  const mapLayer = locationLayerSelect.value || null;

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
        {
          name,
          x,
          y,
          z,
          notes,
          dimension,
          mapLayer,
        }
      );

      const index = locations.findIndex(
        (location) => location.id === editingLocationId
      );

      if (index !== -1) {
        locations[index] = updatedLocation;
      }

      const destinationLayer =
        (
          selectedDimensionId === updatedLocation.dimension &&
          isAllLayersView()
        )
          ? ALL_MAP_LAYERS_ID
          : updatedLocation.mapLayer ||
            getDefaultLayerId(updatedLocation.dimension);

      setWorldContext(
        updatedLocation.dimension,
        destinationLayer,
        {
          refit: false,
          clearSelections: false,
        }
      );

      selectedLocationId = updatedLocation.id;
      cancelEditing(false);
      fitMapToLocations(false);
      setFormMessage(`Updated ${name}.`);
    } else {
      const newLocation = await window.realmDatabase.addLocation({
        name,
        x,
        y,
        z,
        notes,
        dimension,
        mapLayer,
      });

      locations.push(newLocation);

      const destinationLayer =
        (
          selectedDimensionId === newLocation.dimension &&
          isAllLayersView()
        )
          ? ALL_MAP_LAYERS_ID
          : newLocation.mapLayer ||
            getDefaultLayerId(newLocation.dimension);

      setWorldContext(
        newLocation.dimension,
        destinationLayer,
        {
          refit: false,
          clearSelections: false,
        }
      );

      selectedLocationId = newLocation.id;

      // A new waypoint may be outside the current camera, so refit once.
      fitMapToLocations(false);

      locationForm.reset();
      syncLocationFormContextToMap();
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
  yCoordInput.value = location.y === null ? "" : location.y;
  zCoordInput.value = location.z;
  locationNotesInput.value = location.notes || "";

  locationDimensionSelect.value = location.dimension;

  populateMapLayerSelect(
    locationLayerSelect,
    location.dimension,
    {
      includeAllLayers: true,
      preferredValue: location.mapLayer || "",
    }
  );

  saveLocationBtn.textContent = "Save changes";
  cancelEditBtn.classList.remove("hidden");
  if (formModeText) {
    formModeText.textContent = `Editing ${location.name}.`;
  }
  setFormMessage("");

  renderAll();
  locationNameInput.focus();
  locationForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelEditing(clearForm = true) {
  editingLocationId = null;
  saveLocationBtn.textContent = "add location";
  cancelEditBtn.classList.add("hidden");
  if (formModeText) {
    formModeText.textContent = "Enter a named place from your world.";
  }

  if (clearForm) {
    locationForm.reset();
    syncLocationFormContextToMap();
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

    fitMapToLocations(false);

    setFormMessage(`Deleted ${location.name} from the shared map.`);
    renderAll();
  } catch (error) {
    setFormMessage(explainDatabaseError(error, "delete this location"), true);
  }
}

/**********************************************************************
 * 8) SEARCH / LOCATION LIST
 **********************************************************************/

locationSearch.addEventListener("input", () => {
  searchText = locationSearch.value.trim().toLowerCase();
  renderLocationList();
});

function getFilteredLocations() {
  const visibleLocations = getVisibleLocations();

  if (!searchText) return visibleLocations;

  return visibleLocations.filter((location) => {
    const searchable =
      `${location.name} ${location.notes || ""} ${location.x} ${location.y ?? ""} ${location.z} ${formatLocationScope(location)}`.toLowerCase();

    return searchable.includes(searchText);
  });
}

function renderLocationList() {
  locationsList.replaceChildren();

  const filteredLocations = getFilteredLocations();

  const visibleLocations = getVisibleLocations();

  locationCount.textContent =
    `${visibleLocations.length} visible ${visibleLocations.length === 1 ? "location" : "locations"} · ${formatMapContext()}`;

  noSearchResults.classList.toggle(
    "hidden",
    !(visibleLocations.length > 0 && filteredLocations.length === 0)
  );

  if (visibleLocations.length === 0) {
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
      <span class="location-scope">${escapeHtml(formatLocationScope(location))}</span>
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
 * 9) MAP MATH
 **********************************************************************/

function getFitTransform() {
  if (!hasMapContent()) {
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

  const visibleLocations = getVisibleLocations();
  const currentBiomes = getCurrentChunkBiomes();

  const xs = visibleLocations.map(
    (location) => Number(location.x)
  );
  const zs = visibleLocations.map(
    (location) => Number(location.z)
  );

  // Include both edges of every assigned biome chunk in THIS dimension/layer
  // so Fit Map never jumps across unrelated world maps.
  currentBiomes.forEach((assignment) => {
    const chunk = getChunkInfoFromChunkCoords(
      assignment.chunkX,
      assignment.chunkZ
    );

    xs.push(chunk.minX, chunk.minX + CHUNK_SIZE);
    zs.push(chunk.minZ, chunk.minZ + CHUNK_SIZE);
  });

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

function setMapView(centerX, centerZ, scale) {
  mapViewCenterX = centerX;
  mapViewCenterZ = centerZ;
  mapViewScale = scale;
}

function fitMapToLocations(renderNow = true) {
  const fit = getFitTransform();
  setMapView(fit.centerX, fit.centerZ, fit.scale);

  if (renderNow) {
    renderMap();
  }
}

function getMapTransform() {
  if (!Number.isFinite(mapViewScale) || mapViewScale <= 0) {
    const fit = getFitTransform();
    setMapView(fit.centerX, fit.centerZ, fit.scale);
  }

  const scale = mapViewScale;
  const visibleSpanX = MAP_WIDTH / scale;
  const visibleSpanZ = MAP_HEIGHT / scale;

  return {
    centerX: mapViewCenterX,
    centerZ: mapViewCenterZ,
    scale,
    blocksPerPixel: 1 / scale,
    visibleMinX: mapViewCenterX - visibleSpanX / 2,
    visibleMaxX: mapViewCenterX + visibleSpanX / 2,
    visibleMinZ: mapViewCenterZ - visibleSpanZ / 2,
    visibleMaxZ: mapViewCenterZ + visibleSpanZ / 2,
  };
}

function getMinimumMapScale() {
  return getFitTransform().scale;
}

function getMaximumMapScale() {
  return Math.max(MAX_MAP_SCALE, getMinimumMapScale());
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function clientPointToMap(clientX, clientY) {
  const rect = mapSvg.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0) {
    return { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
  }

  return {
    x: ((clientX - rect.left) / rect.width) * MAP_WIDTH,
    y: ((clientY - rect.top) / rect.height) * MAP_HEIGHT,
  };
}

function zoomMapAt(mapX, mapY, factor) {
  if (!hasMapContent() || !Number.isFinite(factor) || factor <= 0) {
    return;
  }

  const current = getMapTransform();
  const minimumScale = getMinimumMapScale();
  const maximumScale = getMaximumMapScale();

  const newScale = clamp(
    current.scale * factor,
    minimumScale,
    maximumScale
  );

  // The farthest zoom-out state is always the real fit-all-locations view.
  // That prevents a user from being fully zoomed out but still panned away
  // from the waypoints.
  if (newScale <= minimumScale * 1.00001) {
    const fit = getFitTransform();
    setMapView(fit.centerX, fit.centerZ, fit.scale);
    scheduleMapRender();
    return;
  }

  if (Math.abs(newScale - current.scale) < 0.0000001) {
    updateMapControls();
    return;
  }

  // Convert the cursor's current screen position to the Minecraft X/Z point
  // beneath it. After changing scale, shift the center so the same world
  // point stays under the cursor.
  const worldX =
    current.centerX + (mapX - MAP_WIDTH / 2) / current.scale;
  const worldZ =
    current.centerZ + (mapY - MAP_HEIGHT / 2) / current.scale;

  mapViewCenterX =
    worldX - (mapX - MAP_WIDTH / 2) / newScale;
  mapViewCenterZ =
    worldZ - (mapY - MAP_HEIGHT / 2) / newScale;
  mapViewScale = newScale;

  scheduleMapRender();
}

function panMapByWorld(deltaX, deltaZ) {
  if (!hasMapContent()) return;

  mapViewCenterX += deltaX;
  mapViewCenterZ += deltaZ;
  scheduleMapRender();
}

function panMapByKeyboard(directionX, directionZ) {
  const transform = getMapTransform();
  const visibleSpanX = transform.visibleMaxX - transform.visibleMinX;
  const visibleSpanZ = transform.visibleMaxZ - transform.visibleMinZ;

  panMapByWorld(
    directionX * visibleSpanX * KEYBOARD_PAN_FRACTION,
    directionZ * visibleSpanZ * KEYBOARD_PAN_FRACTION
  );
}

function scheduleMapRender() {
  if (pendingMapRenderFrame !== null) {
    return;
  }

  pendingMapRenderFrame = window.requestAnimationFrame(() => {
    pendingMapRenderFrame = null;
    renderMap();
  });
}

function updateMapControls() {
  const hasContent = hasMapContent();

  zoomOutBtn.disabled = !hasContent;
  zoomInBtn.disabled = !hasContent;
  fitMapBtn.disabled = !hasContent;

  if (!hasContent) {
    mapZoomLabel.textContent = "Fit";
    return;
  }

  const current = getMapTransform();
  const minimumScale = getMinimumMapScale();
  const maximumScale = getMaximumMapScale();

  const zoomPercent = (current.scale / minimumScale) * 100;

  zoomOutBtn.disabled =
    current.scale <= minimumScale * 1.00001;

  zoomInBtn.disabled =
    current.scale >= maximumScale * 0.99999;

  mapZoomLabel.textContent =
    zoomPercent <= 100.5
      ? "Fit"
      : `${formatNumber(Math.round(zoomPercent))}%`;
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

function chooseChunkAlignedMajorStep(visibleSpanBlocks) {
  // When chunk borders are visible, all heavier reference lines should also
  // land on chunk borders. Start with 4 chunks = 64 blocks, then double:
  // 64, 128, 256, 512, 1024...
  //
  // Aim for roughly 8–12 major reference lines across the current view.
  const target = Math.max(visibleSpanBlocks / 9, CHUNK_SIZE * 4);

  let step = CHUNK_SIZE * 4;

  while (step < target) {
    step *= 2;
  }

  return step;
}

/**********************************************************************
 * 10) MAP RENDERING
 **********************************************************************/

function renderMap() {
  biomeLayer.replaceChildren();
  gridLayer.replaceChildren();
  chunkLayer.replaceChildren();
  biomeSelectionLayer.replaceChildren();
  markerLayer.replaceChildren();

  const hasContent = hasMapContent();
  const visibleLocations = getVisibleLocations();
  const currentBiomes = getCurrentChunkBiomes();

  emptyLayer.classList.toggle("hidden", hasContent);

  if (!hasContent) {
    mapStatus.textContent = databaseReady
      ? `No mapped data yet for ${formatMapContext()}.`
      : "Loading shared locations...";
    selectedLocationCard.classList.add("hidden");
    updateMapControls();
    return;
  }

  const transform = getMapTransform();
  const visibleSpanX = transform.visibleMaxX - transform.visibleMinX;
  const visibleSpanZ = transform.visibleMaxZ - transform.visibleMinZ;
  const largestVisibleSpan = Math.max(visibleSpanX, visibleSpanZ);

  drawBiomeOverlay(transform);

  const chunkGridState = drawChunkGrid(transform);

  if (chunkGridState === "shown") {
    // Chunk borders are now the fine grid. Draw only heavier coordinate
    // references that are ALSO exact chunk boundaries. This prevents lines
    // like X 100 from sitting a few blocks beside X 96, which created the
    // doubled/plaid appearance.
    const chunkAlignedMajorStep =
      chooseChunkAlignedMajorStep(largestVisibleSpan);

    drawGrid(
      transform,
      chunkAlignedMajorStep,
      chunkAlignedMajorStep,
      false
    );
  } else {
    // When chunks are too small to display, return to the ordinary adaptive
    // coordinate grid.
    const majorStep = chooseGridStep(largestVisibleSpan);
    const minorStep = majorStep / 5;

    drawGrid(
      transform,
      minorStep,
      majorStep,
      true
    );
  }

  drawSelectedChunk(transform);
  drawSelectedBiomeChunk(transform);
  drawMarkers(transform);

  const blocksPer100Pixels = Math.round(transform.blocksPerPixel * 100);

  const chunkStatus =
    chunkGridState === "shown"
      ? "16×16 chunk borders shown"
      : "zoom in to show chunk borders";

  const biomeStatus =
    biomeOverlayEnabled
      ? ` · ${currentBiomes.length} assigned ${currentBiomes.length === 1 ? "biome chunk" : "biome chunks"}`
      : "";

  mapStatus.textContent =
    `${formatMapContext()} · ${visibleLocations.length} ${visibleLocations.length === 1 ? "location" : "locations"} · ` +
    `about ${formatNumber(blocksPer100Pixels)} blocks per 100 screen pixels · ` +
    chunkStatus +
    biomeStatus;

  updateMapControls();
  renderSelectedLocation();
}



function drawBiomeOverlay(transform) {
  if (!biomeOverlayEnabled) return;

  const ns = "http://www.w3.org/2000/svg";

  getCurrentChunkBiomes().forEach((assignment) => {
    const chunk = getChunkInfoFromChunkCoords(
      assignment.chunkX,
      assignment.chunkZ
    );

    const left = mapXToScreen(chunk.minX, transform);
    const right = mapXToScreen(chunk.minX + CHUNK_SIZE, transform);
    const top = mapZToScreen(chunk.minZ, transform);
    const bottom = mapZToScreen(chunk.minZ + CHUNK_SIZE, transform);

    if (
      Math.max(left, right) < 0 ||
      Math.min(left, right) > MAP_WIDTH ||
      Math.max(top, bottom) < 0 ||
      Math.min(top, bottom) > MAP_HEIGHT
    ) {
      return;
    }

    const rect = document.createElementNS(ns, "rect");
    rect.setAttribute("x", Math.min(left, right));
    rect.setAttribute("y", Math.min(top, bottom));
    rect.setAttribute("width", Math.abs(right - left));
    rect.setAttribute("height", Math.abs(bottom - top));
    rect.setAttribute("class", "biome-chunk-fill");
    rect.setAttribute("fill", getBiomeColor(assignment.biomeId));

    biomeLayer.appendChild(rect);
  });
}

function drawSelectedBiomeChunk(transform) {
  if (!biomeOverlayEnabled || !selectedBiomeChunk) return;

  const ns = "http://www.w3.org/2000/svg";
  const chunk = getChunkInfoFromChunkCoords(
    selectedBiomeChunk.chunkX,
    selectedBiomeChunk.chunkZ
  );

  const left = mapXToScreen(chunk.minX, transform);
  const right = mapXToScreen(chunk.minX + CHUNK_SIZE, transform);
  const top = mapZToScreen(chunk.minZ, transform);
  const bottom = mapZToScreen(chunk.minZ + CHUNK_SIZE, transform);

  const rect = document.createElementNS(ns, "rect");
  rect.setAttribute("x", Math.min(left, right));
  rect.setAttribute("y", Math.min(top, bottom));
  rect.setAttribute("width", Math.abs(right - left));
  rect.setAttribute("height", Math.abs(bottom - top));
  rect.setAttribute("class", "biome-selected-chunk");

  biomeSelectionLayer.appendChild(rect);
}

function drawChunkGrid(transform) {
  const ns = "http://www.w3.org/2000/svg";

  const firstChunkX = Math.floor(transform.visibleMinX / CHUNK_SIZE);
  const lastChunkX = Math.ceil(transform.visibleMaxX / CHUNK_SIZE);
  const firstChunkZ = Math.floor(transform.visibleMinZ / CHUNK_SIZE);
  const lastChunkZ = Math.ceil(transform.visibleMaxZ / CHUNK_SIZE);

  const verticalLineCount = lastChunkX - firstChunkX + 1;
  const horizontalLineCount = lastChunkZ - firstChunkZ + 1;
  const totalLineCount = verticalLineCount + horizontalLineCount;

  const rect = mapSvg.getBoundingClientRect();
  const cssPixelsPerMapUnit =
    rect.width > 0 ? rect.width / MAP_WIDTH : 1;
  const chunkSizeOnScreen =
    CHUNK_SIZE * transform.scale * cssPixelsPerMapUnit;

  // A 16-block grid becomes visual noise when each chunk would only be a
  // handful of pixels wide. Hide it while zoomed out and bring it back
  // automatically as the user zooms in.
  if (
    chunkSizeOnScreen < MIN_CHUNK_SCREEN_PIXELS ||
    totalLineCount > MAX_CHUNK_LINES
  ) {
    return "hidden";
  }

  for (let chunkX = firstChunkX; chunkX <= lastChunkX; chunkX += 1) {
    const worldX = chunkX * CHUNK_SIZE;
    const screenX = mapXToScreen(worldX, transform);

    if (screenX < 0 || screenX > MAP_WIDTH) continue;

    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", screenX);
    line.setAttribute("x2", screenX);
    line.setAttribute("y1", 0);
    line.setAttribute("y2", MAP_HEIGHT);
    line.setAttribute(
      "class",
      worldX === 0 ? "chunk-grid-line origin-border" : "chunk-grid-line"
    );

    chunkLayer.appendChild(line);
  }

  for (let chunkZ = firstChunkZ; chunkZ <= lastChunkZ; chunkZ += 1) {
    const worldZ = chunkZ * CHUNK_SIZE;
    const screenY = mapZToScreen(worldZ, transform);

    if (screenY < 0 || screenY > MAP_HEIGHT) continue;

    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", 0);
    line.setAttribute("x2", MAP_WIDTH);
    line.setAttribute("y1", screenY);
    line.setAttribute("y2", screenY);
    line.setAttribute(
      "class",
      worldZ === 0 ? "chunk-grid-line origin-border" : "chunk-grid-line"
    );

    chunkLayer.appendChild(line);
  }

  return "shown";
}

function drawSelectedChunk(transform) {
  const location = getLocationById(selectedLocationId);
  if (!location) return;

  const ns = "http://www.w3.org/2000/svg";
  const chunk = getChunkInfo(location.x, location.z);

  // Chunk block coordinates run from min through max inclusive.
  // The visual box extends to the next chunk border, which is min + 16.
  const left = mapXToScreen(chunk.minX, transform);
  const right = mapXToScreen(chunk.minX + CHUNK_SIZE, transform);
  const top = mapZToScreen(chunk.minZ, transform);
  const bottom = mapZToScreen(chunk.minZ + CHUNK_SIZE, transform);

  const rect = document.createElementNS(ns, "rect");
  rect.setAttribute("x", Math.min(left, right));
  rect.setAttribute("y", Math.min(top, bottom));
  rect.setAttribute("width", Math.abs(right - left));
  rect.setAttribute("height", Math.abs(bottom - top));
  rect.setAttribute("class", "selected-chunk");

  chunkLayer.appendChild(rect);
}

function drawGrid(transform, minorStep, majorStep, showMinorLines = true) {
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

    // If chunks are supplying the fine grid, suppress the ordinary minor
    // coordinate lines. Axis and major reference lines still remain.
    if (showMinorLines || isMajor || isAxis) {
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
    }

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

    if (showMinorLines || isMajor || isAxis) {
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
    }

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

  getVisibleLocations().forEach((location) => {
    const x = mapXToScreen(Number(location.x), transform);
    const y = mapZToScreen(Number(location.z), transform);

    // Do not pin labels to an edge when a waypoint is actually outside the
    // camera. It will reappear naturally when the map is panned back.
    if (
      x < -80 ||
      x > MAP_WIDTH + 80 ||
      y < -60 ||
      y > MAP_HEIGHT + 60
    ) {
      return;
    }

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
      Math.max(x + 8, 5),
      MAP_WIDTH - estimatedWidth - 5
    );
    const labelY = Math.min(
      Math.max(y - 18, 22),
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
 * 11) SELECTION
 **********************************************************************/

function selectLocation(id) {
  const location = getLocationById(id);
  if (!location) return;

  selectedLocationId = id;

  // If this came from an all-layer location, keep the current layer.
  // Otherwise make sure the map is showing the location's own layer.
  if (
    location.dimension !== selectedDimensionId ||
    (
      !isAllLayersView() &&
      location.mapLayer !== null &&
      location.mapLayer !== selectedMapLayerId
    )
  ) {
    setWorldContext(
      location.dimension,
      location.mapLayer ||
        getDefaultLayerId(location.dimension),
      {
        refit: false,
        clearSelections: false,
      }
    );
  }

  if (biomeOverlayEnabled) {
    const chunk = getChunkInfo(location.x, location.z);
    selectedBiomeChunk = {
      chunkX: chunk.chunkX,
      chunkZ: chunk.chunkZ,
    };
  }

  renderMap();
  renderLocationList();
  renderBiomeEditor();
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
      <p class="location-scope">${escapeHtml(formatLocationScope(location))}</p>
      <p class="selected-card-coords">${escapeHtml(formatCoordinates(location))}</p>
      <p class="chunk-info">${escapeHtml(formatChunkInfo(location))}</p>
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
 * 12) BIOME LAYER / CHUNK ASSIGNMENT
 **********************************************************************/

function populateBiomeDropdown() {
  biomeSelect.innerHTML = '<option value="">Choose biome...</option>';

  getBiomeOptionsForContext().forEach((biome) => {
    const option = document.createElement("option");
    option.value = biome.id;
    option.textContent = biome.label;
    biomeSelect.appendChild(option);
  });

  updateBiomeColorPreview();
}

function updateBiomeColorPreview() {
  const biomeId = biomeSelect.value;
  const definition = getBiomeDefinition(biomeId);

  biomeColorPreview.style.background =
    definition?.color || "transparent";
}

function setBiomeOverlayEnabled(enabled) {
  if (!canUseBiomeFeatureInCurrentContext()) {
    biomeOverlayEnabled = false;
    return;
  }

  biomeOverlayEnabled = Boolean(enabled);

  biomeToggleBtn.classList.toggle(
    "is-active",
    biomeOverlayEnabled
  );
  biomeToggleBtn.setAttribute(
    "aria-pressed",
    String(biomeOverlayEnabled)
  );
  biomeToggleBtn.textContent =
    biomeOverlayEnabled ? "Biomes on" : "Biomes off";

  if (biomeOverlayEnabled) {
    if (!selectedBiomeChunk && selectedLocationId) {
      const location = getLocationById(selectedLocationId);

      if (location) {
        const chunk = getChunkInfo(location.x, location.z);
        selectedBiomeChunk = {
          chunkX: chunk.chunkX,
          chunkZ: chunk.chunkZ,
        };
      }
    }
  } else {
    hideBiomeTooltip();
  }

  renderMap();
  renderBiomeEditor();
}

function selectBiomeChunk(chunkX, chunkZ) {
  if (!biomeOverlayEnabled || !biomeDatabaseReady) return;

  selectedBiomeChunk = {
    chunkX,
    chunkZ,
  };

  setBiomeFormMessage("");
  renderMap();
  renderBiomeEditor();
}

function renderBiomeEditor() {
  if (
    !biomeOverlayEnabled ||
    !biomeDatabaseReady ||
    !selectedBiomeChunk
  ) {
    biomeEditorCard.classList.add("hidden");
    return;
  }

  biomeEditorCard.classList.remove("hidden");

  const { chunkX, chunkZ } = selectedBiomeChunk;
  const assignment = getChunkBiome(chunkX, chunkZ);

  biomeContextLabel.textContent =
    `${formatMapContext()} · selected chunk`;

  biomeChunkCoords.textContent =
    formatChunkInfoFromChunkCoords(chunkX, chunkZ);

  if (assignment) {
    const assignmentOptionExists =
      Array.from(biomeSelect.options).some(
        (option) => option.value === assignment.biomeId
      );

    if (!assignmentOptionExists) {
      const savedOption = document.createElement("option");
      savedOption.value = assignment.biomeId;
      savedOption.textContent =
        `${getBiomeLabel(assignment.biomeId)} (saved)`;
      biomeSelect.appendChild(savedOption);
    }

    biomeSelect.value = assignment.biomeId;
    biomeNotes.value = assignment.notes || "";

    biomeCurrentBadge.textContent =
      getBiomeLabel(assignment.biomeId);
    biomeCurrentSwatch.style.background =
      getBiomeColor(assignment.biomeId);

    clearBiomeBtn.classList.remove("hidden");
  } else {
    biomeSelect.value = "";
    biomeNotes.value = "";

    biomeCurrentBadge.textContent = "unassigned";
    biomeCurrentSwatch.style.background = "transparent";

    clearBiomeBtn.classList.add("hidden");
  }

  updateBiomeColorPreview();
}

biomeToggleBtn.addEventListener("click", () => {
  if (!biomeDatabaseReady) {
    setBiomeFormMessage(
      "The chunk_biomes table is not connected yet.",
      true
    );
    return;
  }

  setBiomeOverlayEnabled(!biomeOverlayEnabled);
});

biomeSelect.addEventListener("change", updateBiomeColorPreview);

biomeForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!selectedBiomeChunk || !biomeDatabaseReady) return;

  const biomeId = biomeSelect.value;
  const notes = biomeNotes.value.trim();

  if (!biomeId) {
    setBiomeFormMessage("Choose a biome first.", true);
    biomeSelect.focus();
    return;
  }

  saveBiomeBtn.disabled = true;
  clearBiomeBtn.disabled = true;

  try {
    const saved = await window.realmDatabase.saveChunkBiome({
      dimension: selectedDimensionId,
      mapLayer: selectedMapLayerId,
      chunkX: selectedBiomeChunk.chunkX,
      chunkZ: selectedBiomeChunk.chunkZ,
      biomeId,
      notes,
    });

    const existingIndex = chunkBiomes.findIndex(
      (assignment) =>
        assignment.dimension === saved.dimension &&
        assignment.mapLayer === saved.mapLayer &&
        assignment.chunkX === saved.chunkX &&
        assignment.chunkZ === saved.chunkZ
    );

    if (existingIndex === -1) {
      chunkBiomes.push(saved);
    } else {
      chunkBiomes[existingIndex] = saved;
    }

    setBiomeFormMessage(
      `Saved ${getBiomeLabel(saved.biomeId)} for ${formatMapContext(saved.dimension, saved.mapLayer)}, chunk ${formatNumber(saved.chunkX)}, ${formatNumber(saved.chunkZ)}.`
    );

    renderMap();
    renderBiomeEditor();
  } catch (error) {
    setBiomeFormMessage(
      explainDatabaseError(error, "save this biome"),
      true
    );
  } finally {
    saveBiomeBtn.disabled = false;
    clearBiomeBtn.disabled = false;
  }
});

clearBiomeBtn.addEventListener("click", async () => {
  if (!selectedBiomeChunk || !biomeDatabaseReady) return;

  const { chunkX, chunkZ } = selectedBiomeChunk;
  const assignment = getChunkBiome(chunkX, chunkZ);

  if (!assignment) return;

  const shouldClear = window.confirm(
    `Clear the biome assignment for chunk ${chunkX}, ${chunkZ}?`
  );

  if (!shouldClear) return;

  saveBiomeBtn.disabled = true;
  clearBiomeBtn.disabled = true;

  try {
    await window.realmDatabase.deleteChunkBiome(
      selectedDimensionId,
      selectedMapLayerId,
      chunkX,
      chunkZ
    );

    chunkBiomes = chunkBiomes.filter(
      (item) =>
        !(
          item.dimension === selectedDimensionId &&
          item.mapLayer === selectedMapLayerId &&
          item.chunkX === chunkX &&
          item.chunkZ === chunkZ
        )
    );

    setBiomeFormMessage("Biome assignment cleared.");
    renderMap();
    renderBiomeEditor();
  } catch (error) {
    setBiomeFormMessage(
      explainDatabaseError(error, "clear this biome"),
      true
    );
  } finally {
    saveBiomeBtn.disabled = false;
    clearBiomeBtn.disabled = false;
  }
});

function getWorldPointFromClient(clientX, clientY) {
  const point = clientPointToMap(clientX, clientY);
  const transform = getMapTransform();

  return {
    x:
      transform.centerX +
      (point.x - MAP_WIDTH / 2) / transform.scale,
    z:
      transform.centerZ +
      (point.y - MAP_HEIGHT / 2) / transform.scale,
  };
}

function getChunkAtClientPoint(clientX, clientY) {
  const world = getWorldPointFromClient(clientX, clientY);

  return {
    chunkX: Math.floor(world.x / CHUNK_SIZE),
    chunkZ: Math.floor(world.z / CHUNK_SIZE),
  };
}

function showBiomeTooltip(event) {
  if (
    !biomeOverlayEnabled ||
    event.pointerType !== "mouse" ||
    panState
  ) {
    hideBiomeTooltip();
    return;
  }

  const chunk = getChunkAtClientPoint(
    event.clientX,
    event.clientY
  );

  const assignment = getChunkBiome(
    chunk.chunkX,
    chunk.chunkZ
  );

  if (!assignment) {
    hideBiomeTooltip();
    return;
  }

  const name = getBiomeLabel(assignment.biomeId);
  const notes = assignment.notes
    ? `<span class="biome-tooltip-meta">${escapeHtml(assignment.notes)}</span>`
    : "";

  biomeTooltip.innerHTML = `
    <span class="biome-tooltip-name">${escapeHtml(name)}</span>
    <span class="biome-tooltip-meta">${escapeHtml(formatMapContext())}</span>
    <span class="biome-tooltip-meta">chunk ${formatNumber(chunk.chunkX)}, ${formatNumber(chunk.chunkZ)}</span>
    ${notes}
  `;

  biomeTooltip.classList.remove("hidden");

  const frameRect = mapFrame.getBoundingClientRect();

  let left = event.clientX - frameRect.left + 12;
  let top = event.clientY - frameRect.top + 12;

  // Measure after showing, then keep the tooltip inside the map frame.
  const tooltipWidth = biomeTooltip.offsetWidth;
  const tooltipHeight = biomeTooltip.offsetHeight;

  left = clamp(
    left,
    8,
    Math.max(8, frameRect.width - tooltipWidth - 8)
  );

  top = clamp(
    top,
    8,
    Math.max(8, frameRect.height - tooltipHeight - 8)
  );

  biomeTooltip.style.left = `${left}px`;
  biomeTooltip.style.top = `${top}px`;
}

function hideBiomeTooltip() {
  biomeTooltip.classList.add("hidden");
}

/**********************************************************************
 * 13) MAP NAVIGATION
 **********************************************************************/

zoomInBtn.addEventListener("click", () => {
  zoomMapAt(
    MAP_WIDTH / 2,
    MAP_HEIGHT / 2,
    ZOOM_BUTTON_FACTOR
  );
});

zoomOutBtn.addEventListener("click", () => {
  zoomMapAt(
    MAP_WIDTH / 2,
    MAP_HEIGHT / 2,
    1 / ZOOM_BUTTON_FACTOR
  );
});

fitMapBtn.addEventListener("click", () => {
  fitMapToLocations();
  mapSvg.focus({ preventScroll: true });
});

mapSvg.addEventListener(
  "wheel",
  (event) => {
    if (!hasMapContent()) return;

    event.preventDefault();

    const point = clientPointToMap(
      event.clientX,
      event.clientY
    );

    // Exponential zoom feels smooth on both ordinary mouse wheels and
    // high-resolution trackpads. Clamp a single event so one wild wheel
    // delta cannot teleport the camera.
    const rawFactor = Math.exp(
      -event.deltaY * WHEEL_ZOOM_SPEED
    );
    const factor = clamp(rawFactor, 0.72, 1.38);

    zoomMapAt(point.x, point.y, factor);
  },
  { passive: false }
);

// Mouse drag pans the camera. We intentionally leave touch gestures alone;
// phone/tablet users can always use the visible zoom and Fit Map buttons.
mapSvg.addEventListener("pointerdown", (event) => {
  if (
    event.pointerType !== "mouse" ||
    event.button !== 0 ||
    !hasMapContent()
  ) {
    return;
  }

  // Clicking a marker should select it, not start a pan.
  if (
    event.target.closest &&
    event.target.closest(".marker-button")
  ) {
    return;
  }

  const transform = getMapTransform();
  const rect = mapSvg.getBoundingClientRect();

  panState = {
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startCenterX: transform.centerX,
    startCenterZ: transform.centerZ,
    scale: transform.scale,
    rectWidth: Math.max(rect.width, 1),
    rectHeight: Math.max(rect.height, 1),
    moved: false,
  };

  mapSvg.setPointerCapture(event.pointerId);
  mapSvg.classList.add("is-panning");
  event.preventDefault();
});

mapSvg.addEventListener("pointermove", (event) => {
  if (
    !panState ||
    event.pointerId !== panState.pointerId
  ) {
    return;
  }

  const clientDeltaX =
    event.clientX - panState.startClientX;
  const clientDeltaY =
    event.clientY - panState.startClientY;

  if (
    Math.hypot(clientDeltaX, clientDeltaY) >=
    PAN_CLICK_THRESHOLD_PX
  ) {
    panState.moved = true;
    hideBiomeTooltip();
  }

  const deltaMapX =
    (clientDeltaX /
      panState.rectWidth) *
    MAP_WIDTH;

  const deltaMapY =
    (clientDeltaY /
      panState.rectHeight) *
    MAP_HEIGHT;

  // Dragging the picture right means the camera moves west, and dragging
  // it down means the camera moves north.
  mapViewCenterX =
    panState.startCenterX - deltaMapX / panState.scale;
  mapViewCenterZ =
    panState.startCenterZ - deltaMapY / panState.scale;

  scheduleMapRender();
});

function finishMapPan(event) {
  if (
    !panState ||
    event.pointerId !== panState.pointerId
  ) {
    return;
  }

  const wasMoved = panState.moved;

  if (mapSvg.hasPointerCapture(event.pointerId)) {
    mapSvg.releasePointerCapture(event.pointerId);
  }

  panState = null;
  mapSvg.classList.remove("is-panning");

  if (wasMoved) {
    suppressMapClickUntil = Date.now() + 250;
  }
}

mapSvg.addEventListener("pointerup", finishMapPan);
mapSvg.addEventListener("pointercancel", finishMapPan);

mapSvg.addEventListener("click", (event) => {
  if (
    !canUseBiomeFeatureInCurrentContext() ||
    !biomeOverlayEnabled ||
    !biomeDatabaseReady ||
    Date.now() < suppressMapClickUntil
  ) {
    return;
  }

  // Marker clicks already have their own behavior. selectLocation() will
  // also select that marker's chunk when the biome layer is on.
  if (
    event.target.closest &&
    event.target.closest(".marker-button")
  ) {
    return;
  }

  const chunk = getChunkAtClientPoint(
    event.clientX,
    event.clientY
  );

  selectBiomeChunk(chunk.chunkX, chunk.chunkZ);
});

mapSvg.addEventListener("pointermove", showBiomeTooltip);
mapSvg.addEventListener("pointerleave", hideBiomeTooltip);

mapSvg.addEventListener("keydown", (event) => {
  if (!hasMapContent()) return;

  switch (event.key) {
    case "+":
    case "=":
      event.preventDefault();
      zoomMapAt(
        MAP_WIDTH / 2,
        MAP_HEIGHT / 2,
        ZOOM_BUTTON_FACTOR
      );
      break;

    case "-":
    case "_":
      event.preventDefault();
      zoomMapAt(
        MAP_WIDTH / 2,
        MAP_HEIGHT / 2,
        1 / ZOOM_BUTTON_FACTOR
      );
      break;

    case "0":
    case "f":
    case "F":
      event.preventDefault();
      fitMapToLocations();
      break;

    case "ArrowLeft":
      event.preventDefault();
      panMapByKeyboard(-1, 0);
      break;

    case "ArrowRight":
      event.preventDefault();
      panMapByKeyboard(1, 0);
      break;

    case "ArrowUp":
      event.preventDefault();
      panMapByKeyboard(0, -1);
      break;

    case "ArrowDown":
      event.preventDefault();
      panMapByKeyboard(0, 1);
      break;
  }
});

// The world camera is stored in Minecraft coordinates, so resizing does not
// change what we are looking at. It can change when chunk borders become
// visually useful, though, so redraw after a resize.
window.addEventListener("resize", scheduleMapRender);

/**********************************************************************
 * 14) FULL RENDER
 **********************************************************************/

function renderAll() {
  renderMap();
  renderLocationList();
  renderBiomeEditor();
}

/**********************************************************************
 * 15) START THE APP
 **********************************************************************/

initializeWorldControls();
populateBiomeDropdown();
renderAll();
loadSharedMap();
