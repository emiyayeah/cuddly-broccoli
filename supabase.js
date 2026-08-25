/**********************************************************************
 * SUPABASE / SHARED DATABASE
 * --------------------------------------------------------------------
 * This file contains only the shared-database connection and the four
 * operations our map needs:
 *
 * - get all locations
 * - add a location
 * - update a location
 * - delete a location
 *
 * The publishable key below is intentionally browser-safe. Never put a
 * Supabase secret key or service_role key in this file.
 **********************************************************************/

/**********************************************************************
 * 1) PROJECT CONNECTION
 **********************************************************************/

// Use the PROJECT URL, not the REST endpoint.
// In other words: no "/rest/v1/" on the end.
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
 * 3) SMALL DATA HELPER
 **********************************************************************/

function normalizeLocation(row) {
  return {
    id: row.id,
    name: row.name,
    x: Number(row.x),
    y: row.y === null ? null : Number(row.y),
    z: Number(row.z),
    notes: row.notes || "",
    createdAt: row.created_at || null,
  };
}

/**********************************************************************
 * 4) DATABASE OPERATIONS
 **********************************************************************/

async function getSharedLocations() {
  const { data, error } = await supabaseClient
    .from("locations")
    .select("id, name, x, y, z, notes, created_at")
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
    })
    .select("id, name, x, y, z, notes, created_at")
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
    })
    .eq("id", id)
    .select("id, name, x, y, z, notes, created_at")
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
 * 5) EXPOSE A TINY DATABASE API TO script.js
 **********************************************************************/

window.realmDatabase = {
  getLocations: getSharedLocations,
  addLocation: addSharedLocation,
  updateLocation: updateSharedLocation,
  deleteLocation: deleteSharedLocation,
};
