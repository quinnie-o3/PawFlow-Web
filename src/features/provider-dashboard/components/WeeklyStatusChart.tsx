import type { WeeklyStatusPoint } from "../types";

type WeeklyStatusChartProps = {
  data: WeeklyStatusPoint[];
  period: string;
};

export default function WeeklyStatusChart({ data, period }: WeeklyStatusChartProps) {
  const maxValue = Math.max(1, ...data.flatMap((point) => [point.completed, point.other]));

  return (
    <section className="rounded-[12px] bg-white p-6 shadow-[0_2px_8px_rgb(0_0_0_/_0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[16px] font-bold leading-5 text-[var(--text-primary)]">
          Lịch hẹn theo trạng thái
        </h2>
        <span className="flex min-h-6 items-center justify-center rounded-full bg-[#001aff] px-2.5 py-1 text-[11px] font-semibold leading-4 text-white">
          {period}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-[12px] leading-[15px] text-[var(--text-secondary)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[4px] bg-[var(--accent-hover)]" />
          Completed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[4px] bg-[var(--color-neutral-200)]" />
          Khác
        </span>
      </div>

      <div className="mt-4" role="img" aria-label={`Lịch hẹn theo tuần: ${data.map((point) => `${point.week}: ${point.completed} Completed, ${point.other} khác`).join('; ')}`}>
        <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-4">
          {data.map((point) => (
            <div key={point.week} className="flex flex-col items-center gap-2">
              <div className="flex h-[150px] items-end gap-1">
                <span
                  className="w-6 rounded-t-[4px] bg-[var(--accent-hover)]"
                  style={{ height: `${(point.completed / maxValue) * 150}px` }}
                  title={`${point.week}: ${point.completed} Completed`}
                />
                <span
                  className="w-6 rounded-t-[4px] bg-[var(--color-neutral-200)]"
                  style={{ height: `${(point.other / maxValue) * 150}px` }}
                  title={`${point.week}: ${point.other} khác`}
                />
              </div>
              <span className="text-[12px] leading-[15px] text-[var(--text-secondary)]">
                {point.week}
              </span>
            </div>
          ))}
        </div>
      </div>

      {!data.length && <p className="py-10 text-[14px] leading-5 text-[var(--text-secondary)]">Chưa có dữ liệu lịch hẹn trong kỳ.</p>}
      <p className="mt-3 text-[12px] leading-[15px] text-[var(--text-secondary)]">
        Biểu đồ nhóm theo tuần, chỉ tính lịch hẹn theo ngày slot đã lên lịch và
        chỉ hiển thị dữ liệu của PawCare Studio.
      </p>
    </section>
  );
}
