import Image from "next/image";

const benefits = [
  "Tìm dịch vụ và nhà cung cấp",
  "Theo dõi trạng thái lịch hẹn",
  "Quản lý hồ sơ thú cưng",
];

export default function LoginSidePanel() {
  return (
    <aside className="relative h-[min(770px,calc(100vw+180px))] min-h-[620px] overflow-hidden rounded-[20px] bg-[#70b2c0] p-10 text-white sm:h-[670px] lg:h-[min(770px,calc(100vh-48px))]" aria-label="Giới thiệu PawFlow">
      <h2 className="relative z-[1] max-w-[330px] text-[26px] font-bold uppercase leading-[36px]">Mọi hoạt động chăm sóc thú cưng trong một nơi</h2>
      <p className="relative z-[1] mt-[16px] max-w-[320px] text-[14px] leading-[18px]">Tìm dịch vụ, quản lý hồ sơ thú cưng và theo dõi trạng thái lịch hẹn thuận tiện trên PawFlow.</p>

      <div aria-hidden="true" className="absolute left-1/2 top-[170px] h-[540px] w-[540px] -translate-x-1/2">
        <Image src="/bg-shadow.png" alt="" fill priority sizes="540px" className="object-contain" />
      </div>
      <div aria-hidden="true" className="absolute left-1/2 top-[168px] h-[546px] w-[418px] -translate-x-1/2">
        <Image src="/login-theme.png" alt="" fill priority sizes="418px" className="object-cover" />
      </div>

      <div className="absolute bottom-[26px] left-1/2 z-[2] w-[calc(100%-80px)] max-w-[510px] -translate-x-1/2 rounded-[10px] bg-[rgb(37_37_37_/_30%)] p-5 backdrop-blur-[33px]">
        <h3 className="text-[18px] font-bold leading-[26px]">PawFlow giúp bạn</h3>
        <ul className="mt-2.5 space-y-2 text-[12px] leading-[14px]">
          {benefits.map((benefit) => <li key={benefit} className="flex items-center gap-[10px]"><span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" />{benefit}</li>)}
        </ul>
      </div>
    </aside>
  );
}
