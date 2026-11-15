import { vi, formatMessage } from "../../../lib/locale";
import type { AdminCollectionDefinition, AdminRecord } from "../../admin-workspace/types";

// Read-only Figma fixtures. Local IDs and view models are not an API contract.
export const records: readonly AdminRecord[] = [
  {
    "id": "user-1",
    "title": formatMessage(vi.admin.users.recordTitle, { userName: "Hà Linh" }),
    "cells": [
      "Hà Linh",
      "halinh@example.com",
      vi.admin.labels.customer,
      "20/09/2026",
      vi.admin.labels.active
    ],
    "status": {
      "label": vi.admin.labels.active,
      "tone": "success"
    },
    "tags": [
      "customer"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.fullName,
        "value": "Hà Linh"
      },
      {
        "label": "Email",
        "value": "halinh@example.com"
      },
      {
        "label": vi.admin.labels.role,
        "value": vi.admin.labels.customer
      },
      {
        "label": vi.admin.labels.createdDate,
        "value": "20/09/2026"
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.active
      }
    ],
    "pendingActions": [
      vi.admin.actions.suspend
    ]
  },
  {
    "id": "user-2",
    "title": formatMessage(vi.admin.users.recordTitle, { userName: "Dane Nguyen" }),
    "cells": [
      "Dane Nguyen",
      "dane@example.com",
      vi.admin.labels.providerOwner,
      "18/09/2026",
      vi.admin.labels.active
    ],
    "status": {
      "label": vi.admin.labels.active,
      "tone": "success"
    },
    "tags": [
      "owner"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.fullName,
        "value": "Dane Nguyen"
      },
      {
        "label": "Email",
        "value": "dane@example.com"
      },
      {
        "label": vi.admin.labels.role,
        "value": vi.admin.labels.providerOwner
      },
      {
        "label": vi.admin.labels.createdDate,
        "value": "18/09/2026"
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.active
      },
      {
        "label": vi.admin.labels.linkedFacility,
        "value": "PawCare Studio"
      }
    ],
    "pendingActions": [
      vi.admin.actions.suspend
    ]
  },
  {
    "id": "user-3",
    "title": formatMessage(vi.admin.users.recordTitle, { userName: "Quang Minh" }),
    "cells": [
      "Quang Minh",
      "quang@example.com",
      vi.admin.labels.customer,
      "17/09/2026",
      vi.admin.labels.active
    ],
    "status": {
      "label": vi.admin.labels.active,
      "tone": "success"
    },
    "tags": [
      "customer"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.fullName,
        "value": "Quang Minh"
      },
      {
        "label": "Email",
        "value": "quang@example.com"
      },
      {
        "label": vi.admin.labels.role,
        "value": vi.admin.labels.customer
      },
      {
        "label": vi.admin.labels.createdDate,
        "value": "17/09/2026"
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.active
      }
    ],
    "pendingActions": [
      vi.admin.actions.suspend
    ]
  },
  {
    "id": "user-4",
    "title": formatMessage(vi.admin.users.recordTitle, { userName: "Ngọc Mai" }),
    "cells": [
      "Ngọc Mai",
      "ngocmai@example.com",
      vi.admin.labels.staff,
      "16/09/2026",
      vi.admin.labels.active
    ],
    "status": {
      "label": vi.admin.labels.active,
      "tone": "success"
    },
    "tags": [
      "staff"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.fullName,
        "value": "Ngọc Mai"
      },
      {
        "label": "Email",
        "value": "ngocmai@example.com"
      },
      {
        "label": vi.admin.labels.role,
        "value": vi.admin.labels.staff
      },
      {
        "label": vi.admin.labels.createdDate,
        "value": "16/09/2026"
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.active
      },
      {
        "label": vi.admin.labels.staffPermissions,
        "value": vi.admin.users.pendingStaffPermissions
      }
    ],
    "pendingActions": [
      vi.admin.actions.suspend
    ]
  },
  {
    "id": "user-5",
    "title": formatMessage(vi.admin.users.recordTitle, { userName: "Ngọc Anh" }),
    "cells": [
      "Ngọc Anh",
      "ngoc@example.com",
      vi.admin.labels.customer,
      "12/09/2026",
      vi.admin.labels.suspended
    ],
    "status": {
      "label": vi.admin.labels.suspended,
      "tone": "danger"
    },
    "tags": [
      "customer"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.fullName,
        "value": "Ngọc Anh"
      },
      {
        "label": "Email",
        "value": "ngoc@example.com"
      },
      {
        "label": vi.admin.labels.role,
        "value": vi.admin.labels.customer
      },
      {
        "label": vi.admin.labels.createdDate,
        "value": "12/09/2026"
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.suspended
      }
    ],
    "pendingActions": [
      vi.admin.actions.reactivate
    ]
  },
  {
    "id": "user-6",
    "title": formatMessage(vi.admin.users.recordTitle, { userName: "Lan Phương" }),
    "cells": [
      "Lan Phương",
      "lan@example.com",
      vi.admin.labels.providerOwner,
      "10/09/2026",
      vi.admin.labels.active
    ],
    "status": {
      "label": vi.admin.labels.active,
      "tone": "success"
    },
    "tags": [
      "owner"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.fullName,
        "value": "Lan Phương"
      },
      {
        "label": "Email",
        "value": "lan@example.com"
      },
      {
        "label": vi.admin.labels.role,
        "value": vi.admin.labels.providerOwner
      },
      {
        "label": vi.admin.labels.createdDate,
        "value": "10/09/2026"
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.active
      }
    ],
    "pendingActions": [
      vi.admin.actions.suspend
    ]
  }
];

export const definition: AdminCollectionDefinition = {
  "title": vi.admin.users.title,
  "description": vi.admin.users.description,
  "listTitle": vi.admin.users.listTitle,
  "listDescription": vi.admin.users.listDescription,
  "headers": [
    vi.admin.labels.fullName,
    "Email",
    vi.admin.labels.role,
    vi.admin.labels.createdDate,
    vi.admin.labels.status
  ],
  "filters": [
    {
      "value": "all",
      "label": vi.admin.labels.all
    },
    {
      "value": "customer",
      "label": vi.admin.labels.customer
    },
    {
      "value": "owner",
      "label": vi.admin.labels.providerOwner
    },
    {
      "value": "staff",
      "label": vi.admin.labels.staff
    }
  ],
  "metricLabels": [
    vi.admin.labels.activeAccounts,
    vi.admin.labels.customer,
    vi.admin.labels.ownersAndStaff
  ],
  "searchLabel": vi.admin.users.searchLabel,
  "introAction": vi.admin.users.introAction,
  "introNotes": [vi.admin.users.accessRule, vi.admin.users.staffScopeRule]
};
