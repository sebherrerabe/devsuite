import { Link } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import {
  LayoutDashboard,
  Inbox,
  FolderKanban,
  Clock,
  Activity,
  FileSearch,
  Receipt,
  Settings,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCurrentCompany } from '@/lib/company-context';
import type { AppModule } from '@devsuite/shared';

interface NavItemConfig {
  label: string;
  icon: LucideIcon;
  to: string;
  badgeCount?: number;
  module?: AppModule;
}

const navItems: NavItemConfig[] = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/' },
  { label: 'Inbox', icon: Inbox, to: '/inbox' },
  {
    label: 'Projects',
    icon: FolderKanban,
    to: '/projects',
    module: 'projects',
  },
  { label: 'Sessions', icon: Clock, to: '/sessions', module: 'sessions' },
  {
    label: 'Performance',
    icon: Activity,
    to: '/performance',
    module: 'performance',
  },
  {
    label: 'PR Reviews',
    icon: FileSearch,
    to: '/reviews',
    module: 'pr_reviews',
  },
  { label: 'Invoicing', icon: Receipt, to: '/invoicing', module: 'invoicing' },
];

const NavItem = ({
  item,
  isCollapsed,
  onSelect,
}: {
  item: NavItemConfig;
  isCollapsed: boolean;
  onSelect?: () => void;
}) => {
  const badgeCount = item.badgeCount ?? 0;
  const showBadge = badgeCount > 0;
  const badgeText = badgeCount > 99 ? '99+' : String(badgeCount);

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Link
          to={item.to}
          onClick={onSelect}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-300 ease-in-out hover:bg-accent hover:text-accent-foreground',
            'data-[status=active]:bg-primary/10 data-[status=active]:text-primary',
            isCollapsed ? 'justify-center px-2 gap-0' : 'justify-start'
          )}
        >
          <span className="relative shrink-0">
            <item.icon className="h-4 w-4" />
            {isCollapsed && showBadge && (
              <span className="absolute -top-1 -right-2 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] leading-4 text-center font-bold">
                {badgeText}
              </span>
            )}
          </span>
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
          {!isCollapsed && showBadge && (
            <Badge
              variant="secondary"
              className="ml-auto text-[10px] h-5 font-bold"
            >
              {badgeText}
            </Badge>
          )}
        </Link>
      </TooltipTrigger>
      {isCollapsed && (
        <TooltipContent side="right" className="flex items-center gap-4">
          {item.label}
          {showBadge && (
            <span className="text-xs text-muted-foreground">{badgeText}</span>
          )}
        </TooltipContent>
      )}
    </Tooltip>
  );
};

interface SidebarProps {
  isCollapsed?: boolean;
  className?: string;
  onToggle?: () => void;
  showToggle?: boolean;
  onItemSelect?: () => void;
}

export function Sidebar({
  isCollapsed = false,
  className,
  onToggle,
  showToggle = true,
  onItemSelect,
}: SidebarProps) {
  const { currentCompany, isModuleEnabled } = useCurrentCompany();
  const companyId = currentCompany?._id;
  const unreadCount = useQuery(
    api.inboxItems.getUnreadCount,
    companyId ? { companyId } : 'skip'
  );

  const filteredItems = navItems.filter(
    item => !item.module || isModuleEnabled(item.module)
  );

  const itemsWithBadges = filteredItems.map(item =>
    item.to === '/inbox' ? { ...item, badgeCount: unreadCount ?? 0 } : item
  );

  const shouldShowToggle = showToggle && !!onToggle;

  return (
    <TooltipProvider>
      <aside
        data-collapsed={isCollapsed}
        className={cn(
          'group flex flex-col gap-4 py-2 data-[collapsed=true]:py-2 min-w-0',
          className
        )}
      >
        {shouldShowToggle && (
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
        )}
        <nav className="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2">
          {itemsWithBadges.map(item => (
            <NavItem
              key={item.to}
              item={item}
              isCollapsed={isCollapsed}
              onSelect={onItemSelect}
            />
          ))}
        </nav>
        <nav className="mt-auto grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2 border-t pt-4">
          <NavItem
            item={{ label: 'Settings', icon: Settings, to: '/settings' }}
            isCollapsed={isCollapsed}
            onSelect={onItemSelect}
          />
        </nav>
      </aside>
    </TooltipProvider>
  );
}
