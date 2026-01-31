import { Link } from '@tanstack/react-router';
import {
  LayoutDashboard,
  Inbox,
  FolderKanban,
  Clock,
  FileSearch,
  Receipt,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/' },
  { label: 'Inbox', icon: Inbox, to: '/inbox' },
  { label: 'Projects', icon: FolderKanban, to: '/projects' },
  { label: 'Sessions', icon: Clock, to: '/sessions' },
  { label: 'PR Reviews', icon: FileSearch, to: '/reviews' },
  { label: 'Invoicing', icon: Receipt, to: '/invoicing' },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-14 z-30 hidden h-[calc(100vh-3.5rem)] w-64 border-r bg-card md:block">
      <div className="flex h-full flex-col gap-2 p-4">
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                'data-[status=active]:bg-primary/10 data-[status=active]:text-primary'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <nav className="mt-auto flex flex-col gap-1 border-t pt-4">
          <Link
            to="/settings"
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
              'data-[status=active]:bg-primary/10 data-[status=active]:text-primary'
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </nav>
      </div>
    </aside>
  );
}
