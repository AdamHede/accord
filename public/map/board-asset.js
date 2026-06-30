import { WORLD_LAND_PATHS } from "../world-land-paths.js";

export const BOARD_ASSET_SCHEMA_VERSION = 1;

export const BOARD_ASSET = {
  "schemaVersion": 1,
  "board": {
    "width": 1200,
    "height": 620
  },
  "cameraPresets": {
    "fitWorld": {
      "bounds": {
        "x": 0,
        "y": 0,
        "width": 1200,
        "height": 620
      },
      "minScale": 0.68,
      "maxScale": 4
    },
    "northAtlantic": {
      "bounds": {
        "x": 390,
        "y": 20,
        "width": 430,
        "height": 260
      }
    },
    "indoPacific": {
      "bounds": {
        "x": 730,
        "y": 40,
        "width": 430,
        "height": 520
      }
    }
  },
  "layers": {
    "worldArt": 1,
    "territory": 2,
    "sea": 3,
    "routes": 4,
    "labels": 5,
    "units": 6,
    "orders": 7,
    "inspector": 8
  },
  "geometry": {
    "worldLandPaths": WORLD_LAND_PATHS
  },
  "regions": [
    {
      "name": "North America",
      "ids": [
        "awc",
        "cal",
        "gla",
        "ena",
        "mex",
        "yuc",
        "pan",
        "car"
      ],
      "polygon": [
        [
          36,
          72
        ],
        [
          92,
          38
        ],
        [
          170,
          48
        ],
        [
          242,
          78
        ],
        [
          322,
          118
        ],
        [
          392,
          165
        ],
        [
          383,
          232
        ],
        [
          354,
          290
        ],
        [
          316,
          324
        ],
        [
          262,
          282
        ],
        [
          214,
          274
        ],
        [
          160,
          292
        ],
        [
          104,
          253
        ],
        [
          58,
          201
        ],
        [
          38,
          143
        ]
      ]
    },
    {
      "name": "South America",
      "ids": [
        "ama",
        "bra",
        "and",
        "pat"
      ],
      "polygon": [
        [
          240,
          292
        ],
        [
          330,
          292
        ],
        [
          390,
          330
        ],
        [
          455,
          390
        ],
        [
          444,
          470
        ],
        [
          365,
          566
        ],
        [
          320,
          584
        ],
        [
          285,
          512
        ],
        [
          262,
          438
        ],
        [
          238,
          356
        ]
      ]
    },
    {
      "name": "Europe",
      "ids": [
        "bri",
        "weu",
        "ceu",
        "sca",
        "ibe",
        "bal",
        "ana",
        "eeu"
      ],
      "polygon": [
        [
          482,
          112
        ],
        [
          524,
          68
        ],
        [
          612,
          46
        ],
        [
          688,
          42
        ],
        [
          764,
          82
        ],
        [
          790,
          145
        ],
        [
          742,
          195
        ],
        [
          664,
          205
        ],
        [
          580,
          188
        ],
        [
          514,
          154
        ]
      ]
    },
    {
      "name": "Africa & Middle East",
      "ids": [
        "mag",
        "lib",
        "waf",
        "con",
        "egy",
        "lev",
        "ara",
        "per",
        "eaf",
        "cap"
      ],
      "polygon": [
        [
          520,
          202
        ],
        [
          620,
          174
        ],
        [
          715,
          178
        ],
        [
          800,
          196
        ],
        [
          838,
          272
        ],
        [
          800,
          354
        ],
        [
          737,
          510
        ],
        [
          655,
          492
        ],
        [
          580,
          410
        ],
        [
          520,
          306
        ]
      ]
    },
    {
      "name": "North Asia",
      "ids": [
        "ind",
        "cas",
        "ste",
        "sib",
        "mon",
        "chi",
        "man",
        "jak"
      ],
      "polygon": [
        [
          742,
          98
        ],
        [
          854,
          62
        ],
        [
          940,
          50
        ],
        [
          1052,
          70
        ],
        [
          1132,
          118
        ],
        [
          1122,
          176
        ],
        [
          1058,
          222
        ],
        [
          974,
          238
        ],
        [
          880,
          256
        ],
        [
          805,
          218
        ],
        [
          754,
          162
        ]
      ]
    },
    {
      "name": "Indo-Pacific",
      "ids": [
        "sea",
        "mal",
        "png",
        "aus"
      ],
      "polygon": [
        [
          888,
          264
        ],
        [
          950,
          236
        ],
        [
          1016,
          266
        ],
        [
          1092,
          318
        ],
        [
          1134,
          382
        ],
        [
          1110,
          494
        ],
        [
          1026,
          548
        ],
        [
          950,
          520
        ],
        [
          906,
          440
        ],
        [
          884,
          344
        ]
      ]
    }
  ]
};

export const BOARD_PROVINCE_METADATA = {
  "ena": {
    "id": "ena",
    "rulesGraphId": "ena",
    "kind": "land",
    "supplyCenterKind": "home",
    "region": "North America",
    "geometry": {
      "type": "region-voronoi",
      "region": "North America",
      "anchor": {
        "x": 29.17,
        "y": 24.44
      }
    },
    "label": {
      "anchor": {
        "x": 29.2,
        "y": 25.1
      },
      "variants": {
        "full": "Eastern North America",
        "short": "E. N. America"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 29.17,
        "y": 24.44
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "gla": {
    "id": "gla",
    "rulesGraphId": "gla",
    "kind": "land",
    "supplyCenterKind": "home",
    "region": "North America",
    "geometry": {
      "type": "region-voronoi",
      "region": "North America",
      "anchor": {
        "x": 25.56,
        "y": 22.22
      }
    },
    "label": {
      "anchor": {
        "x": 25,
        "y": 22
      },
      "variants": {
        "full": "Great Lakes",
        "short": "Great Lakes"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 25.56,
        "y": 22.22
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "cal": {
    "id": "cal",
    "rulesGraphId": "cal",
    "kind": "land",
    "supplyCenterKind": "home",
    "region": "North America",
    "geometry": {
      "type": "region-voronoi",
      "region": "North America",
      "anchor": {
        "x": 16.67,
        "y": 28.15
      }
    },
    "label": {
      "anchor": {
        "x": 16.2,
        "y": 27.8
      },
      "variants": {
        "full": "California",
        "short": "California"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 16.67,
        "y": 28.15
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "awc": {
    "id": "awc",
    "rulesGraphId": "awc",
    "kind": "land",
    "supplyCenterKind": null,
    "region": "North America",
    "geometry": {
      "type": "region-voronoi",
      "region": "North America",
      "anchor": {
        "x": 12.5,
        "y": 11.11
      }
    },
    "label": {
      "anchor": {
        "x": 12.5,
        "y": 11.11
      },
      "variants": {
        "full": "Alaska & Western Canada",
        "short": "Alaska"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 12.5,
        "y": 11.11
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "mex": {
    "id": "mex",
    "rulesGraphId": "mex",
    "kind": "land",
    "supplyCenterKind": "neutral",
    "region": "North America",
    "geometry": {
      "type": "region-voronoi",
      "region": "North America",
      "anchor": {
        "x": 21.67,
        "y": 39.26
      }
    },
    "label": {
      "anchor": {
        "x": 21.3,
        "y": 38.4
      },
      "variants": {
        "full": "Mexico",
        "short": "Mexico"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 21.67,
        "y": 39.26
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "yuc": {
    "id": "yuc",
    "rulesGraphId": "yuc",
    "kind": "land",
    "supplyCenterKind": null,
    "region": "North America",
    "geometry": {
      "type": "region-voronoi",
      "region": "North America",
      "anchor": {
        "x": 25.56,
        "y": 41.48
      }
    },
    "label": {
      "anchor": {
        "x": 25.2,
        "y": 41.3
      },
      "variants": {
        "full": "Yucatán & Central Mexico",
        "short": "Yucatán"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 25.56,
        "y": 41.48
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "pan": {
    "id": "pan",
    "rulesGraphId": "pan",
    "kind": "land",
    "supplyCenterKind": "neutral",
    "region": "North America",
    "geometry": {
      "type": "region-voronoi",
      "region": "North America",
      "anchor": {
        "x": 27.78,
        "y": 48.89
      }
    },
    "label": {
      "anchor": {
        "x": 27.6,
        "y": 48.1
      },
      "variants": {
        "full": "Panama Canal",
        "short": "Panama Canal"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 27.78,
        "y": 48.89
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "car": {
    "id": "car",
    "rulesGraphId": "car",
    "kind": "land",
    "supplyCenterKind": "neutral",
    "region": "North America",
    "geometry": {
      "type": "region-voronoi",
      "region": "North America",
      "anchor": {
        "x": 30,
        "y": 40.74
      }
    },
    "label": {
      "anchor": {
        "x": 30.5,
        "y": 41.4
      },
      "variants": {
        "full": "Caribbean Islands",
        "short": "Carib."
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 30,
        "y": 40.74
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "ama": {
    "id": "ama",
    "rulesGraphId": "ama",
    "kind": "land",
    "supplyCenterKind": null,
    "region": "South America",
    "geometry": {
      "type": "region-voronoi",
      "region": "South America",
      "anchor": {
        "x": 32.5,
        "y": 59.26
      }
    },
    "label": {
      "anchor": {
        "x": 32.5,
        "y": 59.26
      },
      "variants": {
        "full": "Amazon Basin",
        "short": "Amazon Basin"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 32.5,
        "y": 59.26
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "bra": {
    "id": "bra",
    "rulesGraphId": "bra",
    "kind": "land",
    "supplyCenterKind": "neutral",
    "region": "South America",
    "geometry": {
      "type": "region-voronoi",
      "region": "South America",
      "anchor": {
        "x": 36.94,
        "y": 66.67
      }
    },
    "label": {
      "anchor": {
        "x": 36.94,
        "y": 66.67
      },
      "variants": {
        "full": "Brazil",
        "short": "Brazil"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 36.94,
        "y": 66.67
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "and": {
    "id": "and",
    "rulesGraphId": "and",
    "kind": "land",
    "supplyCenterKind": "neutral",
    "region": "South America",
    "geometry": {
      "type": "region-voronoi",
      "region": "South America",
      "anchor": {
        "x": 30,
        "y": 67.41
      }
    },
    "label": {
      "anchor": {
        "x": 30,
        "y": 67.41
      },
      "variants": {
        "full": "Andes",
        "short": "Andes"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 30,
        "y": 67.41
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "pat": {
    "id": "pat",
    "rulesGraphId": "pat",
    "kind": "land",
    "supplyCenterKind": null,
    "region": "South America",
    "geometry": {
      "type": "region-voronoi",
      "region": "South America",
      "anchor": {
        "x": 31.11,
        "y": 88.89
      }
    },
    "label": {
      "anchor": {
        "x": 29.0,
        "y": 80.9
      },
      "variants": {
        "full": "Patagonia & Southern Cone",
        "short": "Patagonia"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 31.11,
        "y": 88.89
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "bri": {
    "id": "bri",
    "rulesGraphId": "bri",
    "kind": "land",
    "supplyCenterKind": "home",
    "region": "Europe",
    "geometry": {
      "type": "region-voronoi",
      "region": "Europe",
      "anchor": {
        "x": 49.17,
        "y": 15.56
      }
    },
    "label": {
      "anchor": {
        "x": 48.1,
        "y": 14.7
      },
      "variants": {
        "full": "Britain & Ireland",
        "short": "Britain"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 49.17,
        "y": 15.56
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "weu": {
    "id": "weu",
    "rulesGraphId": "weu",
    "kind": "land",
    "supplyCenterKind": "home",
    "region": "Europe",
    "geometry": {
      "type": "region-voronoi",
      "region": "Europe",
      "anchor": {
        "x": 50.56,
        "y": 20.74
      }
    },
    "label": {
      "anchor": {
        "x": 49.7,
        "y": 20.6
      },
      "variants": {
        "full": "Western Europe",
        "short": "W. Europe"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 50.56,
        "y": 20.74
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "ceu": {
    "id": "ceu",
    "rulesGraphId": "ceu",
    "kind": "land",
    "supplyCenterKind": "home",
    "region": "Europe",
    "geometry": {
      "type": "region-voronoi",
      "region": "Europe",
      "anchor": {
        "x": 53.89,
        "y": 18.52
      }
    },
    "label": {
      "anchor": {
        "x": 53.6,
        "y": 17.1
      },
      "variants": {
        "full": "Central Europe",
        "short": "C. Europe"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 53.89,
        "y": 18.52
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "sca": {
    "id": "sca",
    "rulesGraphId": "sca",
    "kind": "land",
    "supplyCenterKind": "neutral",
    "region": "Europe",
    "geometry": {
      "type": "region-voronoi",
      "region": "Europe",
      "anchor": {
        "x": 54.44,
        "y": 8.89
      }
    },
    "label": {
      "anchor": {
        "x": 55.4,
        "y": 8.1
      },
      "variants": {
        "full": "Scandinavia",
        "short": "Scand."
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 54.44,
        "y": 8.89
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "ibe": {
    "id": "ibe",
    "rulesGraphId": "ibe",
    "kind": "land",
    "supplyCenterKind": "neutral",
    "region": "Europe",
    "geometry": {
      "type": "region-voronoi",
      "region": "Europe",
      "anchor": {
        "x": 48.89,
        "y": 25.93
      }
    },
    "label": {
      "anchor": {
        "x": 47.9,
        "y": 26.7
      },
      "variants": {
        "full": "Iberia",
        "short": "Iberia"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 48.89,
        "y": 25.93
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "bal": {
    "id": "bal",
    "rulesGraphId": "bal",
    "kind": "land",
    "supplyCenterKind": null,
    "region": "Europe",
    "geometry": {
      "type": "region-voronoi",
      "region": "Europe",
      "anchor": {
        "x": 55.83,
        "y": 23.7
      }
    },
    "label": {
      "anchor": {
        "x": 56.2,
        "y": 23.5
      },
      "variants": {
        "full": "Balkans",
        "short": "Balkans"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 55.83,
        "y": 23.7
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "ana": {
    "id": "ana",
    "rulesGraphId": "ana",
    "kind": "land",
    "supplyCenterKind": null,
    "region": "Europe",
    "geometry": {
      "type": "region-voronoi",
      "region": "Europe",
      "anchor": {
        "x": 59.72,
        "y": 26.67
      }
    },
    "label": {
      "anchor": {
        "x": 60.1,
        "y": 26.5
      },
      "variants": {
        "full": "Anatolia",
        "short": "Anatolia"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 59.72,
        "y": 26.67
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "eeu": {
    "id": "eeu",
    "rulesGraphId": "eeu",
    "kind": "land",
    "supplyCenterKind": null,
    "region": "Europe",
    "geometry": {
      "type": "region-voronoi",
      "region": "Europe",
      "anchor": {
        "x": 58.89,
        "y": 18.52
      }
    },
    "label": {
      "anchor": {
        "x": 59.2,
        "y": 17.4
      },
      "variants": {
        "full": "Eastern Europe & Ukraine",
        "short": "E. Europe"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 58.89,
        "y": 18.52
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "mag": {
    "id": "mag",
    "rulesGraphId": "mag",
    "kind": "land",
    "supplyCenterKind": "neutral",
    "region": "Africa & Middle East",
    "geometry": {
      "type": "region-voronoi",
      "region": "Africa & Middle East",
      "anchor": {
        "x": 48.61,
        "y": 32.59
      }
    },
    "label": {
      "anchor": {
        "x": 48.4,
        "y": 32.5
      },
      "variants": {
        "full": "Maghreb",
        "short": "Maghreb"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 48.61,
        "y": 32.59
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "lib": {
    "id": "lib",
    "rulesGraphId": "lib",
    "kind": "land",
    "supplyCenterKind": null,
    "region": "Africa & Middle East",
    "geometry": {
      "type": "region-voronoi",
      "region": "Africa & Middle East",
      "anchor": {
        "x": 55,
        "y": 34.07
      }
    },
    "label": {
      "anchor": {
        "x": 54.1,
        "y": 33.3
      },
      "variants": {
        "full": "Libya & North Africa",
        "short": "Libya"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 55,
        "y": 34.07
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "waf": {
    "id": "waf",
    "rulesGraphId": "waf",
    "kind": "land",
    "supplyCenterKind": "home",
    "region": "Africa & Middle East",
    "geometry": {
      "type": "region-voronoi",
      "region": "Africa & Middle East",
      "anchor": {
        "x": 49.72,
        "y": 49.63
      }
    },
    "label": {
      "anchor": {
        "x": 49.72,
        "y": 49.63
      },
      "variants": {
        "full": "West Africa",
        "short": "West Africa"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 49.72,
        "y": 49.63
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "con": {
    "id": "con",
    "rulesGraphId": "con",
    "kind": "land",
    "supplyCenterKind": null,
    "region": "Africa & Middle East",
    "geometry": {
      "type": "region-voronoi",
      "region": "Africa & Middle East",
      "anchor": {
        "x": 56.11,
        "y": 55.56
      }
    },
    "label": {
      "anchor": {
        "x": 56.11,
        "y": 55.56
      },
      "variants": {
        "full": "Congo & Sahel",
        "short": "Congo & Sahel"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 56.11,
        "y": 55.56
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "egy": {
    "id": "egy",
    "rulesGraphId": "egy",
    "kind": "land",
    "supplyCenterKind": "home",
    "region": "Africa & Middle East",
    "geometry": {
      "type": "region-voronoi",
      "region": "Africa & Middle East",
      "anchor": {
        "x": 58.33,
        "y": 35.56
      }
    },
    "label": {
      "anchor": {
        "x": 58.2,
        "y": 36.3
      },
      "variants": {
        "full": "Egypt & Suez",
        "short": "Egypt"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 58.33,
        "y": 35.56
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "lev": {
    "id": "lev",
    "rulesGraphId": "lev",
    "kind": "land",
    "supplyCenterKind": null,
    "region": "Africa & Middle East",
    "geometry": {
      "type": "region-voronoi",
      "region": "Africa & Middle East",
      "anchor": {
        "x": 60,
        "y": 31.85
      }
    },
    "label": {
      "anchor": {
        "x": 60.7,
        "y": 31.6
      },
      "variants": {
        "full": "Levant",
        "short": "Levant"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 60,
        "y": 31.85
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "ara": {
    "id": "ara",
    "rulesGraphId": "ara",
    "kind": "land",
    "supplyCenterKind": "home",
    "region": "Africa & Middle East",
    "geometry": {
      "type": "region-voronoi",
      "region": "Africa & Middle East",
      "anchor": {
        "x": 62.5,
        "y": 40
      }
    },
    "label": {
      "anchor": {
        "x": 62.4,
        "y": 39.5
      },
      "variants": {
        "full": "Arabia",
        "short": "Arabia"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 62.5,
        "y": 40
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "per": {
    "id": "per",
    "rulesGraphId": "per",
    "kind": "land",
    "supplyCenterKind": "neutral",
    "region": "Africa & Middle East",
    "geometry": {
      "type": "region-voronoi",
      "region": "Africa & Middle East",
      "anchor": {
        "x": 64.72,
        "y": 31.85
      }
    },
    "label": {
      "anchor": {
        "x": 65.2,
        "y": 31.7
      },
      "variants": {
        "full": "Mesopotamia & Persia",
        "short": "Persia"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 64.72,
        "y": 31.85
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "eaf": {
    "id": "eaf",
    "rulesGraphId": "eaf",
    "kind": "land",
    "supplyCenterKind": "neutral",
    "region": "Africa & Middle East",
    "geometry": {
      "type": "region-voronoi",
      "region": "Africa & Middle East",
      "anchor": {
        "x": 61.67,
        "y": 52.59
      }
    },
    "label": {
      "anchor": {
        "x": 62.3,
        "y": 52.1
      },
      "variants": {
        "full": "East Africa & Horn",
        "short": "E. Africa"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 61.67,
        "y": 52.59
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "cap": {
    "id": "cap",
    "rulesGraphId": "cap",
    "kind": "land",
    "supplyCenterKind": "home",
    "region": "Africa & Middle East",
    "geometry": {
      "type": "region-voronoi",
      "region": "Africa & Middle East",
      "anchor": {
        "x": 56.94,
        "y": 77.78
      }
    },
    "label": {
      "anchor": {
        "x": 55.8,
        "y": 70.8
      },
      "variants": {
        "full": "Southern Africa & Cape",
        "short": "Cape"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 56.94,
        "y": 77.78
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "ind": {
    "id": "ind",
    "rulesGraphId": "ind",
    "kind": "land",
    "supplyCenterKind": "home",
    "region": "North Asia",
    "geometry": {
      "type": "region-voronoi",
      "region": "North Asia",
      "anchor": {
        "x": 71.67,
        "y": 39.26
      }
    },
    "label": {
      "anchor": {
        "x": 71.2,
        "y": 39.7
      },
      "variants": {
        "full": "India",
        "short": "India"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 71.67,
        "y": 39.26
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "cas": {
    "id": "cas",
    "rulesGraphId": "cas",
    "kind": "land",
    "supplyCenterKind": "neutral",
    "region": "North Asia",
    "geometry": {
      "type": "region-voronoi",
      "region": "North Asia",
      "anchor": {
        "x": 68.61,
        "y": 22.22
      }
    },
    "label": {
      "anchor": {
        "x": 68.2,
        "y": 22.8
      },
      "variants": {
        "full": "Central Asia",
        "short": "C. Asia"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 68.61,
        "y": 22.22
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "ste": {
    "id": "ste",
    "rulesGraphId": "ste",
    "kind": "land",
    "supplyCenterKind": null,
    "region": "North Asia",
    "geometry": {
      "type": "region-voronoi",
      "region": "North Asia",
      "anchor": {
        "x": 67.5,
        "y": 17.78
      }
    },
    "label": {
      "anchor": {
        "x": 67.1,
        "y": 17.1
      },
      "variants": {
        "full": "Kazakh Steppe",
        "short": "Steppe"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 67.5,
        "y": 17.78
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "sib": {
    "id": "sib",
    "rulesGraphId": "sib",
    "kind": "land",
    "supplyCenterKind": "neutral",
    "region": "North Asia",
    "geometry": {
      "type": "region-voronoi",
      "region": "North Asia",
      "anchor": {
        "x": 76.39,
        "y": 11.11
      }
    },
    "label": {
      "anchor": {
        "x": 76.39,
        "y": 11.11
      },
      "variants": {
        "full": "Siberia",
        "short": "Siberia"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 76.39,
        "y": 11.11
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "mon": {
    "id": "mon",
    "rulesGraphId": "mon",
    "kind": "land",
    "supplyCenterKind": null,
    "region": "North Asia",
    "geometry": {
      "type": "region-voronoi",
      "region": "North Asia",
      "anchor": {
        "x": 78.61,
        "y": 20.74
      }
    },
    "label": {
      "anchor": {
        "x": 78.5,
        "y": 21
      },
      "variants": {
        "full": "Mongolia",
        "short": "Mongolia"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 78.61,
        "y": 20.74
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "chi": {
    "id": "chi",
    "rulesGraphId": "chi",
    "kind": "land",
    "supplyCenterKind": "home",
    "region": "North Asia",
    "geometry": {
      "type": "region-voronoi",
      "region": "North Asia",
      "anchor": {
        "x": 80.56,
        "y": 30.37
      }
    },
    "label": {
      "anchor": {
        "x": 80,
        "y": 30
      },
      "variants": {
        "full": "China",
        "short": "China"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 80.56,
        "y": 30.37
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "man": {
    "id": "man",
    "rulesGraphId": "man",
    "kind": "land",
    "supplyCenterKind": null,
    "region": "North Asia",
    "geometry": {
      "type": "region-voronoi",
      "region": "North Asia",
      "anchor": {
        "x": 84.44,
        "y": 22.22
      }
    },
    "label": {
      "anchor": {
        "x": 84.9,
        "y": 22.5
      },
      "variants": {
        "full": "Manchuria",
        "short": "Manchuria"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 84.44,
        "y": 22.22
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "jak": {
    "id": "jak",
    "rulesGraphId": "jak",
    "kind": "land",
    "supplyCenterKind": "home",
    "region": "North Asia",
    "geometry": {
      "type": "region-voronoi",
      "region": "North Asia",
      "anchor": {
        "x": 88.06,
        "y": 27.41
      }
    },
    "label": {
      "anchor": {
        "x": 88.8,
        "y": 27.2
      },
      "variants": {
        "full": "Japan & Korea",
        "short": "Japan/Korea"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 88.06,
        "y": 27.41
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "sea": {
    "id": "sea",
    "rulesGraphId": "sea",
    "kind": "land",
    "supplyCenterKind": "neutral",
    "region": "Indo-Pacific",
    "geometry": {
      "type": "region-voronoi",
      "region": "Indo-Pacific",
      "anchor": {
        "x": 79.17,
        "y": 45.93
      }
    },
    "label": {
      "anchor": {
        "x": 78.8,
        "y": 45.6
      },
      "variants": {
        "full": "Southeast Asia",
        "short": "S.E. Asia"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 79.17,
        "y": 45.93
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "mal": {
    "id": "mal",
    "rulesGraphId": "mal",
    "kind": "land",
    "supplyCenterKind": "home",
    "region": "Indo-Pacific",
    "geometry": {
      "type": "region-voronoi",
      "region": "Indo-Pacific",
      "anchor": {
        "x": 81.11,
        "y": 57.04
      }
    },
    "label": {
      "anchor": {
        "x": 80.8,
        "y": 57.4
      },
      "variants": {
        "full": "Indonesia & Malacca",
        "short": "Malacca"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 81.11,
        "y": 57.04
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "png": {
    "id": "png",
    "rulesGraphId": "png",
    "kind": "land",
    "supplyCenterKind": null,
    "region": "Indo-Pacific",
    "geometry": {
      "type": "region-voronoi",
      "region": "Indo-Pacific",
      "anchor": {
        "x": 90.28,
        "y": 59.26
      }
    },
    "label": {
      "anchor": {
        "x": 90.8,
        "y": 58.5
      },
      "variants": {
        "full": "New Guinea & Arafura",
        "short": "New Guinea"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 90.28,
        "y": 59.26
      },
      "radius": 2.8
    },
    "layerPriority": 2
  },
  "aus": {
    "id": "aus",
    "rulesGraphId": "aus",
    "kind": "land",
    "supplyCenterKind": "home",
    "region": "Indo-Pacific",
    "geometry": {
      "type": "region-voronoi",
      "region": "Indo-Pacific",
      "anchor": {
        "x": 87.5,
        "y": 74.07
      }
    },
    "label": {
      "anchor": {
        "x": 86.6,
        "y": 69.4
      },
      "variants": {
        "full": "Australia",
        "short": "Australia"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "center": {
        "x": 87.5,
        "y": 74.07
      },
      "radius": 2.8
    },
    "layerPriority": 2
  }
};

export function boardLandPaths() { return WORLD_LAND_PATHS; }


export const BOARD_SEA_PROVINCE_METADATA = {
  "water_car_pan": {
    "id": "water_car_pan",
    "rulesGraphId": "water_car_pan",
    "kind": "sea",
    "supplyCenterKind": null,
    "region": "Atlantic",
    "geometry": {
      "type": "sea-lane",
      "endpoints": [
        "pan",
        "car"
      ],
      "lanePath": null
    },
    "label": {
      "anchor": null,
      "variants": {
        "full": "Caribbean Sea",
        "short": "CAR"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "radius": 28
    },
    "layerPriority": 4,
    "display": {
      "name": "Caribbean Sea",
      "abbreviation": "CAR",
      "priority": 4,
      "region": "Atlantic"
    }
  },
  "water_car_ena": {
    "id": "water_car_ena",
    "rulesGraphId": "water_car_ena",
    "kind": "sea",
    "supplyCenterKind": null,
    "region": "Atlantic",
    "geometry": {
      "type": "sea-lane",
      "endpoints": [
        "car",
        "ena"
      ],
      "lanePath": null
    },
    "label": {
      "anchor": null,
      "variants": {
        "full": "Western Atlantic",
        "short": "WAT"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "radius": 28
    },
    "layerPriority": 3,
    "display": {
      "name": "Western Atlantic",
      "abbreviation": "WAT",
      "priority": 3,
      "region": "Atlantic"
    }
  },
  "water_bra_car": {
    "id": "water_bra_car",
    "rulesGraphId": "water_bra_car",
    "kind": "sea",
    "supplyCenterKind": null,
    "region": "Atlantic",
    "geometry": {
      "type": "sea-lane",
      "endpoints": [
        "car",
        "bra"
      ],
      "lanePath": null
    },
    "label": {
      "anchor": null,
      "variants": {
        "full": "South Atlantic",
        "short": "SAT"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "radius": 28
    },
    "layerPriority": 3,
    "display": {
      "name": "South Atlantic",
      "abbreviation": "SAT",
      "priority": 3,
      "region": "Atlantic"
    }
  },
  "water_bri_weu": {
    "id": "water_bri_weu",
    "rulesGraphId": "water_bri_weu",
    "kind": "sea",
    "supplyCenterKind": null,
    "region": "Atlantic",
    "geometry": {
      "type": "sea-lane",
      "endpoints": [
        "bri",
        "weu"
      ],
      "lanePath": null
    },
    "label": {
      "anchor": null,
      "variants": {
        "full": "English Channel",
        "short": "ENG"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "radius": 28
    },
    "layerPriority": 5,
    "display": {
      "name": "English Channel",
      "abbreviation": "ENG",
      "priority": 5,
      "region": "Atlantic"
    }
  },
  "water_bri_sca": {
    "id": "water_bri_sca",
    "rulesGraphId": "water_bri_sca",
    "kind": "sea",
    "supplyCenterKind": null,
    "region": "Atlantic",
    "geometry": {
      "type": "sea-lane",
      "endpoints": [
        "bri",
        "sca"
      ],
      "lanePath": null
    },
    "label": {
      "anchor": null,
      "variants": {
        "full": "North Sea",
        "short": "NTH"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "radius": 28
    },
    "layerPriority": 5,
    "display": {
      "name": "North Sea",
      "abbreviation": "NTH",
      "priority": 5,
      "region": "Atlantic"
    }
  },
  "water_ibe_mag": {
    "id": "water_ibe_mag",
    "rulesGraphId": "water_ibe_mag",
    "kind": "sea",
    "supplyCenterKind": null,
    "region": "Mediterranean",
    "geometry": {
      "type": "sea-lane",
      "endpoints": [
        "ibe",
        "mag"
      ],
      "lanePath": null
    },
    "label": {
      "anchor": null,
      "variants": {
        "full": "Western Mediterranean",
        "short": "WMS"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "radius": 28
    },
    "layerPriority": 4,
    "display": {
      "name": "Western Mediterranean",
      "abbreviation": "WMS",
      "priority": 4,
      "region": "Mediterranean"
    }
  },
  "water_ara_eaf": {
    "id": "water_ara_eaf",
    "rulesGraphId": "water_ara_eaf",
    "kind": "sea",
    "supplyCenterKind": null,
    "region": "Indian Ocean",
    "geometry": {
      "type": "sea-lane",
      "endpoints": [
        "ara",
        "eaf"
      ],
      "lanePath": null
    },
    "label": {
      "anchor": null,
      "variants": {
        "full": "Red Sea",
        "short": "RED"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "radius": 28
    },
    "layerPriority": 4,
    "display": {
      "name": "Red Sea",
      "abbreviation": "RED",
      "priority": 4,
      "region": "Indian Ocean"
    }
  },
  "water_egy_mag": {
    "id": "water_egy_mag",
    "rulesGraphId": "water_egy_mag",
    "kind": "sea",
    "supplyCenterKind": null,
    "region": "Mediterranean",
    "geometry": {
      "type": "sea-lane",
      "endpoints": [
        "mag",
        "egy"
      ],
      "lanePath": null
    },
    "label": {
      "anchor": null,
      "variants": {
        "full": "Eastern Mediterranean",
        "short": "EMS"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "radius": 28
    },
    "layerPriority": 4,
    "display": {
      "name": "Eastern Mediterranean",
      "abbreviation": "EMS",
      "priority": 4,
      "region": "Mediterranean"
    }
  },
  "water_jak_man": {
    "id": "water_jak_man",
    "rulesGraphId": "water_jak_man",
    "kind": "sea",
    "supplyCenterKind": null,
    "region": "North Pacific",
    "geometry": {
      "type": "sea-lane",
      "endpoints": [
        "man",
        "jak"
      ],
      "lanePath": null
    },
    "label": {
      "anchor": null,
      "variants": {
        "full": "East China Sea",
        "short": "ECS"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "radius": 28
    },
    "layerPriority": 4,
    "display": {
      "name": "East China Sea",
      "abbreviation": "ECS",
      "priority": 4,
      "region": "North Pacific"
    }
  },
  "water_awc_sib": {
    "id": "water_awc_sib",
    "rulesGraphId": "water_awc_sib",
    "kind": "sea",
    "supplyCenterKind": null,
    "region": "North Pacific",
    "geometry": {
      "type": "sea-lane",
      "endpoints": [
        "sib",
        "awc"
      ],
      "lanePath": {
        "bend": -70,
        "wrap": true
      }
    },
    "label": {
      "anchor": null,
      "variants": {
        "full": "Bering Sea",
        "short": "BER"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "radius": 28
    },
    "layerPriority": 2,
    "display": {
      "name": "Bering Sea",
      "abbreviation": "BER",
      "priority": 2,
      "region": "North Pacific",
      "lanePath": {
        "bend": -70,
        "wrap": true
      }
    }
  },
  "water_jak_sib": {
    "id": "water_jak_sib",
    "rulesGraphId": "water_jak_sib",
    "kind": "sea",
    "supplyCenterKind": null,
    "region": "North Pacific",
    "geometry": {
      "type": "sea-lane",
      "endpoints": [
        "sib",
        "jak"
      ],
      "lanePath": null
    },
    "label": {
      "anchor": null,
      "variants": {
        "full": "North Pacific",
        "short": "NPO"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "radius": 28
    },
    "layerPriority": 3,
    "display": {
      "name": "North Pacific",
      "abbreviation": "NPO",
      "priority": 3,
      "region": "North Pacific"
    }
  },
  "water_mal_png": {
    "id": "water_mal_png",
    "rulesGraphId": "water_mal_png",
    "kind": "sea",
    "supplyCenterKind": null,
    "region": "Indo-Pacific",
    "geometry": {
      "type": "sea-lane",
      "endpoints": [
        "mal",
        "png"
      ],
      "lanePath": null
    },
    "label": {
      "anchor": null,
      "variants": {
        "full": "Banda Sea",
        "short": "BAN"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "radius": 28
    },
    "layerPriority": 3,
    "display": {
      "name": "Banda Sea",
      "abbreviation": "BAN",
      "priority": 3,
      "region": "Indo-Pacific"
    }
  },
  "water_aus_png": {
    "id": "water_aus_png",
    "rulesGraphId": "water_aus_png",
    "kind": "sea",
    "supplyCenterKind": null,
    "region": "South Pacific",
    "geometry": {
      "type": "sea-lane",
      "endpoints": [
        "png",
        "aus"
      ],
      "lanePath": null
    },
    "label": {
      "anchor": null,
      "variants": {
        "full": "Coral Sea",
        "short": "COR"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "radius": 28
    },
    "layerPriority": 3,
    "display": {
      "name": "Coral Sea",
      "abbreviation": "COR",
      "priority": 3,
      "region": "South Pacific"
    }
  },
  "water_aus_mal": {
    "id": "water_aus_mal",
    "rulesGraphId": "water_aus_mal",
    "kind": "sea",
    "supplyCenterKind": null,
    "region": "Indo-Pacific",
    "geometry": {
      "type": "sea-lane",
      "endpoints": [
        "mal",
        "aus"
      ],
      "lanePath": null
    },
    "label": {
      "anchor": null,
      "variants": {
        "full": "Timor Sea",
        "short": "TIM"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "radius": 28
    },
    "layerPriority": 4,
    "display": {
      "name": "Timor Sea",
      "abbreviation": "TIM",
      "priority": 4,
      "region": "Indo-Pacific"
    }
  },
  "water_aus_cap": {
    "id": "water_aus_cap",
    "rulesGraphId": "water_aus_cap",
    "kind": "sea",
    "supplyCenterKind": null,
    "region": "Indian Ocean",
    "geometry": {
      "type": "sea-lane",
      "endpoints": [
        "cap",
        "aus"
      ],
      "lanePath": null
    },
    "label": {
      "anchor": null,
      "variants": {
        "full": "Indian Ocean",
        "short": "INDO"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "radius": 28
    },
    "layerPriority": 5,
    "display": {
      "name": "Indian Ocean",
      "abbreviation": "INDO",
      "priority": 5,
      "region": "Indian Ocean"
    }
  },
  "water_ind_mal": {
    "id": "water_ind_mal",
    "rulesGraphId": "water_ind_mal",
    "kind": "sea",
    "supplyCenterKind": null,
    "region": "Indian Ocean",
    "geometry": {
      "type": "sea-lane",
      "endpoints": [
        "mal",
        "ind"
      ],
      "lanePath": null
    },
    "label": {
      "anchor": null,
      "variants": {
        "full": "Andaman Sea",
        "short": "AND"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "radius": 28
    },
    "layerPriority": 4,
    "display": {
      "name": "Andaman Sea",
      "abbreviation": "AND",
      "priority": 4,
      "region": "Indian Ocean"
    }
  },
  "water_mal_sea": {
    "id": "water_mal_sea",
    "rulesGraphId": "water_mal_sea",
    "kind": "sea",
    "supplyCenterKind": null,
    "region": "Indo-Pacific",
    "geometry": {
      "type": "sea-lane",
      "endpoints": [
        "mal",
        "sea"
      ],
      "lanePath": null
    },
    "label": {
      "anchor": null,
      "variants": {
        "full": "Malacca Strait",
        "short": "MAL"
      }
    },
    "hitGeometry": {
      "type": "circle",
      "radius": 28
    },
    "layerPriority": 5,
    "display": {
      "name": "Malacca Strait",
      "abbreviation": "MAL",
      "priority": 5,
      "region": "Indo-Pacific"
    }
  }
};

export const BOARD_VISUAL_PROVINCES = { ...BOARD_PROVINCE_METADATA, ...BOARD_SEA_PROVINCE_METADATA };
