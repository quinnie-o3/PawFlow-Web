import { test } from "node:test";
import { strict as assert } from "node:assert";
import { renderToStaticMarkup } from "react-dom/server";
import { getProviderLifecyclePermissions } from "../../provider-workspace/lifecycle";
import type {
  ProviderApiErrorInfo,
  ProviderBooking,
  ProviderBookingDetail,
} from "../../provider-workspace/liveApi";
import type { BookingDetailLoadState, BookingDraftState } from "../types";
import BookingDetailsDialog from "./BookingDetailsDialog";

const NETWORK_ERROR: ProviderApiErrorInfo = {
  code: "NETWORK_ERROR",
  category: "uncertain",
  outcome: "unknown",
  status: null,
  retryAfterSeconds: null,
  shouldReconcile: true,
};

function makeBooking(
  overrides: Partial<ProviderBooking> = {},
): ProviderBooking {
  return {
    id: "90071992547409951",
    status: "PENDING_CONFIRMATION",
    bookedPrice: "350000.00",
    customerNote: "Miu sợ tiếng máy sấy.",
    createdAt: "2026-11-20T02:00:00.000Z",
    updatedAt: "2026-11-20T02:00:00.000Z",
    service: {
      id: "101",
      name: "Grooming toàn diện",
      durationMinutes: 90,
    },
    slot: {
      id: "501",
      slotDate: "2026-11-25",
      startTime: "09:00:00",
      endTime: "10:30:00",
    },
    customer: {
      id: "90071992547409988",
      fullName: "Hà Linh",
    },
    pet: {
      id: "301",
      name: "Miu",
      breed: "Anh lông ngắn",
      birthDate: "2024-03-12",
      weight: "4.20",
      healthNote: "Da nhạy cảm",
      petType: { id: "2", name: "Mèo" },
    },
    ...overrides,
  };
}

function makeDetail(
  overrides: Partial<ProviderBookingDetail> = {},
): ProviderBookingDetail {
  return {
    ...makeBooking(),
    statusLogs: [
      {
        id: "7001",
        oldStatus: null,
        newStatus: "PENDING_CONFIRMATION",
        reason: null,
        createdAt: "2026-11-20T02:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

function renderDialog(params: {
  detailState: BookingDetailLoadState;
  draftState: BookingDraftState;
  summaryBooking?: ProviderBooking | null;
  locked?: boolean;
}) {
  return renderToStaticMarkup(
    <BookingDetailsDialog
      bookingId="90071992547409951"
      facilityName="PawCare QA Studio"
      summaryBooking={
        params.summaryBooking === undefined
          ? makeBooking()
          : params.summaryBooking
      }
      detailState={params.detailState}
      permissions={getProviderLifecyclePermissions("APPROVED")}
      draftState={params.draftState}
      feedback={null}
      cooldownSeconds={0}
      locked={params.locked ?? false}
      onRetryDetail={() => {}}
      onReloadList={() => {}}
      onBeginAction={() => {}}
      onCancelAction={() => {}}
      onReasonChange={() => {}}
      onSubmitAction={() => {}}
      onReconcileUnknown={() => {}}
      onClose={() => {}}
    />,
  );
}

test("BookingDetailsDialog renders uncertain warning & reconcile button alongside retry when detailState.status is error", () => {
  const html = renderDialog({
    detailState: {
      identity: "gen-1:30:PROVIDER_OWNER",
      bookingId: "90071992547409951",
      status: "error",
      detail: null,
      error: NETWORK_ERROR,
    },
    draftState: {
      identity: "gen-1:30:PROVIDER_OWNER",
      bookingId: "90071992547409951",
      action: "reject",
      reason: "Hết nhân sự ca chiều",
      openedAtMs: 1_700_000_000_000,
      phase: "unknown",
      error: NETWORK_ERROR,
      reconcileError: NETWORK_ERROR,
    },
  });

  // Both detail retry and uncertain reconciliation controls are rendered and active.
  assert.match(html, /Tải lại chi tiết/);
  assert.match(html, /Chưa xác nhận được kết quả từ máy chủ/);
  assert.match(html, /Kiểm tra lại với máy chủ/);
  assert.match(html, /Hết nhân sự ca chiều/);
  assert.doesNotMatch(
    html,
    /<button[^>]*disabled=""[^>]*>(?:<svg[\s\S]*?<\/svg>)?Kiểm tra lại với máy chủ<\/button>/,
  );
  assert.doesNotMatch(
    html,
    /<button[^>]*disabled=""[^>]*>(?:<svg[\s\S]*?<\/svg>)?Tải lại chi tiết<\/button>/,
  );
});

test("BookingDetailsDialog locks both detail retry and reconcile buttons synchronously while busy (reconciling)", () => {
  const html = renderDialog({
    detailState: {
      identity: "gen-1:30:PROVIDER_OWNER",
      bookingId: "90071992547409951",
      status: "error",
      detail: null,
      error: NETWORK_ERROR,
    },
    draftState: {
      identity: "gen-1:30:PROVIDER_OWNER",
      bookingId: "90071992547409951",
      action: "reject",
      reason: "Hết nhân sự ca chiều",
      openedAtMs: 1_700_000_000_000,
      phase: "reconciling",
      error: NETWORK_ERROR,
      reconcileError: null,
    },
  });

  assert.match(html, /Đang kiểm tra với máy chủ/);
  assert.match(
    html,
    /<button[^>]*disabled=""[^>]*>(?:<svg[\s\S]*?<\/svg>)?Tải lại chi tiết<\/button>/,
  );
  assert.match(
    html,
    /<button[^>]*disabled=""[^>]*>(?:<svg[\s\S]*?<\/svg>)?Đang kiểm tra với máy chủ…<\/button>/,
  );
});

test("BookingDetailsDialog still renders uncertain reconcile section during loading even when summaryBooking is null", () => {
  const html = renderDialog({
    summaryBooking: null,
    detailState: {
      identity: "gen-1:30:PROVIDER_OWNER",
      bookingId: "90071992547409951",
      status: "loading",
      detail: null,
      error: null,
    },
    draftState: {
      identity: "gen-1:30:PROVIDER_OWNER",
      bookingId: "90071992547409951",
      action: "confirm",
      reason: "",
      openedAtMs: 1_700_000_000_000,
      phase: "unknown",
      error: NETWORK_ERROR,
      reconcileError: null,
    },
  });

  assert.match(html, /Đang tải chi tiết lịch hẹn/);
  assert.match(html, /Chưa xác nhận được kết quả từ máy chủ/);
  assert.match(html, /Kiểm tra lại với máy chủ/);
});

test("BookingDetailsDialog renders uncertain reconcile button exactly once when detailState.status is ready", () => {
  const html = renderDialog({
    detailState: {
      identity: "gen-1:30:PROVIDER_OWNER",
      bookingId: "90071992547409951",
      status: "ready",
      detail: makeDetail(),
      error: null,
    },
    draftState: {
      identity: "gen-1:30:PROVIDER_OWNER",
      bookingId: "90071992547409951",
      action: "confirm",
      reason: "",
      openedAtMs: 1_700_000_000_000,
      phase: "unknown",
      error: NETWORK_ERROR,
      reconcileError: null,
    },
  });

  const matches = html.match(/Kiểm tra lại với máy chủ/g) ?? [];
  assert.equal(matches.length, 1);
});
