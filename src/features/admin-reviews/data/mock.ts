import type { AdminCollectionDefinition, AdminRecord } from "../../admin-workspace/types";

// Read-only Figma fixtures. Local IDs and view models are not an API contract.
export const records: readonly AdminRecord[] = [
  {
    "id": "review-PF-2075",
    "title": "Đánh giá · PF-2075",
    "cells": [
      "Mai Anh",
      "PawCare Studio",
      "PF-2075",
      "5 sao",
      "Bị báo cáo"
    ],
    "status": {
      "label": "Bị báo cáo",
      "tone": "warning"
    },
    "tags": [
      "reported"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Khách hàng",
        "value": "Mai Anh"
      },
      {
        "label": "Cơ sở",
        "value": "PawCare Studio"
      },
      {
        "label": "Mã lịch",
        "value": "PF-2075"
      },
      {
        "label": "Đánh giá",
        "value": "5 sao"
      },
      {
        "label": "Trạng thái",
        "value": "Bị báo cáo"
      },
      {
        "label": "Thú cưng",
        "value": "Lạc"
      },
      {
        "label": "Trạng thái lịch",
        "value": "Hoàn thành"
      },
      {
        "label": "Nội dung",
        "value": "Lạc được chăm sóc kỹ."
      },
      {
        "label": "Lý do báo cáo",
        "value": "Nghi ngờ sai đối tượng."
      }
    ],
    "pendingActions": [
      "Giữ hiển thị",
      "Ẩn đánh giá"
    ]
  },
  {
    "id": "review-PF-2058",
    "title": "Đánh giá · PF-2058",
    "cells": [
      "Quang Minh",
      "Happy Paws",
      "PF-2058",
      "4 sao",
      "Bị báo cáo"
    ],
    "status": {
      "label": "Bị báo cáo",
      "tone": "warning"
    },
    "tags": [
      "reported"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Khách hàng",
        "value": "Quang Minh"
      },
      {
        "label": "Cơ sở",
        "value": "Happy Paws"
      },
      {
        "label": "Mã lịch",
        "value": "PF-2058"
      },
      {
        "label": "Đánh giá",
        "value": "4 sao"
      },
      {
        "label": "Trạng thái",
        "value": "Bị báo cáo"
      },
      {
        "label": "Nội dung / báo cáo chi tiết",
        "value": "Chưa có trong fixture đã đối chiếu."
      }
    ],
    "pendingActions": [
      "Giữ hiển thị",
      "Ẩn đánh giá"
    ]
  },
  {
    "id": "review-PF-2051",
    "title": "Đánh giá · PF-2051",
    "cells": [
      "Mai Anh",
      "PawCare Studio",
      "PF-2051",
      "5 sao",
      "Hiển thị"
    ],
    "status": {
      "label": "Hiển thị",
      "tone": "success"
    },
    "tags": [
      "visible"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Khách hàng",
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
        "label": "Đánh giá",
        "value": "5 sao"
      },
      {
        "label": "Trạng thái",
        "value": "Hiển thị"
      },
      {
        "label": "Nội dung / báo cáo chi tiết",
        "value": "Chưa có trong fixture đã đối chiếu."
      }
    ],
    "pendingActions": [
      "Giữ hiển thị",
      "Ẩn đánh giá"
    ]
  },
  {
    "id": "review-PF-2047",
    "title": "Đánh giá · PF-2047",
    "cells": [
      "Ngọc Anh",
      "Little Tails",
      "PF-2047",
      "2 sao",
      "Bị báo cáo"
    ],
    "status": {
      "label": "Bị báo cáo",
      "tone": "warning"
    },
    "tags": [
      "reported"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Khách hàng",
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
        "label": "Đánh giá",
        "value": "2 sao"
      },
      {
        "label": "Trạng thái",
        "value": "Bị báo cáo"
      },
      {
        "label": "Nội dung / báo cáo chi tiết",
        "value": "Chưa có trong fixture đã đối chiếu."
      }
    ],
    "pendingActions": [
      "Giữ hiển thị",
      "Ẩn đánh giá"
    ]
  },
  {
    "id": "review-PF-2040",
    "title": "Đánh giá · PF-2040",
    "cells": [
      "Đức Huy",
      "Miu House",
      "PF-2040",
      "4 sao",
      "Đã ẩn"
    ],
    "status": {
      "label": "Đã ẩn",
      "tone": "danger"
    },
    "tags": [
      "hidden"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Khách hàng",
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
        "label": "Đánh giá",
        "value": "4 sao"
      },
      {
        "label": "Trạng thái",
        "value": "Đã ẩn"
      },
      {
        "label": "Nội dung / báo cáo chi tiết",
        "value": "Chưa có trong fixture đã đối chiếu."
      }
    ],
    "pendingActions": [
      "Hiển thị lại"
    ]
  },
  {
    "id": "review-PF-2036",
    "title": "Đánh giá · PF-2036",
    "cells": [
      "Lan Phương",
      "PetNest Care",
      "PF-2036",
      "5 sao",
      "Hiển thị"
    ],
    "status": {
      "label": "Hiển thị",
      "tone": "success"
    },
    "tags": [
      "visible"
    ],
    "description": "Bản ghi mẫu từ thiết kế Figma. Chỉ hiển thị các thông tin đã có trong fixture.",
    "details": [
      {
        "label": "Khách hàng",
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
        "label": "Đánh giá",
        "value": "5 sao"
      },
      {
        "label": "Trạng thái",
        "value": "Hiển thị"
      },
      {
        "label": "Nội dung / báo cáo chi tiết",
        "value": "Chưa có trong fixture đã đối chiếu."
      }
    ],
    "pendingActions": [
      "Giữ hiển thị",
      "Ẩn đánh giá"
    ]
  }
];

export const definition: AdminCollectionDefinition = {
  "title": "Kiểm duyệt đánh giá",
  "description": "Xem nội dung bị báo cáo và lịch hẹn liên quan",
  "listTitle": "Danh sách đánh giá",
  "listDescription": "Kiểm tra nội dung, lịch hoàn thành và lý do báo cáo",
  "headers": [
    "Khách hàng",
    "Cơ sở",
    "Mã lịch",
    "Đánh giá",
    "Trạng thái"
  ],
  "filters": [
    {
      "value": "all",
      "label": "Tất cả"
    },
    {
      "value": "reported",
      "label": "Bị báo cáo"
    },
    {
      "value": "visible",
      "label": "Hiển thị"
    },
    {
      "value": "hidden",
      "label": "Đã ẩn"
    }
  ],
  "metricLabels": [
    "Bị báo cáo",
    "Đang hiển thị",
    "Đã ẩn"
  ],
  "searchLabel": "Khách hàng, cơ sở hoặc mã lịch",
  "introAction": "Quy tắc đánh giá",
  "introNotes": ["Proposal BR-09/10: Customer chỉ đánh giá booking của mình sau khi hoàn thành; mỗi booking tối đa một review.", "Thiết kế yêu cầu xem nội dung, người gửi, lịch hẹn và lý do báo cáo trước khi kiểm duyệt."]
};
