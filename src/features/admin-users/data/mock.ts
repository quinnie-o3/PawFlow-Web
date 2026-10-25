import type { AdminCollectionDefinition, AdminRecord } from "../../admin-workspace/types";

// Read-only Figma fixtures. Local IDs and view models are not an API contract.
export const records: readonly AdminRecord[] = [
  {
    "id": "user-1",
    "title": "Tài khoản · Hà Linh",
    "cells": [
      "Hà Linh",
      "halinh@example.com",
      "Khách hàng",
      "20/09/2026",
      "Hoạt động"
    ],
    "status": {
      "label": "Hoạt động",
      "tone": "success"
    },
    "tags": [
      "customer"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Họ tên",
        "value": "Hà Linh"
      },
      {
        "label": "Email",
        "value": "halinh@example.com"
      },
      {
        "label": "Vai trò",
        "value": "Khách hàng"
      },
      {
        "label": "Ngày tạo",
        "value": "20/09/2026"
      },
      {
        "label": "Trạng thái",
        "value": "Hoạt động"
      }
    ],
    "pendingActions": [
      "Tạm khóa"
    ]
  },
  {
    "id": "user-2",
    "title": "Tài khoản · Dane Nguyen",
    "cells": [
      "Dane Nguyen",
      "dane@example.com",
      "Chủ cơ sở",
      "18/09/2026",
      "Hoạt động"
    ],
    "status": {
      "label": "Hoạt động",
      "tone": "success"
    },
    "tags": [
      "owner"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Họ tên",
        "value": "Dane Nguyen"
      },
      {
        "label": "Email",
        "value": "dane@example.com"
      },
      {
        "label": "Vai trò",
        "value": "Chủ cơ sở"
      },
      {
        "label": "Ngày tạo",
        "value": "18/09/2026"
      },
      {
        "label": "Trạng thái",
        "value": "Hoạt động"
      },
      {
        "label": "Cơ sở liên kết",
        "value": "PawCare Studio"
      }
    ],
    "pendingActions": [
      "Tạm khóa"
    ]
  },
  {
    "id": "user-3",
    "title": "Tài khoản · Quang Minh",
    "cells": [
      "Quang Minh",
      "quang@example.com",
      "Khách hàng",
      "17/09/2026",
      "Hoạt động"
    ],
    "status": {
      "label": "Hoạt động",
      "tone": "success"
    },
    "tags": [
      "customer"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Họ tên",
        "value": "Quang Minh"
      },
      {
        "label": "Email",
        "value": "quang@example.com"
      },
      {
        "label": "Vai trò",
        "value": "Khách hàng"
      },
      {
        "label": "Ngày tạo",
        "value": "17/09/2026"
      },
      {
        "label": "Trạng thái",
        "value": "Hoạt động"
      }
    ],
    "pendingActions": [
      "Tạm khóa"
    ]
  },
  {
    "id": "user-4",
    "title": "Tài khoản · Ngọc Mai",
    "cells": [
      "Ngọc Mai",
      "ngocmai@example.com",
      "Nhân viên",
      "16/09/2026",
      "Hoạt động"
    ],
    "status": {
      "label": "Hoạt động",
      "tone": "success"
    },
    "tags": [
      "staff"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Họ tên",
        "value": "Ngọc Mai"
      },
      {
        "label": "Email",
        "value": "ngocmai@example.com"
      },
      {
        "label": "Vai trò",
        "value": "Nhân viên"
      },
      {
        "label": "Ngày tạo",
        "value": "16/09/2026"
      },
      {
        "label": "Trạng thái",
        "value": "Hoạt động"
      },
      {
        "label": "Quyền Staff",
        "value": "Chờ xác nhận ở FE-014; không suy ra quyền từ tài khoản mẫu."
      }
    ],
    "pendingActions": [
      "Tạm khóa"
    ]
  },
  {
    "id": "user-5",
    "title": "Tài khoản · Ngọc Anh",
    "cells": [
      "Ngọc Anh",
      "ngoc@example.com",
      "Khách hàng",
      "12/09/2026",
      "Tạm khóa"
    ],
    "status": {
      "label": "Tạm khóa",
      "tone": "danger"
    },
    "tags": [
      "customer"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Họ tên",
        "value": "Ngọc Anh"
      },
      {
        "label": "Email",
        "value": "ngoc@example.com"
      },
      {
        "label": "Vai trò",
        "value": "Khách hàng"
      },
      {
        "label": "Ngày tạo",
        "value": "12/09/2026"
      },
      {
        "label": "Trạng thái",
        "value": "Tạm khóa"
      }
    ],
    "pendingActions": [
      "Mở khóa"
    ]
  },
  {
    "id": "user-6",
    "title": "Tài khoản · Lan Phương",
    "cells": [
      "Lan Phương",
      "lan@example.com",
      "Chủ cơ sở",
      "10/09/2026",
      "Hoạt động"
    ],
    "status": {
      "label": "Hoạt động",
      "tone": "success"
    },
    "tags": [
      "owner"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Họ tên",
        "value": "Lan Phương"
      },
      {
        "label": "Email",
        "value": "lan@example.com"
      },
      {
        "label": "Vai trò",
        "value": "Chủ cơ sở"
      },
      {
        "label": "Ngày tạo",
        "value": "10/09/2026"
      },
      {
        "label": "Trạng thái",
        "value": "Hoạt động"
      }
    ],
    "pendingActions": [
      "Tạm khóa"
    ]
  }
];

export const definition: AdminCollectionDefinition = {
  "title": "Người dùng",
  "description": "Quản lý tài khoản và vai trò ở cấp nền tảng",
  "listTitle": "Danh sách người dùng",
  "listDescription": "Vai trò và thông tin liên kết trong bản ghi mẫu",
  "headers": [
    "Họ tên",
    "Email",
    "Vai trò",
    "Ngày tạo",
    "Trạng thái"
  ],
  "filters": [
    {
      "value": "all",
      "label": "Tất cả"
    },
    {
      "value": "customer",
      "label": "Khách hàng"
    },
    {
      "value": "owner",
      "label": "Chủ cơ sở"
    },
    {
      "value": "staff",
      "label": "Nhân viên"
    }
  ],
  "metricLabels": [
    "Tài khoản hoạt động",
    "Khách hàng",
    "Chủ cơ sở / nhân viên"
  ],
  "searchLabel": "Tên hoặc email",
  "introAction": "Quyền truy cập",
  "introNotes": ["Proposal Table 6: Customer xem dữ liệu của mình; Owner và Staff được phân công chỉ truy cập dữ liệu của cơ sở liên quan.", "Quyền thao tác cụ thể của Staff sẽ được chốt trong FE-014. UI này không thay đổi vai trò hoặc trạng thái tài khoản."]
};
