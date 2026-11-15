import { vi, formatMessage } from "../../../lib/locale";
import type { AdminCollectionDefinition, AdminRecord } from "../../admin-workspace/types";

// Read-only Figma fixtures. Local IDs and view models are not an API contract.
export const records: readonly AdminRecord[] = [
  {
    "id": "SV-01",
    "title": formatMessage(vi.admin.categories.recordTitle, { categoryName: "Grooming" }),
    "cells": [
      "Grooming",
      vi.admin.labels.serviceCategory,
      "SV-01",
      formatMessage(vi.admin.categories.serviceCount, { count: "42" }),
      vi.admin.labels.visible
    ],
    "status": {
      "label": vi.admin.labels.visible,
      "tone": "success"
    },
    "tags": [
      "service"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.categoryName,
        "value": "Grooming"
      },
      {
        "label": vi.admin.labels.type,
        "value": vi.admin.labels.serviceCategory
      },
      {
        "label": vi.admin.labels.code,
        "value": "SV-01"
      },
      {
        "label": vi.admin.labels.linkedCount,
        "value": formatMessage(vi.admin.categories.serviceCount, { count: "42" })
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.visible
      }
    ],
    "pendingActions": [
      vi.admin.actions.edit,
      vi.admin.actions.hide
    ]
  },
  {
    "id": "SV-02",
    "title": formatMessage(vi.admin.categories.recordTitle, { categoryName: "Tắm & vệ sinh" }),
    "cells": [
      "Tắm & vệ sinh",
      vi.admin.labels.serviceCategory,
      "SV-02",
      formatMessage(vi.admin.categories.serviceCount, { count: "38" }),
      vi.admin.labels.visible
    ],
    "status": {
      "label": vi.admin.labels.visible,
      "tone": "success"
    },
    "tags": [
      "service"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.categoryName,
        "value": "Tắm & vệ sinh"
      },
      {
        "label": vi.admin.labels.type,
        "value": vi.admin.labels.serviceCategory
      },
      {
        "label": vi.admin.labels.code,
        "value": "SV-02"
      },
      {
        "label": vi.admin.labels.linkedCount,
        "value": formatMessage(vi.admin.categories.serviceCount, { count: "38" })
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.visible
      }
    ],
    "pendingActions": [
      vi.admin.actions.edit,
      vi.admin.actions.hide
    ]
  },
  {
    "id": "SV-03",
    "title": formatMessage(vi.admin.categories.recordTitle, { categoryName: "Trông giữ" }),
    "cells": [
      "Trông giữ",
      vi.admin.labels.serviceCategory,
      "SV-03",
      formatMessage(vi.admin.categories.serviceCount, { count: "24" }),
      vi.admin.labels.visible
    ],
    "status": {
      "label": vi.admin.labels.visible,
      "tone": "success"
    },
    "tags": [
      "service"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.categoryName,
        "value": "Trông giữ"
      },
      {
        "label": vi.admin.labels.type,
        "value": vi.admin.labels.serviceCategory
      },
      {
        "label": vi.admin.labels.code,
        "value": "SV-03"
      },
      {
        "label": vi.admin.labels.linkedCount,
        "value": formatMessage(vi.admin.categories.serviceCount, { count: "24" })
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.visible
      }
    ],
    "pendingActions": [
      vi.admin.actions.edit,
      vi.admin.actions.hide
    ]
  },
  {
    "id": "PET-02",
    "title": formatMessage(vi.admin.categories.recordTitle, { categoryName: "Mèo" }),
    "cells": [
      "Mèo",
      vi.admin.labels.petType,
      "PET-02",
      formatMessage(vi.admin.categories.profileCount, { count: "320" }),
      vi.admin.labels.visible
    ],
    "status": {
      "label": vi.admin.labels.visible,
      "tone": "success"
    },
    "tags": [
      "pet"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.categoryName,
        "value": "Mèo"
      },
      {
        "label": vi.admin.labels.type,
        "value": vi.admin.labels.petType
      },
      {
        "label": vi.admin.labels.code,
        "value": "PET-02"
      },
      {
        "label": vi.admin.labels.linkedCount,
        "value": formatMessage(vi.admin.categories.profileCount, { count: "320" })
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.visible
      }
    ],
    "pendingActions": [
      vi.admin.actions.edit,
      vi.admin.actions.hide
    ]
  },
  {
    "id": "PET-01",
    "title": formatMessage(vi.admin.categories.recordTitle, { categoryName: "Chó" }),
    "cells": [
      "Chó",
      vi.admin.labels.petType,
      "PET-01",
      formatMessage(vi.admin.categories.profileCount, { count: "612" }),
      vi.admin.labels.visible
    ],
    "status": {
      "label": vi.admin.labels.visible,
      "tone": "success"
    },
    "tags": [
      "pet"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.categoryName,
        "value": "Chó"
      },
      {
        "label": vi.admin.labels.type,
        "value": vi.admin.labels.petType
      },
      {
        "label": vi.admin.labels.code,
        "value": "PET-01"
      },
      {
        "label": vi.admin.labels.linkedCount,
        "value": formatMessage(vi.admin.categories.profileCount, { count: "612" })
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.visible
      }
    ],
    "pendingActions": [
      vi.admin.actions.edit,
      vi.admin.actions.hide
    ]
  },
  {
    "id": "PET-05",
    "title": formatMessage(vi.admin.categories.recordTitle, { categoryName: "Thú nhỏ" }),
    "cells": [
      "Thú nhỏ",
      vi.admin.labels.petType,
      "PET-05",
      formatMessage(vi.admin.categories.profileCount, { count: "16" }),
      vi.admin.labels.inactive
    ],
    "status": {
      "label": vi.admin.labels.inactive,
      "tone": "warning"
    },
    "tags": [
      "pet",
      "hidden"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.categoryName,
        "value": "Thú nhỏ"
      },
      {
        "label": vi.admin.labels.type,
        "value": vi.admin.labels.petType
      },
      {
        "label": vi.admin.labels.code,
        "value": "PET-05"
      },
      {
        "label": vi.admin.labels.linkedCount,
        "value": formatMessage(vi.admin.categories.profileCount, { count: "16" })
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.inactive
      }
    ],
    "pendingActions": [
      vi.admin.actions.edit,
      vi.admin.actions.showAgain
    ]
  }
];

export const definition: AdminCollectionDefinition = {
  "title": vi.admin.categories.title,
  "description": vi.admin.categories.description,
  "listTitle": vi.admin.categories.listTitle,
  "listDescription": vi.admin.categories.listDescription,
  "headers": [
    vi.admin.labels.categoryName,
    vi.admin.labels.type,
    vi.admin.labels.code,
    vi.admin.labels.linkedCount,
    vi.admin.labels.status
  ],
  "filters": [
    {
      "value": "all",
      "label": vi.admin.labels.all
    },
    {
      "value": "service",
      "label": vi.admin.labels.serviceCategory
    },
    {
      "value": "pet",
      "label": vi.admin.labels.petType
    },
    {
      "value": "hidden",
      "label": vi.admin.labels.inactive
    }
  ],
  "metricLabels": [
    vi.admin.labels.serviceCategory,
    vi.admin.labels.petType,
    vi.admin.labels.inUse
  ],
  "searchLabel": vi.admin.categories.searchLabel,
  "introAction": vi.admin.categories.introAction,
  "introActionPending": true
};
