import { Link } from '@tanstack/react-router';
import {
  LayoutDashboard,
  Building2,
  GitBranch,
  FolderKanban,
  CheckSquare,
  Inbox,
  FileSearch,
  Zap,
  Receipt,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/app' },
  { label: 'Company', icon: Building2, to: '/app/company' },
  { label: 'Repos', icon: GitBranch, to: '/app/repos' },
  { label: 'Projects', icon: FolderKanban, to: '/app/projects' },
  { label: 'Tasks', icon: CheckSquare, to: '/app/tasks' },
  { label: 'Inbox', icon: Inbox, to: '/app/inbox' },
  { label: 'PR Reviews', icon: FileSearch, to: '/app/reviews' },
  { label: 'Performance', icon: Zap, to: '/app/performance' },
  { label: 'Invoicing', icon: Receipt, to: '/app/invoicing' },
  { label: 'Settings', icon: Settings, to: '/app/settings' },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-14 z-30 hidden h-[calc(100vh-3.5rem)] w-64 border-r bg-background md:block">
      <div className="flex h-full flex-col gap-2 p-4">
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                '[[data-status=active]]:bg-accent [[data-status=active]]:text-accent-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}
