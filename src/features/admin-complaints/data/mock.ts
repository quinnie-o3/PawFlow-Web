import type { AdminCollectionDefinition, AdminRecord } from "../../admin-workspace/types";

// Read-only Figma fixtures. Local IDs and view models are not an API contract.
export const records: readonly AdminRecord[] = [
  {
    "id": "KN-014",
    "title": "Khiếu nại · KN-014",
    "cells": [
      "KN-014",
      "Lan Phương",
      "PawCare Studio",
      "PF-2079",
      "Mới"
    ],
    "status": {
      "label": "Mới",
      "tone": "info"
    },
    "tags": [
      "open"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Mã",
        "value": "KN-014"
      },
      {
        "label": "Người gửi",
        "value": "Lan Phương"
      },
      {
        "label": "Cơ sở",
        "value": "PawCare Studio"
      },
      {
        "label": "Mã lịch",
        "value": "PF-2079"
      },
      {
        "label": "Trạng thái",
        "value": "Mới"
      },
      {
        "label": "Thú cưng",
        "value": "Bon"
      },
      {
        "label": "Nội dung",
        "value": "Chờ dịch vụ lâu hơn giờ đã hẹn."
      },
      {
        "label": "Ghi chú trong thiết kế",
        "value": "Liên hệ hai bên để xác minh."
      }
    ],
    "pendingActions": [
      "Tiếp nhận",
      "Thêm ghi chú"
    ]
  },
  {
    "id": "KN-013",
    "title": "Khiếu nại · KN-013",
    "cells": [
      "KN-013",
      "Quang Minh",
      "Happy Paws",
      "PF-2068",
      "Đang xử lý"
    ],
    "status": {
      "label": "Đang xử lý",
      "tone": "warning"
    },
    "tags": [
      "processing"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Mã",
        "value": "KN-013"
      },
      {
        "label": "Người gửi",
        "value": "Quang Minh"
      },
      {
        "label": "Cơ sở",
        "value": "Happy Paws"
      },
      {
        "label": "Mã lịch",
        "value": "PF-2068"
      },
      {
        "label": "Trạng thái",
        "value": "Đang xử lý"
      },
      {
        "label": "Nội dung / kết luận chi tiết",
        "value": "Chưa có trong fixture đã đối chiếu."
      }
    ],
    "pendingActions": [
      "Thêm ghi chú",
      "Đánh dấu đã giải quyết"
    ]
  },
  {
    "id": "KN-012",
    "title": "Khiếu nại · KN-012",
    "cells": [
      "KN-012",
      "Ngọc Anh",
      "Little Tails",
      "PF-2047",
      "Mới"
    ],
    "status": {
      "label": "Mới",
      "tone": "info"
    },
    "tags": [
      "open"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Mã",
        "value": "KN-012"
      },
      {
        "label": "Người gửi",
        "value": "Ngọc Anh"
      },
      {
        "label": "Cơ sở",
        "value": "Little Tails"
      },
      {
        "label": "Mã lịch",
        "value": "PF-2047"
      },
      {
        "label": "Trạng thái",
        "value": "Mới"
      },
      {
        "label": "Nội dung / kết luận chi tiết",
        "value": "Chưa có trong fixture đã đối chiếu."
      }
    ],
    "pendingActions": [
      "Tiếp nhận",
      "Thêm ghi chú"
    ]
  },
  {
    "id": "KN-011",
    "title": "Khiếu nại · KN-011",
    "cells": [
      "KN-011",
      "Mai Anh",
      "PawCare Studio",
      "PF-2051",
      "Đã giải quyết"
    ],
    "status": {
      "label": "Đã giải quyết",
      "tone": "success"
    },
    "tags": [
      "resolved"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Mã",
        "value": "KN-011"
      },
      {
        "label": "Người gửi",
        "value": "Mai Anh"
      },
      {
        "label": "Cơ sở",
        "value": "PawCare Studio"
      },
      {
        "label": "Mã lịch",
        "value": "PF-2051"
      },
      {
        "label": "Trạng thái",
        "value": "Đã giải quyết"
      },
      {
        "label": "Nội dung / kết luận chi tiết",
        "value": "Chưa có trong fixture đã đối chiếu."
      }
    ],
    "pendingActions": []
  },
  {
    "id": "KN-010",
    "title": "Khiếu nại · KN-010",
    "cells": [
      "KN-010",
      "Đức Huy",
      "Miu House",
      "PF-2040",
      "Đang xử lý"
    ],
    "status": {
      "label": "Đang xử lý",
      "tone": "warning"
    },
    "tags": [
      "processing"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Mã",
        "value": "KN-010"
      },
      {
        "label": "Người gửi",
        "value": "Đức Huy"
      },
      {
        "label": "Cơ sở",
        "value": "Miu House"
      },
      {
        "label": "Mã lịch",
        "value": "PF-2040"
      },
      {
        "label": "Trạng thái",
        "value": "Đang xử lý"
      },
      {
        "label": "Nội dung / kết luận chi tiết",
        "value": "Chưa có trong fixture đã đối chiếu."
      }
    ],
    "pendingActions": [
      "Thêm ghi chú",
      "Đánh dấu đã giải quyết"
    ]
  },
  {
    "id": "KN-009",
    "title": "Khiếu nại · KN-009",
    "cells": [
      "KN-009",
      "Lan Phương",
      "PetNest Care",
      "PF-2036",
      "Đã giải quyết"
    ],
    "status": {
      "label": "Đã giải quyết",
      "tone": "success"
    },
    "tags": [
      "resolved"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Mã",
        "value": "KN-009"
      },
      {
        "label": "Người gửi",
        "value": "Lan Phương"
      },
      {
        "label": "Cơ sở",
        "value": "PetNest Care"
      },
      {
        "label": "Mã lịch",
        "value": "PF-2036"
      },
      {
        "label": "Trạng thái",
        "value": "Đã giải quyết"
      },
      {
        "label": "Nội dung / kết luận chi tiết",
        "value": "Chưa có trong fixture đã đối chiếu."
      }
    ],
    "pendingActions": []
  }
];

export const definition: AdminCollectionDefinition = {
  "title": "Khiếu nại",
  "description": "Theo dõi phản ánh liên quan đến lịch hẹn và chất lượng dịch vụ",
  "listTitle": "Danh sách khiếu nại",
  "listDescription": "Liên kết phản ánh với lịch hẹn, khách hàng và cơ sở",
  "headers": [
    "Mã",
    "Người gửi",
    "Cơ sở",
    "Mã lịch",
    "Trạng thái"
  ],
  "filters": [
    {
      "value": "all",
      "label": "Tất cả"
    },
    {
      "value": "open",
      "label": "Mới"
    },
    {
      "value": "processing",
      "label": "Đang xử lý"
    },
    {
      "value": "resolved",
      "label": "Đã giải quyết"
    }
  ],
  "metricLabels": [
    "Mới tiếp nhận",
    "Đang xử lý",
    "Đã giải quyết"
  ],
  "searchLabel": "Mã khiếu nại hoặc mã lịch",
  "introAction": "Quy trình xử lý",
  "introNotes": ["Proposal §7.3 và thiết kế: Admin xem phản ánh liên quan đến lịch hẹn hoặc chất lượng dịch vụ, với khách hàng và cơ sở liên quan.", "Chuyển trạng thái, ghi chú, kết luận và điều kiện mở lại chưa được người dùng xác nhận."]
};
