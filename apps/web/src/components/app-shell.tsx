import { Sidebar } from './sidebar';
import { Header } from './header';
import { Outlet } from '@tanstack/react-router';

export function AppShell() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex pt-14">
        <Sidebar />
        <main className="flex-1 p-4 md:ml-64 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
