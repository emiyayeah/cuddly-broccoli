/**********************************************************************
 * vanilla minecraft biomes — bedrock edition
 * --------------------------------------------------------------------
 * biome names are written in lowercase.
 *
 * id:
 * - uses the bedrock edition biome identifier
 * - keep this stable after assigning chunks in supabase
 *
 * label:
 * - the human-readable biome name shown in the map
 * - all lowercase, per this project's style
 *
 * color:
 * - uses the linked imageworldgenerator palette where that palette has
 *   a direct equivalent
 * - newer vanilla biomes use compatible placeholder colors that can be
 *   adjusted later without changing saved biome assignments
 *
 * dimensions / layers:
 * - regular overworld biomes are available on every overworld map layer,
 *   because their biome volume may continue underground
 * - cave-specific biomes are limited to underground/bottom layers
 * - nether and end biomes are limited to their dimensions
 **********************************************************************/

window.BIOME_OPTIONS = [

  // overworld — aquatic / shores

  {
    id: "ocean",
    label: "ocean",
    color: "#000070",
    dimensions: ["overworld"],
  },
  {
    id: "deep_ocean",
    label: "deep ocean",
    color: "#000030",
    dimensions: ["overworld"],
  },
  {
    id: "frozen_ocean",
    label: "frozen ocean",
    color: "#7070d6",
    dimensions: ["overworld"],
  },
  {
    id: "deep_frozen_ocean",
    label: "deep frozen ocean",
    color: "#404090",
    dimensions: ["overworld"],
  },
  {
    id: "cold_ocean",
    label: "cold ocean",
    color: "#202070",
    dimensions: ["overworld"],
  },
  {
    id: "deep_cold_ocean",
    label: "deep cold ocean",
    color: "#202038",
    dimensions: ["overworld"],
  },
  {
    id: "lukewarm_ocean",
    label: "lukewarm ocean",
    color: "#000090",
    dimensions: ["overworld"],
  },
  {
    id: "deep_lukewarm_ocean",
    label: "deep lukewarm ocean",
    color: "#000040",
    dimensions: ["overworld"],
  },
  {
    id: "warm_ocean",
    label: "warm ocean",
    color: "#0000ac",
    dimensions: ["overworld"],
  },
  {
    id: "river",
    label: "river",
    color: "#0000ff",
    dimensions: ["overworld"],
  },
  {
    id: "frozen_river",
    label: "frozen river",
    color: "#a0a0ff",
    dimensions: ["overworld"],
  },
  {
    id: "beach",
    label: "beach",
    color: "#fade55",
    dimensions: ["overworld"],
  },
  {
    id: "stone_beach",
    label: "stony shore",
    color: "#a2a284",
    dimensions: ["overworld"],
  },
  {
    id: "cold_beach",
    label: "snowy beach",
    color: "#faf0c0",
    dimensions: ["overworld"],
  },

  // overworld — plains / forests / wetlands

  {
    id: "plains",
    label: "plains",
    color: "#8db360",
    dimensions: ["overworld"],
  },
  {
    id: "sunflower_plains",
    label: "sunflower plains",
    color: "#b5db88",
    dimensions: ["overworld"],
  },
  {
    id: "forest",
    label: "forest",
    color: "#056621",
    dimensions: ["overworld"],
  },
  {
    id: "flower_forest",
    label: "flower forest",
    color: "#2d8e49",
    dimensions: ["overworld"],
  },
  {
    id: "birch_forest",
    label: "birch forest",
    color: "#307444",
    dimensions: ["overworld"],
  },
  {
    id: "birch_forest_mutated",
    label: "old growth birch forest",
    color: "#589c6c",
    dimensions: ["overworld"],
  },
  {
    id: "roofed_forest",
    label: "dark forest",
    color: "#40511a",
    dimensions: ["overworld"],
  },
  {
    id: "pale_garden",
    label: "pale garden",
    color: "#aeb7a3",
    dimensions: ["overworld"],
  },
  {
    id: "swampland",
    label: "swamp",
    color: "#07f9b2",
    dimensions: ["overworld"],
  },
  {
    id: "mangrove_swamp",
    label: "mangrove swamp",
    color: "#4c763c",
    dimensions: ["overworld"],
  },
  {
    id: "mushroom_island",
    label: "mushroom fields",
    color: "#ff00ff",
    dimensions: ["overworld"],
  },
  {
    id: "meadow",
    label: "meadow",
    color: "#83bb6d",
    dimensions: ["overworld"],
  },
  {
    id: "cherry_grove",
    label: "cherry grove",
    color: "#dea4bd",
    dimensions: ["overworld"],
  },

  // overworld — taiga / snowy

  {
    id: "taiga",
    label: "taiga",
    color: "#0b6659",
    dimensions: ["overworld"],
  },
  {
    id: "cold_taiga",
    label: "snowy taiga",
    color: "#31554a",
    dimensions: ["overworld"],
  },
  {
    id: "mega_taiga",
    label: "old growth pine taiga",
    color: "#596651",
    dimensions: ["overworld"],
  },
  {
    id: "redwood_taiga_mutated",
    label: "old growth spruce taiga",
    color: "#818e79",
    dimensions: ["overworld"],
  },
  {
    id: "ice_plains",
    label: "snowy plains",
    color: "#ffffff",
    dimensions: ["overworld"],
  },
  {
    id: "ice_plains_spikes",
    label: "ice spikes",
    color: "#b4dcdc",
    dimensions: ["overworld"],
  },
  {
    id: "grove",
    label: "grove",
    color: "#80b497",
    dimensions: ["overworld"],
  },
  {
    id: "snowy_slopes",
    label: "snowy slopes",
    color: "#d8e3de",
    dimensions: ["overworld"],
  },

  // overworld — mountains

  {
    id: "extreme_hills",
    label: "windswept hills",
    color: "#606060",
    dimensions: ["overworld"],
  },
  {
    id: "extreme_hills_mutated",
    label: "windswept gravelly hills",
    color: "#888888",
    dimensions: ["overworld"],
  },
  {
    id: "extreme_hills_plus_trees",
    label: "windswept forest",
    color: "#507050",
    dimensions: ["overworld"],
  },
  {
    id: "jagged_peaks",
    label: "jagged peaks",
    color: "#8d969c",
    dimensions: ["overworld"],
  },
  {
    id: "frozen_peaks",
    label: "frozen peaks",
    color: "#b9cad1",
    dimensions: ["overworld"],
  },
  {
    id: "stony_peaks",
    label: "stony peaks",
    color: "#8a8a7d",
    dimensions: ["overworld"],
  },

  // overworld — warm / dry

  {
    id: "desert",
    label: "desert",
    color: "#fa9418",
    dimensions: ["overworld"],
  },
  {
    id: "savanna",
    label: "savanna",
    color: "#bdb25f",
    dimensions: ["overworld"],
  },
  {
    id: "savanna_plateau",
    label: "savanna plateau",
    color: "#a79d64",
    dimensions: ["overworld"],
  },
  {
    id: "savanna_mutated",
    label: "windswept savanna",
    color: "#e5da87",
    dimensions: ["overworld"],
  },
  {
    id: "mesa",
    label: "badlands",
    color: "#d94515",
    dimensions: ["overworld"],
  },
  {
    id: "mesa_bryce",
    label: "eroded badlands",
    color: "#ff6d3d",
    dimensions: ["overworld"],
  },
  {
    id: "mesa_plateau_stone",
    label: "wooded badlands",
    color: "#b09765",
    dimensions: ["overworld"],
  },

  // overworld — jungle

  {
    id: "jungle",
    label: "jungle",
    color: "#537b09",
    dimensions: ["overworld"],
  },
  {
    id: "jungle_edge",
    label: "sparse jungle",
    color: "#628b17",
    dimensions: ["overworld"],
  },
  {
    id: "bamboo_jungle",
    label: "bamboo jungle",
    color: "#768e14",
    dimensions: ["overworld"],
  },

  // overworld — cave biomes

  {
    id: "lush_caves",
    label: "lush caves",
    color: "#65a85f",
    dimensions: ["overworld"],
    layers: ["underground", "bottom"],
  },
  {
    id: "dripstone_caves",
    label: "dripstone caves",
    color: "#8b6f5c",
    dimensions: ["overworld"],
    layers: ["underground", "bottom"],
  },
  {
    id: "sulfur_caves",
    label: "sulfur caves",
    color: "#d6c34a",
    dimensions: ["overworld"],
    layers: ["underground", "bottom"],
  },
  {
    id: "deep_dark",
    label: "deep dark",
    color: "#1f4d50",
    dimensions: ["overworld"],
    layers: ["bottom"],
  },

  // nether

  {
    id: "hell",
    label: "nether wastes",
    color: "#bf3b3b",
    dimensions: ["nether"],
    layers: ["nether"],
  },
  {
    id: "soulsand_valley",
    label: "soul sand valley",
    color: "#5e3830",
    dimensions: ["nether"],
    layers: ["nether"],
  },
  {
    id: "crimson_forest",
    label: "crimson forest",
    color: "#dd0808",
    dimensions: ["nether"],
    layers: ["nether"],
  },
  {
    id: "warped_forest",
    label: "warped forest",
    color: "#49907b",
    dimensions: ["nether"],
    layers: ["nether"],
  },
  {
    id: "basalt_deltas",
    label: "basalt deltas",
    color: "#403636",
    dimensions: ["nether"],
    layers: ["nether"],
  },

  // the end

  {
    id: "the_end",
    label: "the end",
    color: "#8080ff",
    dimensions: ["end"],
    layers: ["end"],
  },
];
