"use client";

export default function AdminError({ reset }: { reset: () => void }) {
  return <section><h1>Không hiển thị được màn Admin</h1><p role="alert">Vui lòng thử tải lại giao diện.</p><button type="button" onClick={reset}>Thử lại</button></section>;
}
