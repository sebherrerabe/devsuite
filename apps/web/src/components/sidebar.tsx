import { Link } from '@tanstack/react-router';
import {
  LayoutDashboard,
  Inbox,
  FolderKanban,
  Clock,
  FileSearch,
  Receipt,
  Settings,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface NavItemConfig {
  label: string;
  icon: LucideIcon;
  to: string;
}

const navItems: NavItemConfig[] = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/' },
  { label: 'Inbox', icon: Inbox, to: '/inbox' },
  { label: 'Projects', icon: FolderKanban, to: '/projects' },
  { label: 'Sessions', icon: Clock, to: '/sessions' },
  { label: 'PR Reviews', icon: FileSearch, to: '/reviews' },
  { label: 'Invoicing', icon: Receipt, to: '/invoicing' },
];

const NavItem = ({
  item,
  isCollapsed,
}: {
  item: NavItemConfig;
  isCollapsed: boolean;
}) => {
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Link
          to={item.to}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-300 ease-in-out hover:bg-accent hover:text-accent-foreground',
            'data-[status=active]:bg-primary/10 data-[status=active]:text-primary',
            isCollapsed ? 'justify-center px-2 gap-0' : 'justify-start'
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span
            className={cn(
              'overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] ease-in-out',
              isCollapsed
                ? 'max-w-0 opacity-0 -translate-x-2 duration-200'
                : 'max-w-[200px] opacity-100 translate-x-0 duration-300 delay-75'
            )}
          >
            {item.label}
          </span>
        </Link>
      </TooltipTrigger>
      {isCollapsed && (
        <TooltipContent side="right" className="flex items-center gap-4">
          {item.label}
        </TooltipContent>
      )}
    </Tooltip>
  );
};

interface SidebarProps {
  isCollapsed?: boolean;
  className?: string;
  onToggle?: () => void;
}

export function Sidebar({
  isCollapsed = false,
  className,
  onToggle,
}: SidebarProps) {
  return (
    <TooltipProvider>
      <aside
        data-collapsed={isCollapsed}
        className={cn(
          'group flex flex-col gap-4 py-2 data-[collapsed=true]:py-2 min-w-0',
          className
        )}
      >
        <div
          className={cn(
            'flex px-2 items-center transition-all duration-300 ease-in-out',
            isCollapsed ? 'justify-center' : 'justify-end'
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8"
          >
            {isCollapsed ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <ChevronsLeft className="h-4 w-4" />
            )}
            <span className="sr-only">Toggle Sidebar</span>
          </Button>
        </div>
        <nav className="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2">
          {navItems.map(item => (
            <NavItem key={item.to} item={item} isCollapsed={isCollapsed} />
          ))}
        </nav>
        <nav className="mt-auto grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2 border-t pt-4">
          <NavItem
            item={{ label: 'Settings', icon: Settings, to: '/settings' }}
            isCollapsed={isCollapsed}
          />
        </nav>
      </aside>
    </TooltipProvider>
  );
}
