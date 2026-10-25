import type { AdminCollectionDefinition, AdminRecord } from "../../admin-workspace/types";

// Read-only Figma fixtures. Local IDs and view models are not an API contract.
export const records: readonly AdminRecord[] = [
  {
    "id": "SV-01",
    "title": "Danh mục · Grooming",
    "cells": [
      "Grooming",
      "Nhóm dịch vụ",
      "SV-01",
      "42 dịch vụ",
      "Hiển thị"
    ],
    "status": {
      "label": "Hiển thị",
      "tone": "success"
    },
    "tags": [
      "service"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Tên danh mục",
        "value": "Grooming"
      },
      {
        "label": "Loại",
        "value": "Nhóm dịch vụ"
      },
      {
        "label": "Mã",
        "value": "SV-01"
      },
      {
        "label": "Số liên kết",
        "value": "42 dịch vụ"
      },
      {
        "label": "Trạng thái",
        "value": "Hiển thị"
      }
    ],
    "pendingActions": [
      "Chỉnh sửa",
      "Tạm ẩn"
    ]
  },
  {
    "id": "SV-02",
    "title": "Danh mục · Tắm & vệ sinh",
    "cells": [
      "Tắm & vệ sinh",
      "Nhóm dịch vụ",
      "SV-02",
      "38 dịch vụ",
      "Hiển thị"
    ],
    "status": {
      "label": "Hiển thị",
      "tone": "success"
    },
    "tags": [
      "service"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Tên danh mục",
        "value": "Tắm & vệ sinh"
      },
      {
        "label": "Loại",
        "value": "Nhóm dịch vụ"
      },
      {
        "label": "Mã",
        "value": "SV-02"
      },
      {
        "label": "Số liên kết",
        "value": "38 dịch vụ"
      },
      {
        "label": "Trạng thái",
        "value": "Hiển thị"
      }
    ],
    "pendingActions": [
      "Chỉnh sửa",
      "Tạm ẩn"
    ]
  },
  {
    "id": "SV-03",
    "title": "Danh mục · Trông giữ",
    "cells": [
      "Trông giữ",
      "Nhóm dịch vụ",
      "SV-03",
      "24 dịch vụ",
      "Hiển thị"
    ],
    "status": {
      "label": "Hiển thị",
      "tone": "success"
    },
    "tags": [
      "service"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Tên danh mục",
        "value": "Trông giữ"
      },
      {
        "label": "Loại",
        "value": "Nhóm dịch vụ"
      },
      {
        "label": "Mã",
        "value": "SV-03"
      },
      {
        "label": "Số liên kết",
        "value": "24 dịch vụ"
      },
      {
        "label": "Trạng thái",
        "value": "Hiển thị"
      }
    ],
    "pendingActions": [
      "Chỉnh sửa",
      "Tạm ẩn"
    ]
  },
  {
    "id": "PET-02",
    "title": "Danh mục · Mèo",
    "cells": [
      "Mèo",
      "Loại thú cưng",
      "PET-02",
      "320 hồ sơ",
      "Hiển thị"
    ],
    "status": {
      "label": "Hiển thị",
      "tone": "success"
    },
    "tags": [
      "pet"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Tên danh mục",
        "value": "Mèo"
      },
      {
        "label": "Loại",
        "value": "Loại thú cưng"
      },
      {
        "label": "Mã",
        "value": "PET-02"
      },
      {
        "label": "Số liên kết",
        "value": "320 hồ sơ"
      },
      {
        "label": "Trạng thái",
        "value": "Hiển thị"
      }
    ],
    "pendingActions": [
      "Chỉnh sửa",
      "Tạm ẩn"
    ]
  },
  {
    "id": "PET-01",
    "title": "Danh mục · Chó",
    "cells": [
      "Chó",
      "Loại thú cưng",
      "PET-01",
      "612 hồ sơ",
      "Hiển thị"
    ],
    "status": {
      "label": "Hiển thị",
      "tone": "success"
    },
    "tags": [
      "pet"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Tên danh mục",
        "value": "Chó"
      },
      {
        "label": "Loại",
        "value": "Loại thú cưng"
      },
      {
        "label": "Mã",
        "value": "PET-01"
      },
      {
        "label": "Số liên kết",
        "value": "612 hồ sơ"
      },
      {
        "label": "Trạng thái",
        "value": "Hiển thị"
      }
    ],
    "pendingActions": [
      "Chỉnh sửa",
      "Tạm ẩn"
    ]
  },
  {
    "id": "PET-05",
    "title": "Danh mục · Thú nhỏ",
    "cells": [
      "Thú nhỏ",
      "Loại thú cưng",
      "PET-05",
      "16 hồ sơ",
      "Tạm ẩn"
    ],
    "status": {
      "label": "Tạm ẩn",
      "tone": "warning"
    },
    "tags": [
      "pet",
      "hidden"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Tên danh mục",
        "value": "Thú nhỏ"
      },
      {
        "label": "Loại",
        "value": "Loại thú cưng"
      },
      {
        "label": "Mã",
        "value": "PET-05"
      },
      {
        "label": "Số liên kết",
        "value": "16 hồ sơ"
      },
      {
        "label": "Trạng thái",
        "value": "Tạm ẩn"
      }
    ],
    "pendingActions": [
      "Chỉnh sửa",
      "Hiển thị lại"
    ]
  }
];

export const definition: AdminCollectionDefinition = {
  "title": "Danh mục chung",
  "description": "Quản lý loại dịch vụ và loại thú cưng dùng chung",
  "listTitle": "Danh mục nền tảng",
  "listDescription": "Danh mục chung được tham chiếu khi cơ sở tạo dịch vụ",
  "headers": [
    "Tên danh mục",
    "Loại",
    "Mã",
    "Số liên kết",
    "Trạng thái"
  ],
  "filters": [
    {
      "value": "all",
      "label": "Tất cả"
    },
    {
      "value": "service",
      "label": "Nhóm dịch vụ"
    },
    {
      "value": "pet",
      "label": "Loại thú cưng"
    },
    {
      "value": "hidden",
      "label": "Tạm ẩn"
    }
  ],
  "metricLabels": [
    "Nhóm dịch vụ",
    "Loại thú cưng",
    "Đang sử dụng"
  ],
  "searchLabel": "Tên hoặc mã danh mục",
  "introAction": "Thêm danh mục",
  "introActionPending": true
};
