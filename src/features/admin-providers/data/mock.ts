import { vi, formatMessage } from "../../../lib/locale";
import type { AdminCollectionDefinition, AdminRecord } from "../../admin-workspace/types";

// Read-only Figma fixtures. Local IDs and view models are not an API contract.
export const records: readonly AdminRecord[] = [
  {
    "id": "provider-1",
    "title": formatMessage(vi.admin.providers.recordTitle, { facilityName: "Mộc Pet Care" }),
    "cells": [
      "Mộc Pet Care",
      "Tuấn Anh",
      "29/09/2026",
      "Grooming",
      vi.admin.labels.pendingApproval
    ],
    "status": {
      "label": vi.admin.labels.pendingApproval,
      "tone": "warning"
    },
    "tags": [
      "pending"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.facility,
        "value": "Mộc Pet Care"
      },
      {
        "label": vi.admin.labels.owner,
        "value": "Tuấn Anh"
      },
      {
        "label": vi.admin.labels.submittedDate,
        "value": "29/09/2026"
      },
      {
        "label": vi.admin.labels.service,
        "value": "Grooming"
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.pendingApproval
      },
      {
        "label": vi.admin.labels.address,
        "value": "Quận 3, TP. Hồ Chí Minh"
      },
      {
        "label": vi.admin.labels.contact,
        "value": "mocpet@example.com · 0900 000 003"
      },
      {
        "label": vi.admin.labels.openingHours,
        "value": "09:00–18:00"
      }
    ],
    "pendingActions": [
      vi.admin.actions.approve,
      vi.admin.actions.reject
    ]
  },
  {
    "id": "provider-2",
    "title": formatMessage(vi.admin.providers.recordTitle, { facilityName: "PawNest Spa" }),
    "cells": [
      "PawNest Spa",
      "Trần Minh",
      "28/09/2026",
      "Trông giữ",
      vi.admin.labels.pendingApproval
    ],
    "status": {
      "label": vi.admin.labels.pendingApproval,
      "tone": "warning"
    },
    "tags": [
      "pending"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.facility,
        "value": "PawNest Spa"
      },
      {
        "label": vi.admin.labels.owner,
        "value": "Trần Minh"
      },
      {
        "label": vi.admin.labels.submittedDate,
        "value": "28/09/2026"
      },
      {
        "label": vi.admin.labels.service,
        "value": "Trông giữ"
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.pendingApproval
      }
    ],
    "pendingActions": [
      vi.admin.actions.approve,
      vi.admin.actions.reject
    ]
  },
  {
    "id": "provider-3",
    "title": formatMessage(vi.admin.providers.recordTitle, { facilityName: "Miu & Me" }),
    "cells": [
      "Miu & Me",
      "Ngọc Hà",
      "27/09/2026",
      "Spa thú cưng",
      vi.admin.labels.pendingApproval
    ],
    "status": {
      "label": vi.admin.labels.pendingApproval,
      "tone": "warning"
    },
    "tags": [
      "pending"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.facility,
        "value": "Miu & Me"
      },
      {
        "label": vi.admin.labels.owner,
        "value": "Ngọc Hà"
      },
      {
        "label": vi.admin.labels.submittedDate,
        "value": "27/09/2026"
      },
      {
        "label": vi.admin.labels.service,
        "value": "Spa thú cưng"
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.pendingApproval
      }
    ],
    "pendingActions": [
      vi.admin.actions.approve,
      vi.admin.actions.reject
    ]
  },
  {
    "id": "provider-4",
    "title": formatMessage(vi.admin.providers.recordTitle, { facilityName: "Tiny Paws Care" }),
    "cells": [
      "Tiny Paws Care",
      "Phương Lan",
      "26/09/2026",
      "Chăm sóc",
      vi.admin.labels.pendingApproval
    ],
    "status": {
      "label": vi.admin.labels.pendingApproval,
      "tone": "warning"
    },
    "tags": [
      "pending"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.facility,
        "value": "Tiny Paws Care"
      },
      {
        "label": vi.admin.labels.owner,
        "value": "Phương Lan"
      },
      {
        "label": vi.admin.labels.submittedDate,
        "value": "26/09/2026"
      },
      {
        "label": vi.admin.labels.service,
        "value": "Chăm sóc"
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.pendingApproval
      }
    ],
    "pendingActions": [
      vi.admin.actions.approve,
      vi.admin.actions.reject
    ]
  },
  {
    "id": "provider-5",
    "title": formatMessage(vi.admin.providers.recordTitle, { facilityName: "PawCare Studio" }),
    "cells": [
      "PawCare Studio",
      "Dane Nguyen",
      "20/09/2026",
      "Grooming",
      vi.admin.labels.approved
    ],
    "status": {
      "label": vi.admin.labels.approved,
      "tone": "success"
    },
    "tags": [
      "approved"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.facility,
        "value": "PawCare Studio"
      },
      {
        "label": vi.admin.labels.owner,
        "value": "Dane Nguyen"
      },
      {
        "label": vi.admin.labels.submittedDate,
        "value": "20/09/2026"
      },
      {
        "label": vi.admin.labels.service,
        "value": "Grooming"
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.approved
      }
    ],
    "pendingActions": []
  },
  {
    "id": "provider-6",
    "title": formatMessage(vi.admin.providers.recordTitle, { facilityName: "Cozy Pet" }),
    "cells": [
      "Cozy Pet",
      "Quốc Bảo",
      "18/09/2026",
      "Trông giữ",
      vi.admin.labels.rejected
    ],
    "status": {
      "label": vi.admin.labels.rejected,
      "tone": "danger"
    },
    "tags": [
      "rejected"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.facility,
        "value": "Cozy Pet"
      },
      {
        "label": vi.admin.labels.owner,
        "value": "Quốc Bảo"
      },
      {
        "label": vi.admin.labels.submittedDate,
        "value": "18/09/2026"
      },
      {
        "label": vi.admin.labels.service,
        "value": "Trông giữ"
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.rejected
      }
    ],
    "pendingActions": []
  }
];

export const definition: AdminCollectionDefinition = {
  "title": vi.admin.providers.title,
  "description": vi.admin.providers.description,
  "listTitle": vi.admin.providers.listTitle,
  "listDescription": vi.admin.providers.listDescription,
  "headers": [
    vi.admin.labels.facility,
    vi.admin.labels.owner,
    vi.admin.labels.submittedDate,
    vi.admin.labels.service,
    vi.admin.labels.status
  ],
  "filters": [
    {
      "value": "all",
      "label": vi.admin.labels.all
    },
    {
      "value": "pending",
      "label": vi.admin.labels.pendingApproval
    },
    {
      "value": "approved",
      "label": vi.admin.labels.approved
    },
    {
      "value": "rejected",
      "label": vi.admin.labels.rejected
    }
  ],
  "metricLabels": [
    vi.admin.labels.pendingApproval,
    vi.admin.labels.approved,
    vi.admin.labels.rejected
  ],
  "searchLabel": vi.admin.providers.searchLabel,
  "introAction": vi.admin.providers.introAction,
  "introNotes": [vi.admin.providers.approvalRule, vi.admin.providers.publicVisibilityRule]
};
