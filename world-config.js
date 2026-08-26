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

  biomeFeatureEnabled: false,

  dimensions: [
    {
      id: "overworld",
      label: "overworld",
      enabled: true,
      defaultLayer: "surface",
      portalScaleToOverworld: 1,

      layers: [
        {
          id: "surface",
          label: "surface",
          description: "surface level, above-ground map",
        },
        {
          id: "underground",
          label: "underground",
          description: "caves and underground areas",
        },
        {
          id: "bottom",
          label: "bottom",
          description: "deep/bottom layer, below Y -50",
        },
      ],
    },

    {
      id: "nether",
      label: "nether",
      enabled: true,
      defaultLayer: "nether",
      portalScaleToOverworld: 8,

      layers: [
        {
          id: "nether",
          label: "nether",
          description: "The Nether map.",
        },
      ],
    },

    // The End is scaffolded now but hidden from the selector.
    // Change enabled to true whenever you want to start mapping it.
    {
      id: "end",
      label: "the end",
      enabled: false,
      defaultLayer: "end",
      portalScaleToOverworld: null,

      layers: [
        {
          id: "end",
          label: "the end",
          description: "map of the end",
        },
      ],
    },
  ],
};
