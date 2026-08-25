/**********************************************************************
 * SUPABASE / SHARED DATABASE
 * --------------------------------------------------------------------
 * Browser-safe shared database operations for:
 *
 * LOCATIONS
 * - dimension-aware
 * - optionally scoped to one vertical map layer
 *
 * CHUNK BIOMES
 * - dimension + map-layer aware
 *
 * The publishable key below is intentionally browser-safe.
 * NEVER put a Supabase secret key or service_role key in this file.
 **********************************************************************/

/**********************************************************************
 * 1) PROJECT CONNECTION
 **********************************************************************/

const SUPABASE_URL = "https://pcfsvukjcuaeufbfnkbk.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_K_A6SmDK2aISkBMMRPBvmg_VhA_Bykt";

/**********************************************************************
 * 2) CREATE THE SUPABASE CLIENT
 **********************************************************************/

if (!window.supabase) {
  throw new Error("Supabase library did not load.");
}

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

/**********************************************************************
 * 3) NORMALIZE DATABASE ROWS
 **********************************************************************/

function normalizeLocation(row) {
  return {
    id: row.id,
    name: row.name,
    x: Number(row.x),
    y: row.y === null ? null : Number(row.y),
    z: Number(row.z),
    notes: row.notes || "",
    dimension: row.dimension || "overworld",

    // null means: show this waypoint on every map layer in the dimension.
    mapLayer: row.map_layer || null,

    createdAt: row.created_at || null,
  };
}

function normalizeChunkBiome(row) {
  return {
    dimension: row.dimension,
    mapLayer: row.map_layer,
    chunkX: Number(row.chunk_x),
    chunkZ: Number(row.chunk_z),
    biomeId: row.biome_id,
    notes: row.notes || "",
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

/**********************************************************************
 * 4) LOCATION DATABASE OPERATIONS
 **********************************************************************/

async function getSharedLocations() {
  const { data, error } = await supabaseClient
    .from("locations")
    .select(
      "id, name, x, y, z, notes, dimension, map_layer, created_at"
    )
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map(normalizeLocation);
}

async function addSharedLocation(location) {
  const { data, error } = await supabaseClient
    .from("locations")
    .insert({
      name: location.name,
      x: location.x,
      y: location.y,
      z: location.z,
      notes: location.notes || "",
      dimension: location.dimension,
      map_layer: location.mapLayer || null,
    })
    .select(
      "id, name, x, y, z, notes, dimension, map_layer, created_at"
    )
    .single();

  if (error) {
    throw error;
  }

  return normalizeLocation(data);
}

async function updateSharedLocation(id, location) {
  const { data, error } = await supabaseClient
    .from("locations")
    .update({
      name: location.name,
      x: location.x,
      y: location.y,
      z: location.z,
      notes: location.notes || "",
      dimension: location.dimension,
      map_layer: location.mapLayer || null,
    })
    .eq("id", id)
    .select(
      "id, name, x, y, z, notes, dimension, map_layer, created_at"
    )
    .single();

  if (error) {
    throw error;
  }

  return normalizeLocation(data);
}

async function deleteSharedLocation(id) {
  const { error } = await supabaseClient
    .from("locations")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}

/**********************************************************************
 * 5) CHUNK BIOME DATABASE OPERATIONS
 **********************************************************************/

async function getSharedChunkBiomes() {
  const { data, error } = await supabaseClient
    .from("chunk_biomes")
    .select(
      "dimension, map_layer, chunk_x, chunk_z, biome_id, notes, created_at, updated_at"
    )
    .order("dimension", { ascending: true })
    .order("map_layer", { ascending: true })
    .order("chunk_z", { ascending: true })
    .order("chunk_x", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map(normalizeChunkBiome);
}

async function saveSharedChunkBiome(chunkBiome) {
  const now = new Date().toISOString();

  const { data, error } = await supabaseClient
    .from("chunk_biomes")
    .upsert(
      {
        dimension: chunkBiome.dimension,
        map_layer: chunkBiome.mapLayer,
        chunk_x: chunkBiome.chunkX,
        chunk_z: chunkBiome.chunkZ,
        biome_id: chunkBiome.biomeId,
        notes: chunkBiome.notes || "",
        updated_at: now,
      },
      {
        onConflict: "dimension,map_layer,chunk_x,chunk_z",
      }
    )
    .select(
      "dimension, map_layer, chunk_x, chunk_z, biome_id, notes, created_at, updated_at"
    )
    .single();

  if (error) {
    throw error;
  }

  return normalizeChunkBiome(data);
}

async function deleteSharedChunkBiome(
  dimension,
  mapLayer,
  chunkX,
  chunkZ
) {
  const { error } = await supabaseClient
    .from("chunk_biomes")
    .delete()
    .eq("dimension", dimension)
    .eq("map_layer", mapLayer)
    .eq("chunk_x", chunkX)
    .eq("chunk_z", chunkZ);

  if (error) {
    throw error;
  }
}

/**********************************************************************
 * 6) EXPOSE A SMALL DATABASE API TO script.js
 **********************************************************************/

window.realmDatabase = {
  getLocations: getSharedLocations,
  addLocation: addSharedLocation,
  updateLocation: updateSharedLocation,
  deleteLocation: deleteSharedLocation,

  getChunkBiomes: getSharedChunkBiomes,
  saveChunkBiome: saveSharedChunkBiome,
  deleteChunkBiome: deleteSharedChunkBiome,
};
