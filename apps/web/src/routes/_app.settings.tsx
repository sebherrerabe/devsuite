import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { User, Building2, Settings2 } from 'lucide-react';

export const Route = createFileRoute('/_app/settings')({
  component: SettingsLayout,
});

const settingsNavItems = [
  { label: 'Profile', icon: User, to: '/settings/profile' },
  { label: 'Company', icon: Building2, to: '/settings/company' },
  { label: 'Integrations', icon: Settings2, to: '/settings/integrations' },
];

function SettingsLayout() {
  return (
    <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
      <aside className="lg:w-1/5">
        <nav className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
          {settingsNavItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                'data-[status=active]:bg-accent data-[status=active]:text-accent-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1 lg:max-w-4xl">
        <Outlet />
      </div>
    </div>
  );
}
