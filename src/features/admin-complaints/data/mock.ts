import { vi, formatMessage } from "../../../lib/locale";
import type { AdminCollectionDefinition, AdminRecord } from "../../admin-workspace/types";

// Read-only Figma fixtures. Local IDs and view models are not an API contract.
export const records: readonly AdminRecord[] = [
  {
    "id": "KN-014",
    "title": formatMessage(vi.admin.complaints.recordTitle, { complaintId: "KN-014" }),
    "cells": [
      "KN-014",
      "Lan Phương",
      "PawCare Studio",
      "PF-2079",
      vi.admin.labels.new
    ],
    "status": {
      "label": vi.admin.labels.new,
      "tone": "info"
    },
    "tags": [
      "open"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.code,
        "value": "KN-014"
      },
      {
        "label": vi.admin.labels.sender,
        "value": "Lan Phương"
      },
      {
        "label": vi.admin.labels.facility,
        "value": "PawCare Studio"
      },
      {
        "label": vi.admin.labels.bookingId,
        "value": "PF-2079"
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.new
      },
      {
        "label": vi.admin.labels.pet,
        "value": "Bon"
      },
      {
        "label": vi.admin.labels.content,
        "value": "Chờ dịch vụ lâu hơn giờ đã hẹn."
      },
      {
        "label": vi.admin.labels.designNotes,
        "value": "Liên hệ hai bên để xác minh."
      }
    ],
    "pendingActions": [
      vi.admin.actions.receiveComplaint,
      vi.admin.actions.addNote
    ]
  },
  {
    "id": "KN-013",
    "title": formatMessage(vi.admin.complaints.recordTitle, { complaintId: "KN-013" }),
    "cells": [
      "KN-013",
      "Quang Minh",
      "Happy Paws",
      "PF-2068",
      vi.admin.labels.inProgress
    ],
    "status": {
      "label": vi.admin.labels.inProgress,
      "tone": "warning"
    },
    "tags": [
      "processing"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.code,
        "value": "KN-013"
      },
      {
        "label": vi.admin.labels.sender,
        "value": "Quang Minh"
      },
      {
        "label": vi.admin.labels.facility,
        "value": "Happy Paws"
      },
      {
        "label": vi.admin.labels.bookingId,
        "value": "PF-2068"
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.inProgress
      },
      {
        "label": vi.admin.labels.complaintConclusion,
        "value": vi.admin.collection.fixtureValueUnavailable
      }
    ],
    "pendingActions": [
      vi.admin.actions.addNote,
      vi.admin.actions.markResolved
    ]
  },
  {
    "id": "KN-012",
    "title": formatMessage(vi.admin.complaints.recordTitle, { complaintId: "KN-012" }),
    "cells": [
      "KN-012",
      "Ngọc Anh",
      "Little Tails",
      "PF-2047",
      vi.admin.labels.new
    ],
    "status": {
      "label": vi.admin.labels.new,
      "tone": "info"
    },
    "tags": [
      "open"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.code,
        "value": "KN-012"
      },
      {
        "label": vi.admin.labels.sender,
        "value": "Ngọc Anh"
      },
      {
        "label": vi.admin.labels.facility,
        "value": "Little Tails"
      },
      {
        "label": vi.admin.labels.bookingId,
        "value": "PF-2047"
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.new
      },
      {
        "label": vi.admin.labels.complaintConclusion,
        "value": vi.admin.collection.fixtureValueUnavailable
      }
    ],
    "pendingActions": [
      vi.admin.actions.receiveComplaint,
      vi.admin.actions.addNote
    ]
  },
  {
    "id": "KN-011",
    "title": formatMessage(vi.admin.complaints.recordTitle, { complaintId: "KN-011" }),
    "cells": [
      "KN-011",
      "Mai Anh",
      "PawCare Studio",
      "PF-2051",
      vi.admin.labels.resolved
    ],
    "status": {
      "label": vi.admin.labels.resolved,
      "tone": "success"
    },
    "tags": [
      "resolved"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.code,
        "value": "KN-011"
      },
      {
        "label": vi.admin.labels.sender,
        "value": "Mai Anh"
      },
      {
        "label": vi.admin.labels.facility,
        "value": "PawCare Studio"
      },
      {
        "label": vi.admin.labels.bookingId,
        "value": "PF-2051"
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.resolved
      },
      {
        "label": vi.admin.labels.complaintConclusion,
        "value": vi.admin.collection.fixtureValueUnavailable
      }
    ],
    "pendingActions": []
  },
  {
    "id": "KN-010",
    "title": formatMessage(vi.admin.complaints.recordTitle, { complaintId: "KN-010" }),
    "cells": [
      "KN-010",
      "Đức Huy",
      "Miu House",
      "PF-2040",
      vi.admin.labels.inProgress
    ],
    "status": {
      "label": vi.admin.labels.inProgress,
      "tone": "warning"
    },
    "tags": [
      "processing"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.code,
        "value": "KN-010"
      },
      {
        "label": vi.admin.labels.sender,
        "value": "Đức Huy"
      },
      {
        "label": vi.admin.labels.facility,
        "value": "Miu House"
      },
      {
        "label": vi.admin.labels.bookingId,
        "value": "PF-2040"
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.inProgress
      },
      {
        "label": vi.admin.labels.complaintConclusion,
        "value": vi.admin.collection.fixtureValueUnavailable
      }
    ],
    "pendingActions": [
      vi.admin.actions.addNote,
      vi.admin.actions.markResolved
    ]
  },
  {
    "id": "KN-009",
    "title": formatMessage(vi.admin.complaints.recordTitle, { complaintId: "KN-009" }),
    "cells": [
      "KN-009",
      "Lan Phương",
      "PetNest Care",
      "PF-2036",
      vi.admin.labels.resolved
    ],
    "status": {
      "label": vi.admin.labels.resolved,
      "tone": "success"
    },
    "tags": [
      "resolved"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.code,
        "value": "KN-009"
      },
      {
        "label": vi.admin.labels.sender,
        "value": "Lan Phương"
      },
      {
        "label": vi.admin.labels.facility,
        "value": "PetNest Care"
      },
      {
        "label": vi.admin.labels.bookingId,
        "value": "PF-2036"
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.resolved
      },
      {
        "label": vi.admin.labels.complaintConclusion,
        "value": vi.admin.collection.fixtureValueUnavailable
      }
    ],
    "pendingActions": []
  }
];

export const definition: AdminCollectionDefinition = {
  "title": vi.admin.complaints.title,
  "description": vi.admin.complaints.description,
  "listTitle": vi.admin.complaints.listTitle,
  "listDescription": vi.admin.complaints.listDescription,
  "headers": [
    vi.admin.labels.code,
    vi.admin.labels.sender,
    vi.admin.labels.facility,
    vi.admin.labels.bookingId,
    vi.admin.labels.status
  ],
  "filters": [
    {
      "value": "all",
      "label": vi.admin.labels.all
    },
    {
      "value": "open",
      "label": vi.admin.labels.new
    },
    {
      "value": "processing",
      "label": vi.admin.labels.inProgress
    },
    {
      "value": "resolved",
      "label": vi.admin.labels.resolved
    }
  ],
  "metricLabels": [
    vi.admin.labels.newlyReceived,
    vi.admin.labels.inProgress,
    vi.admin.labels.resolved
  ],
  "searchLabel": vi.admin.complaints.searchLabel,
  "introAction": vi.admin.complaints.introAction,
  "introNotes": [vi.admin.complaints.complaintScopeRule, vi.admin.complaints.pendingResolutionRule]
};
