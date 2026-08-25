/**********************************************************************
 * WORLD / DIMENSION / MAP-LAYER CONFIGURATION
 * --------------------------------------------------------------------
 * Edit this file when you want to change:
 * - which Minecraft dimensions appear in the map selector
 * - which vertical map layers each dimension has
 * - the display names for those layers
 *
 * IMPORTANT:
 * Keep IDs stable once data has been saved using them.
 *
 * "portalScaleToOverworld" is included now so future Nether/Overworld
 * coordinate-conversion tools will not require a data-model redesign.
 **********************************************************************/

window.WORLD_CONFIG = {
  defaultDimension: "overworld",

  dimensions: [
    {
      id: "overworld",
      label: "Overworld",
      enabled: true,
      defaultLayer: "surface",
      portalScaleToOverworld: 1,

      layers: [
        {
          id: "surface",
          label: "Surface",
          description: "The normal above-ground map.",
        },
        {
          id: "underground",
          label: "Underground",
          description: "Caves and underground areas.",
        },
        {
          id: "bottom",
          label: "Bottom",
          description: "The deep/bottom layer, including areas around Y -51.",
        },
      ],
    },

    {
      id: "nether",
      label: "Nether",
      enabled: true,
      defaultLayer: "nether",
      portalScaleToOverworld: 8,

      layers: [
        {
          id: "nether",
          label: "Nether",
          description: "The Nether map.",
        },
      ],
    },

    // The End is scaffolded now but hidden from the selector.
    // Change enabled to true whenever you want to start mapping it.
    {
      id: "end",
      label: "The End",
      enabled: false,
      defaultLayer: "end",
      portalScaleToOverworld: null,

      layers: [
        {
          id: "end",
          label: "The End",
          description: "The End map.",
        },
      ],
    },
  ],
};
