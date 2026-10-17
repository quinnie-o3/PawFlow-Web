import Image from "next/image";

export default function RegisterSidePanel() {
  return (
    <aside className="relative h-[min(770px,calc(100vw+180px))] min-h-[620px] overflow-hidden rounded-[20px] bg-[#a1be97] p-10 text-white sm:h-[670px] lg:h-[min(770px,calc(100vh-48px))]" aria-label="Giới thiệu PawFlow">
      <h2 className="relative z-[1] max-w-[330px] text-[26px] font-bold uppercase leading-[36px]">Chăm sóc thú cưng thuận tiện hơn cùng PawFlow</h2>

      <div aria-hidden="true" className="absolute left-1/2 top-[128px] h-[540px] w-[540px] -translate-x-1/2">
        <Image src="/bg-shadow.png" alt="" fill priority sizes="540px" className="object-contain" />
      </div>
      <div aria-hidden="true" className="absolute left-1/2 top-1/2 h-[664px] w-[508px] -translate-x-1/2 -translate-y-1/2">
        <Image src="/signup-theme.png" alt="" fill priority sizes="508px" className="object-contain" />
      </div>

      <div className="absolute bottom-[37px] left-1/2 z-[2] w-[calc(100%-80px)] max-w-[508px] -translate-x-1/2 rounded-[10px] bg-[rgb(37_37_37_/_30%)] p-5 backdrop-blur-[33px]">
        <h3 className="text-[18px] font-bold leading-[26px]">Mọi thứ trong một nơi</h3>
        <p className="mt-2.5 text-[16px] leading-[22px]">Khám phá cơ sở và dịch vụ phù hợp.</p>
        <p className="mt-[22px] text-[16px] leading-[22px]">Lưu hồ sơ thú cưng, đặt lịch và theo dõi trạng thái từng cuộc hẹn.</p>
      </div>
    </aside>
  );
}
