import { vi, formatMessage } from "../../../lib/locale";
import type { AdminCollectionDefinition, AdminRecord } from "../../admin-workspace/types";

// Read-only Figma fixtures. Local IDs and view models are not an API contract.
export const records: readonly AdminRecord[] = [
  {
    "id": "review-PF-2075",
    "title": formatMessage(vi.admin.reviews.recordTitle, { bookingId: "PF-2075" }),
    "cells": [
      "Mai Anh",
      "PawCare Studio",
      "PF-2075",
      formatMessage(vi.admin.reviews.starCount, { count: "5" }),
      vi.admin.labels.reported
    ],
    "status": {
      "label": vi.admin.labels.reported,
      "tone": "warning"
    },
    "tags": [
      "reported"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.customer,
        "value": "Mai Anh"
      },
      {
        "label": vi.admin.labels.facility,
        "value": "PawCare Studio"
      },
      {
        "label": vi.admin.labels.bookingId,
        "value": "PF-2075"
      },
      {
        "label": vi.admin.labels.review,
        "value": formatMessage(vi.admin.reviews.starCount, { count: "5" })
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.reported
      },
      {
        "label": vi.admin.labels.pet,
        "value": "Lạc"
      },
      {
        "label": vi.admin.labels.bookingStatus,
        "value": vi.admin.labels.completed
      },
      {
        "label": vi.admin.labels.content,
        "value": "Lạc được chăm sóc kỹ."
      },
      {
        "label": vi.admin.labels.reportReason,
        "value": "Nghi ngờ sai đối tượng."
      }
    ],
    "pendingActions": [
      vi.admin.actions.keepVisible,
      vi.admin.actions.hideReview
    ]
  },
  {
    "id": "review-PF-2058",
    "title": formatMessage(vi.admin.reviews.recordTitle, { bookingId: "PF-2058" }),
    "cells": [
      "Quang Minh",
      "Happy Paws",
      "PF-2058",
      formatMessage(vi.admin.reviews.starCount, { count: "4" }),
      vi.admin.labels.reported
    ],
    "status": {
      "label": vi.admin.labels.reported,
      "tone": "warning"
    },
    "tags": [
      "reported"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.customer,
        "value": "Quang Minh"
      },
      {
        "label": vi.admin.labels.facility,
        "value": "Happy Paws"
      },
      {
        "label": vi.admin.labels.bookingId,
        "value": "PF-2058"
      },
      {
        "label": vi.admin.labels.review,
        "value": formatMessage(vi.admin.reviews.starCount, { count: "4" })
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.reported
      },
      {
        "label": vi.admin.labels.reviewReportDetails,
        "value": vi.admin.collection.fixtureValueUnavailable
      }
    ],
    "pendingActions": [
      vi.admin.actions.keepVisible,
      vi.admin.actions.hideReview
    ]
  },
  {
    "id": "review-PF-2051",
    "title": formatMessage(vi.admin.reviews.recordTitle, { bookingId: "PF-2051" }),
    "cells": [
      "Mai Anh",
      "PawCare Studio",
      "PF-2051",
      formatMessage(vi.admin.reviews.starCount, { count: "5" }),
      vi.admin.labels.visible
    ],
    "status": {
      "label": vi.admin.labels.visible,
      "tone": "success"
    },
    "tags": [
      "visible"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.customer,
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
        "label": vi.admin.labels.review,
        "value": formatMessage(vi.admin.reviews.starCount, { count: "5" })
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.visible
      },
      {
        "label": vi.admin.labels.reviewReportDetails,
        "value": vi.admin.collection.fixtureValueUnavailable
      }
    ],
    "pendingActions": [
      vi.admin.actions.keepVisible,
      vi.admin.actions.hideReview
    ]
  },
  {
    "id": "review-PF-2047",
    "title": formatMessage(vi.admin.reviews.recordTitle, { bookingId: "PF-2047" }),
    "cells": [
      "Ngọc Anh",
      "Little Tails",
      "PF-2047",
      formatMessage(vi.admin.reviews.starCount, { count: "2" }),
      vi.admin.labels.reported
    ],
    "status": {
      "label": vi.admin.labels.reported,
      "tone": "warning"
    },
    "tags": [
      "reported"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.customer,
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
        "label": vi.admin.labels.review,
        "value": formatMessage(vi.admin.reviews.starCount, { count: "2" })
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.reported
      },
      {
        "label": vi.admin.labels.reviewReportDetails,
        "value": vi.admin.collection.fixtureValueUnavailable
      }
    ],
    "pendingActions": [
      vi.admin.actions.keepVisible,
      vi.admin.actions.hideReview
    ]
  },
  {
    "id": "review-PF-2040",
    "title": formatMessage(vi.admin.reviews.recordTitle, { bookingId: "PF-2040" }),
    "cells": [
      "Đức Huy",
      "Miu House",
      "PF-2040",
      formatMessage(vi.admin.reviews.starCount, { count: "4" }),
      vi.admin.labels.hidden
    ],
    "status": {
      "label": vi.admin.labels.hidden,
      "tone": "danger"
    },
    "tags": [
      "hidden"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.customer,
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
        "label": vi.admin.labels.review,
        "value": formatMessage(vi.admin.reviews.starCount, { count: "4" })
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.hidden
      },
      {
        "label": vi.admin.labels.reviewReportDetails,
        "value": vi.admin.collection.fixtureValueUnavailable
      }
    ],
    "pendingActions": [
      vi.admin.actions.showAgain
    ]
  },
  {
    "id": "review-PF-2036",
    "title": formatMessage(vi.admin.reviews.recordTitle, { bookingId: "PF-2036" }),
    "cells": [
      "Lan Phương",
      "PetNest Care",
      "PF-2036",
      formatMessage(vi.admin.reviews.starCount, { count: "5" }),
      vi.admin.labels.visible
    ],
    "status": {
      "label": vi.admin.labels.visible,
      "tone": "success"
    },
    "tags": [
      "visible"
    ],
    "description": vi.admin.collection.fixtureDescription,
    "details": [
      {
        "label": vi.admin.labels.customer,
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
        "label": vi.admin.labels.review,
        "value": formatMessage(vi.admin.reviews.starCount, { count: "5" })
      },
      {
        "label": vi.admin.labels.status,
        "value": vi.admin.labels.visible
      },
      {
        "label": vi.admin.labels.reviewReportDetails,
        "value": vi.admin.collection.fixtureValueUnavailable
      }
    ],
    "pendingActions": [
      vi.admin.actions.keepVisible,
      vi.admin.actions.hideReview
    ]
  }
];

export const definition: AdminCollectionDefinition = {
  "title": vi.admin.reviews.title,
  "description": vi.admin.reviews.description,
  "listTitle": vi.admin.reviews.listTitle,
  "listDescription": vi.admin.reviews.listDescription,
  "headers": [
    vi.admin.labels.customer,
    vi.admin.labels.facility,
    vi.admin.labels.bookingId,
    vi.admin.labels.review,
    vi.admin.labels.status
  ],
  "filters": [
    {
      "value": "all",
      "label": vi.admin.labels.all
    },
    {
      "value": "reported",
      "label": vi.admin.labels.reported
    },
    {
      "value": "visible",
      "label": vi.admin.labels.visible
    },
    {
      "value": "hidden",
      "label": vi.admin.labels.hidden
    }
  ],
  "metricLabels": [
    vi.admin.labels.reported,
    vi.admin.labels.currentlyVisible,
    vi.admin.labels.hidden
  ],
  "searchLabel": vi.admin.reviews.searchLabel,
  "introAction": vi.admin.reviews.introAction,
  "introNotes": [vi.admin.reviews.reviewEligibilityRule, vi.admin.reviews.moderationRule]
};
