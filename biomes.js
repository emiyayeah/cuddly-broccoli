/**********************************************************************
 * BIOME OPTIONS
 * --------------------------------------------------------------------
 * THIS IS THE FILE TO EDIT when you want to add/remove biomes or change
 * their colors.
 *
 * Each biome has:
 * - id:         stable value saved in Supabase
 * - label:      name shown to people
 * - color:      overlay color
 * - dimensions: dimensions where this biome should appear
 * - layers:     map layers where it should appear
 *
 * IMPORTANT:
 * Once chunks have been assigned to an ID, try not to change that ID.
 * You CAN freely change the label or color later.
 *
 * This is only a starter palette. Replace/add/remove anything you want.
 **********************************************************************/

window.BIOME_OPTIONS = [
  // ---------------------------------------------------------------
  // OVERWORLD — SURFACE
  // ---------------------------------------------------------------
  {
    id: "plains",
    label: "Plains",
    color: "#8fbd62",
    dimensions: ["overworld"],
    layers: ["surface"],
  },
  {
    id: "forest",
    label: "Forest",
    color: "#4f8147",
    dimensions: ["overworld"],
    layers: ["surface"],
  },
  {
    id: "desert",
    label: "Desert",
    color: "#d8c879",
    dimensions: ["overworld"],
    layers: ["surface"],
  },
  {
    id: "savanna",
    label: "Savanna",
    color: "#b7a75f",
    dimensions: ["overworld"],
    layers: ["surface"],
  },
  {
    id: "taiga",
    label: "Taiga",
    color: "#71927d",
    dimensions: ["overworld"],
    layers: ["surface"],
  },
  {
    id: "swamp",
    label: "Swamp",
    color: "#66744a",
    dimensions: ["overworld"],
    layers: ["surface"],
  },
  {
    id: "jungle",
    label: "Jungle",
    color: "#4e9148",
    dimensions: ["overworld"],
    layers: ["surface"],
  },
  {
    id: "snowy_plains",
    label: "Snowy Plains",
    color: "#dce9e8",
    dimensions: ["overworld"],
    layers: ["surface"],
  },
  {
    id: "ocean",
    label: "Ocean",
    color: "#5e8fbd",
    dimensions: ["overworld"],
    layers: ["surface"],
  },
  {
    id: "badlands",
    label: "Badlands",
    color: "#bd7656",
    dimensions: ["overworld"],
    layers: ["surface"],
  },
  {
    id: "cherry_grove",
    label: "Cherry Grove",
    color: "#dea4bd",
    dimensions: ["overworld"],
    layers: ["surface"],
  },
  {
    id: "mangrove_swamp",
    label: "Mangrove Swamp",
    color: "#536f58",
    dimensions: ["overworld"],
    layers: ["surface"],
  },

  // ---------------------------------------------------------------
  // OVERWORLD — UNDERGROUND / BOTTOM
  // ---------------------------------------------------------------
  {
    id: "lush_caves",
    label: "Lush Caves",
    color: "#5f9c66",
    dimensions: ["overworld"],
    layers: ["underground", "bottom"],
  },
  {
    id: "dripstone_caves",
    label: "Dripstone Caves",
    color: "#8b7665",
    dimensions: ["overworld"],
    layers: ["underground", "bottom"],
  },
  {
    id: "deep_dark",
    label: "Deep Dark",
    color: "#355f68",
    dimensions: ["overworld"],
    layers: ["bottom"],
  },

  // ---------------------------------------------------------------
  // NETHER
  // ---------------------------------------------------------------
  {
    id: "nether_wastes",
    label: "Nether Wastes",
    color: "#a84f45",
    dimensions: ["nether"],
    layers: ["nether"],
  },
  {
    id: "crimson_forest",
    label: "Crimson Forest",
    color: "#8f3341",
    dimensions: ["nether"],
    layers: ["nether"],
  },
  {
    id: "warped_forest",
    label: "Warped Forest",
    color: "#32847d",
    dimensions: ["nether"],
    layers: ["nether"],
  },
  {
    id: "soul_sand_valley",
    label: "Soul Sand Valley",
    color: "#7c7068",
    dimensions: ["nether"],
    layers: ["nether"],
  },
  {
    id: "basalt_deltas",
    label: "Basalt Deltas",
    color: "#58585c",
    dimensions: ["nether"],
    layers: ["nether"],
  },
];
