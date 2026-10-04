import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";

export default function Home() {
  return (
    <div className="page-surface flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1 gap-6 px-6 pt-4 pb-2">
        <Sidebar />
        <main className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h1 className="text-display">PawPal</h1>
            <p className="mt-3 text-content text-text-secondary">
              Pet care platform
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
