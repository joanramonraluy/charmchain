// AppLayout.tsx
import { ReactNode, useState } from "react";
import SideMenu from "./SideMenu";
import Header from "./Header";
import SubHeader from "./SubHeader";

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
}

export default function AppLayout({ children, title }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Altura del header + subheader si existeix
  const topMargin = title ? "mt-28" : "mt-16";

  return (
    <div className="flex h-screen bg-gray-100 text-gray-900">
      <SideMenu isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onToggleMenu={() => setSidebarOpen(!sidebarOpen)} />
        {title && <SubHeader title={title} />}
        <main className={`${topMargin} flex-1 overflow-y-auto p-6`}>
          {children}
        </main>
      </div>
    </div>
  );
}
