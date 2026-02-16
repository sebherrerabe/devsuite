import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { CompanySwitcher } from './company-switcher';
import { PrivacyModeToggle } from './privacy-mode-toggle';
import { Button } from '@/components/ui/button';
import { SessionWidget } from './session-widget';
import { Sidebar } from './sidebar';
import { authClient, signOut } from '@/lib/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { User, LogOut, Menu } from 'lucide-react';
import { useCurrentCompany } from '@/lib/company-context';
import { WindowControls } from './window-controls';

export function Header() {
  const { data: session } = authClient.useSession();
  const { isModuleEnabled } = useCurrentCompany();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const hasDesktopWindowControls =
    typeof window !== 'undefined' &&
    typeof window.desktopWindow !== 'undefined';

  const handleSignOut = async () => {
    if (window.desktopAuth) {
      try {
        await window.desktopAuth.clearLocalState();
      } catch (error) {
        console.warn(
          '[desktop] Failed to clear local desktop auth state on sign out.',
          error
        );
      }
    }
    await signOut();
    window.location.href = '/auth/sign-in';
  };

  return (
    <header
      className={`fixed top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 [&_a]:[-webkit-app-region:no-drag] [&_button]:[-webkit-app-region:no-drag] ${hasDesktopWindowControls ? '[-webkit-app-region:drag]' : ''}`}
    >
      <div
        className={`flex h-14 items-center px-4 md:px-6 ${hasDesktopWindowControls ? 'md:pr-[136px]' : ''}`}
      >
        <div className="flex items-center gap-3 md:gap-6">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <div className="flex h-full flex-col">
                <div className="flex items-center gap-2 border-b px-4 py-3">
                  <img src="/logo.svg" alt="DevSuite" className="h-6 w-auto" />
                  <span className="text-sm font-semibold">DevSuite</span>
                </div>
                <div className="border-b px-4 py-3">
                  <CompanySwitcher />
                </div>
                <div className="flex-1 overflow-y-auto px-2 py-2">
                  <Sidebar
                    isCollapsed={false}
                    showToggle={false}
                    onItemSelect={() => setIsMobileMenuOpen(false)}
                    className="h-full"
                  />
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="DevSuite" className="h-8 w-auto" />
          </Link>
          <div className="hidden md:flex">
            <CompanySwitcher />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-1 sm:px-2 md:px-4">
          {isModuleEnabled('sessions') ? <SessionWidget showOnMobile /> : null}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <PrivacyModeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {session?.user.name || 'User'}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {session?.user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {hasDesktopWindowControls ? <WindowControls /> : null}
    </header>
  );
}
