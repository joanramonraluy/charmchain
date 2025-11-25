import { ReactNode, useState } from "react";
import SideMenu from "./SideMenu";
import Header from "./Header";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex bg-gray-100 text-gray-900 h-screen overflow-hidden">
      <SideMenu isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Fixed header at top */}
        <Header onToggleMenu={() => setSidebarOpen(!sidebarOpen)} />

        {/* Main content area - scrollable */}
        <main className="flex-1 md:ml-[180px] overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
