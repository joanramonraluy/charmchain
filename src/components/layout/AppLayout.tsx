// AppLayout.tsx
import { ReactNode, useState } from "react";
import SideMenu from "./SideMenu";
import Header from "./Header";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex bg-gray-100 text-gray-900 min-h-screen">
      <SideMenu isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      <div className="flex-1 flex flex-col">
        <Header onToggleMenu={() => setSidebarOpen(!sidebarOpen)} />

        {/* Contingut principal */}
        <main className="mt-[-1rem] md:ml-[180px] p-6 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
