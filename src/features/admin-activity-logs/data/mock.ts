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
      "label": "Thành công",
      "tone": "success"
    },
    "tags": [
      "admin",
      "status"
    ],
    "description": "Nhật ký mẫu chỉ đọc. Không có thao tác sửa hoặc xóa.",
    "details": [
      {
        "label": "Thời gian",
        "value": "29/09 · 15:42"
      },
      {
        "label": "Tác nhân",
        "value": "Admin Huy"
      },
      {
        "label": "Hành động",
        "value": "Duyệt cơ sở"
      },
      {
        "label": "Đối tượng",
        "value": "PR-048"
      },
      {
        "label": "Kết quả",
        "value": "Thành công"
      },
      {
        "label": "Trạng thái trước",
        "value": "Chờ duyệt"
      },
      {
        "label": "Trạng thái sau",
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
      "label": "Thành công",
      "tone": "success"
    },
    "tags": [
      "admin",
      "status"
    ],
    "description": "Nhật ký mẫu chỉ đọc. Không có thao tác sửa hoặc xóa.",
    "details": [
      {
        "label": "Thời gian",
        "value": "29/09 · 14:16"
      },
      {
        "label": "Tác nhân",
        "value": "Admin Huy"
      },
      {
        "label": "Hành động",
        "value": "Ẩn đánh giá"
      },
      {
        "label": "Đối tượng",
        "value": "RV-105"
      },
      {
        "label": "Kết quả",
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
      "label": "Thành công",
      "tone": "success"
    },
    "tags": [
      "admin"
    ],
    "description": "Nhật ký mẫu chỉ đọc. Không có thao tác sửa hoặc xóa.",
    "details": [
      {
        "label": "Thời gian",
        "value": "29/09 · 11:04"
      },
      {
        "label": "Tác nhân",
        "value": "Admin Mai"
      },
      {
        "label": "Hành động",
        "value": "Ghi chú khiếu nại"
      },
      {
        "label": "Đối tượng",
        "value": "KN-013"
      },
      {
        "label": "Kết quả",
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
      "label": "Thành công",
      "tone": "success"
    },
    "tags": [
      "provider",
      "status"
    ],
    "description": "Nhật ký mẫu chỉ đọc. Không có thao tác sửa hoặc xóa.",
    "details": [
      {
        "label": "Thời gian",
        "value": "28/09 · 17:20"
      },
      {
        "label": "Tác nhân",
        "value": "Dane Nguyen"
      },
      {
        "label": "Hành động",
        "value": "Xác nhận lịch"
      },
      {
        "label": "Đối tượng",
        "value": "PF-2083"
      },
      {
        "label": "Kết quả",
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
      "label": "Thành công",
      "tone": "success"
    },
    "tags": [
      "admin",
      "status"
    ],
    "description": "Nhật ký mẫu chỉ đọc. Không có thao tác sửa hoặc xóa.",
    "details": [
      {
        "label": "Thời gian",
        "value": "28/09 · 09:31"
      },
      {
        "label": "Tác nhân",
        "value": "Admin Mai"
      },
      {
        "label": "Hành động",
        "value": "Từ chối cơ sở"
      },
      {
        "label": "Đối tượng",
        "value": "PR-046"
      },
      {
        "label": "Kết quả",
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
      "label": "Bị chặn",
      "tone": "danger"
    },
    "tags": [],
    "description": "Nhật ký mẫu chỉ đọc. Không có thao tác sửa hoặc xóa.",
    "details": [
      {
        "label": "Thời gian",
        "value": "27/09 · 18:05"
      },
      {
        "label": "Tác nhân",
        "value": "Không xác định"
      },
      {
        "label": "Hành động",
        "value": "Truy cập trái quyền"
      },
      {
        "label": "Đối tượng",
        "value": "PR-048"
      },
      {
        "label": "Kết quả",
        "value": "Bị chặn"
      }
    ],
    "date": "2026-09-27"
  }
];

export const definition: AdminCollectionDefinition = {
  "title": "Nhật ký hoạt động",
  "description": "Truy vết thao tác quản trị và thay đổi trạng thái quan trọng",
  "listTitle": "Dòng sự kiện",
  "listDescription": "Nhật ký chỉ đọc: thời gian, tác nhân, hành động và kết quả",
  "headers": [
    "Thời gian",
    "Tác nhân",
    "Hành động",
    "Đối tượng",
    "Kết quả"
  ],
  "filters": [
    {
      "value": "all",
      "label": "Tất cả"
    },
    {
      "value": "admin",
      "label": "Admin"
    },
    {
      "value": "provider",
      "label": "Cơ sở"
    },
    {
      "value": "status",
      "label": "Trạng thái"
    }
  ],
  "metricLabels": [
    "Sự kiện trong kỳ",
    "Thao tác quản trị",
    "Thay đổi trạng thái"
  ],
  "searchLabel": "Tác nhân, đối tượng hoặc mã bản ghi",
  "dateFilter": true
};
