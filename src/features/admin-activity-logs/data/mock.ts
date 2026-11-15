import { vi } from "../../../lib/locale";
import type { AdminCollectionDefinition, AdminRecord } from "../../admin-workspace/types";

// Read-only Figma fixtures. Local IDs and view models are not an API contract.
export const records: readonly AdminRecord[] = [
  {
    "id": "LOG-184",
    "title": "Sự kiện · LOG-184",
    "cells": [
      "29/09 · 15:42",
      "Admin Huy",
      "Duyệt cơ sở",
      "PR-048",
      "Thành công"
    ],
    "status": {
      "label": vi.admin.labels.success,
      "tone": "success"
    },
    "tags": [
      "admin",
      "status"
    ],
    "description": vi.admin.activityLogs.recordNotice,
    "details": [
      {
        "label": vi.admin.labels.time,
        "value": "29/09 · 15:42"
      },
      {
        "label": vi.admin.labels.actor,
        "value": "Admin Huy"
      },
      {
        "label": vi.admin.labels.action,
        "value": "Duyệt cơ sở"
      },
      {
        "label": vi.admin.labels.target,
        "value": "PR-048"
      },
      {
        "label": vi.admin.labels.outcome,
        "value": "Thành công"
      },
      {
        "label": vi.admin.labels.previousStatus,
        "value": "Chờ duyệt"
      },
      {
        "label": vi.admin.labels.nextStatus,
        "value": "Đã duyệt"
      }
    ],
    "date": "2026-09-29"
  },
  {
    "id": "log-sample-2",
    "title": "Sự kiện · log-sample-2",
    "cells": [
      "29/09 · 14:16",
      "Admin Huy",
      "Ẩn đánh giá",
      "RV-105",
      "Thành công"
    ],
    "status": {
      "label": vi.admin.labels.success,
      "tone": "success"
    },
    "tags": [
      "admin",
      "status"
    ],
    "description": vi.admin.activityLogs.recordNotice,
    "details": [
      {
        "label": vi.admin.labels.time,
        "value": "29/09 · 14:16"
      },
      {
        "label": vi.admin.labels.actor,
        "value": "Admin Huy"
      },
      {
        "label": vi.admin.labels.action,
        "value": "Ẩn đánh giá"
      },
      {
        "label": vi.admin.labels.target,
        "value": "RV-105"
      },
      {
        "label": vi.admin.labels.outcome,
        "value": "Thành công"
      }
    ],
    "date": "2026-09-29"
  },
  {
    "id": "log-sample-3",
    "title": "Sự kiện · log-sample-3",
    "cells": [
      "29/09 · 11:04",
      "Admin Mai",
      "Ghi chú khiếu nại",
      "KN-013",
      "Thành công"
    ],
    "status": {
      "label": vi.admin.labels.success,
      "tone": "success"
    },
    "tags": [
      "admin"
    ],
    "description": vi.admin.activityLogs.recordNotice,
    "details": [
      {
        "label": vi.admin.labels.time,
        "value": "29/09 · 11:04"
      },
      {
        "label": vi.admin.labels.actor,
        "value": "Admin Mai"
      },
      {
        "label": vi.admin.labels.action,
        "value": "Ghi chú khiếu nại"
      },
      {
        "label": vi.admin.labels.target,
        "value": "KN-013"
      },
      {
        "label": vi.admin.labels.outcome,
        "value": "Thành công"
      }
    ],
    "date": "2026-09-29"
  },
  {
    "id": "log-sample-4",
    "title": "Sự kiện · log-sample-4",
    "cells": [
      "28/09 · 17:20",
      "Dane Nguyen",
      "Xác nhận lịch",
      "PF-2083",
      "Thành công"
    ],
    "status": {
      "label": vi.admin.labels.success,
      "tone": "success"
    },
    "tags": [
      "provider",
      "status"
    ],
    "description": vi.admin.activityLogs.recordNotice,
    "details": [
      {
        "label": vi.admin.labels.time,
        "value": "28/09 · 17:20"
      },
      {
        "label": vi.admin.labels.actor,
        "value": "Dane Nguyen"
      },
      {
        "label": vi.admin.labels.action,
        "value": "Xác nhận lịch"
      },
      {
        "label": vi.admin.labels.target,
        "value": "PF-2083"
      },
      {
        "label": vi.admin.labels.outcome,
        "value": "Thành công"
      }
    ],
    "date": "2026-09-28"
  },
  {
    "id": "log-sample-5",
    "title": "Sự kiện · log-sample-5",
    "cells": [
      "28/09 · 09:31",
      "Admin Mai",
      "Từ chối cơ sở",
      "PR-046",
      "Thành công"
    ],
    "status": {
      "label": vi.admin.labels.success,
      "tone": "success"
    },
    "tags": [
      "admin",
      "status"
    ],
    "description": vi.admin.activityLogs.recordNotice,
    "details": [
      {
        "label": vi.admin.labels.time,
        "value": "28/09 · 09:31"
      },
      {
        "label": vi.admin.labels.actor,
        "value": "Admin Mai"
      },
      {
        "label": vi.admin.labels.action,
        "value": "Từ chối cơ sở"
      },
      {
        "label": vi.admin.labels.target,
        "value": "PR-046"
      },
      {
        "label": vi.admin.labels.outcome,
        "value": "Thành công"
      }
    ],
    "date": "2026-09-28"
  },
  {
    "id": "log-sample-6",
    "title": "Sự kiện · log-sample-6",
    "cells": [
      "27/09 · 18:05",
      "Không xác định",
      "Truy cập trái quyền",
      "PR-048",
      "Bị chặn"
    ],
    "status": {
      "label": vi.admin.labels.blocked,
      "tone": "danger"
    },
    "tags": [],
    "description": vi.admin.activityLogs.recordNotice,
    "details": [
      {
        "label": vi.admin.labels.time,
        "value": "27/09 · 18:05"
      },
      {
        "label": vi.admin.labels.actor,
        "value": "Không xác định"
      },
      {
        "label": vi.admin.labels.action,
        "value": "Truy cập trái quyền"
      },
      {
        "label": vi.admin.labels.target,
        "value": "PR-048"
      },
      {
        "label": vi.admin.labels.outcome,
        "value": "Bị chặn"
      }
    ],
    "date": "2026-09-27"
  }
];

export const definition: AdminCollectionDefinition = {
  "title": vi.admin.activityLogs.title,
  "description": vi.admin.activityLogs.description,
  "listTitle": vi.admin.activityLogs.listTitle,
  "listDescription": vi.admin.activityLogs.listDescription,
  "headers": [
    vi.admin.labels.time,
    vi.admin.labels.actor,
    vi.admin.labels.action,
    vi.admin.labels.target,
    vi.admin.labels.outcome
  ],
  "filters": [
    {
      "value": "all",
      "label": vi.admin.labels.all
    },
    {
      "value": "admin",
      "label": "Admin"
    },
    {
      "value": "provider",
      "label": vi.admin.labels.facility
    },
    {
      "value": "status",
      "label": vi.admin.labels.status
    }
  ],
  "metricLabels": [
    vi.admin.labels.eventsInPeriod,
    vi.admin.labels.administrativeActions,
    vi.admin.labels.statusChanges
  ],
  "searchLabel": vi.admin.activityLogs.searchLabel,
  "dateFilter": true
};
