import type { AdminCollectionDefinition, AdminRecord } from "../../admin-workspace/types";

// Read-only Figma fixtures. Local IDs and view models are not an API contract.
export const records: readonly AdminRecord[] = [
  {
    "id": "provider-1",
    "title": "Hồ sơ · Mộc Pet Care",
    "cells": [
      "Mộc Pet Care",
      "Tuấn Anh",
      "29/09/2026",
      "Grooming",
      "Chờ duyệt"
    ],
    "status": {
      "label": "Chờ duyệt",
      "tone": "warning"
    },
    "tags": [
      "pending"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Cơ sở",
        "value": "Mộc Pet Care"
      },
      {
        "label": "Chủ sở hữu",
        "value": "Tuấn Anh"
      },
      {
        "label": "Ngày gửi",
        "value": "29/09/2026"
      },
      {
        "label": "Dịch vụ",
        "value": "Grooming"
      },
      {
        "label": "Trạng thái",
        "value": "Chờ duyệt"
      },
      {
        "label": "Địa chỉ",
        "value": "Quận 3, TP. Hồ Chí Minh"
      },
      {
        "label": "Liên hệ",
        "value": "mocpet@example.com · 0900 000 003"
      },
      {
        "label": "Giờ mở cửa",
        "value": "09:00–18:00"
      }
    ],
    "pendingActions": [
      "Phê duyệt",
      "Từ chối"
    ]
  },
  {
    "id": "provider-2",
    "title": "Hồ sơ · PawNest Spa",
    "cells": [
      "PawNest Spa",
      "Trần Minh",
      "28/09/2026",
      "Trông giữ",
      "Chờ duyệt"
    ],
    "status": {
      "label": "Chờ duyệt",
      "tone": "warning"
    },
    "tags": [
      "pending"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Cơ sở",
        "value": "PawNest Spa"
      },
      {
        "label": "Chủ sở hữu",
        "value": "Trần Minh"
      },
      {
        "label": "Ngày gửi",
        "value": "28/09/2026"
      },
      {
        "label": "Dịch vụ",
        "value": "Trông giữ"
      },
      {
        "label": "Trạng thái",
        "value": "Chờ duyệt"
      }
    ],
    "pendingActions": [
      "Phê duyệt",
      "Từ chối"
    ]
  },
  {
    "id": "provider-3",
    "title": "Hồ sơ · Miu & Me",
    "cells": [
      "Miu & Me",
      "Ngọc Hà",
      "27/09/2026",
      "Spa thú cưng",
      "Chờ duyệt"
    ],
    "status": {
      "label": "Chờ duyệt",
      "tone": "warning"
    },
    "tags": [
      "pending"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Cơ sở",
        "value": "Miu & Me"
      },
      {
        "label": "Chủ sở hữu",
        "value": "Ngọc Hà"
      },
      {
        "label": "Ngày gửi",
        "value": "27/09/2026"
      },
      {
        "label": "Dịch vụ",
        "value": "Spa thú cưng"
      },
      {
        "label": "Trạng thái",
        "value": "Chờ duyệt"
      }
    ],
    "pendingActions": [
      "Phê duyệt",
      "Từ chối"
    ]
  },
  {
    "id": "provider-4",
    "title": "Hồ sơ · Tiny Paws Care",
    "cells": [
      "Tiny Paws Care",
      "Phương Lan",
      "26/09/2026",
      "Chăm sóc",
      "Chờ duyệt"
    ],
    "status": {
      "label": "Chờ duyệt",
      "tone": "warning"
    },
    "tags": [
      "pending"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Cơ sở",
        "value": "Tiny Paws Care"
      },
      {
        "label": "Chủ sở hữu",
        "value": "Phương Lan"
      },
      {
        "label": "Ngày gửi",
        "value": "26/09/2026"
      },
      {
        "label": "Dịch vụ",
        "value": "Chăm sóc"
      },
      {
        "label": "Trạng thái",
        "value": "Chờ duyệt"
      }
    ],
    "pendingActions": [
      "Phê duyệt",
      "Từ chối"
    ]
  },
  {
    "id": "provider-5",
    "title": "Hồ sơ · PawCare Studio",
    "cells": [
      "PawCare Studio",
      "Dane Nguyen",
      "20/09/2026",
      "Grooming",
      "Đã duyệt"
    ],
    "status": {
      "label": "Đã duyệt",
      "tone": "success"
    },
    "tags": [
      "approved"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Cơ sở",
        "value": "PawCare Studio"
      },
      {
        "label": "Chủ sở hữu",
        "value": "Dane Nguyen"
      },
      {
        "label": "Ngày gửi",
        "value": "20/09/2026"
      },
      {
        "label": "Dịch vụ",
        "value": "Grooming"
      },
      {
        "label": "Trạng thái",
        "value": "Đã duyệt"
      }
    ],
    "pendingActions": []
  },
  {
    "id": "provider-6",
    "title": "Hồ sơ · Cozy Pet",
    "cells": [
      "Cozy Pet",
      "Quốc Bảo",
      "18/09/2026",
      "Trông giữ",
      "Từ chối"
    ],
    "status": {
      "label": "Từ chối",
      "tone": "danger"
    },
    "tags": [
      "rejected"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Cơ sở",
        "value": "Cozy Pet"
      },
      {
        "label": "Chủ sở hữu",
        "value": "Quốc Bảo"
      },
      {
        "label": "Ngày gửi",
        "value": "18/09/2026"
      },
      {
        "label": "Dịch vụ",
        "value": "Trông giữ"
      },
      {
        "label": "Trạng thái",
        "value": "Từ chối"
      }
    ],
    "pendingActions": []
  }
];

export const definition: AdminCollectionDefinition = {
  "title": "Duyệt cơ sở",
  "description": "Kiểm tra hồ sơ trước khi cơ sở hiển thị trên nền tảng",
  "listTitle": "Hồ sơ đăng ký",
  "listDescription": "Xem thông tin cơ sở theo từng hồ sơ",
  "headers": [
    "Cơ sở",
    "Chủ sở hữu",
    "Ngày gửi",
    "Dịch vụ",
    "Trạng thái"
  ],
  "filters": [
    {
      "value": "all",
      "label": "Tất cả"
    },
    {
      "value": "pending",
      "label": "Chờ duyệt"
    },
    {
      "value": "approved",
      "label": "Đã duyệt"
    },
    {
      "value": "rejected",
      "label": "Từ chối"
    }
  ],
  "metricLabels": [
    "Chờ duyệt",
    "Đã duyệt",
    "Từ chối"
  ],
  "searchLabel": "Tên cơ sở hoặc chủ sở hữu",
  "introAction": "Quy trình duyệt",
  "introNotes": ["Proposal UC-PRO-01: Admin xem hồ sơ đang chờ trước khi duyệt hoặc từ chối.", "BR-01: chỉ cơ sở đã duyệt và dịch vụ hoạt động được tìm kiếm và đặt lịch."]
};
