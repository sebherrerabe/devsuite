import { Link } from '@tanstack/react-router';
import { CompanySwitcher } from './company-switcher';
import { PrivacyModeToggle } from './privacy-mode-toggle';
import { Button } from '@/components/ui/button';
import { authClient, signOut } from '@/lib/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, LogOut, Play } from 'lucide-react';

export function Header() {
  const { data: session } = authClient.useSession();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/auth/sign-in';
  };

  return (
    <header className="fixed top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 md:px-6">
        <div className="flex items-center gap-4 md:gap-8">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="DevSuite" className="h-8 w-auto" />
          </Link>
          <CompanySwitcher />
        </div>

        <div className="flex flex-1 items-center justify-center px-4">
          <Button
            variant="outline"
            size="sm"
            className="hidden h-8 gap-2 border-primary/20 font-mono text-xs md:flex"
          >
            <Play className="h-3 w-3 fill-current text-primary" />
            <span className="text-primary">00:23:15</span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">Task-123</span>
          </Button>
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
    </header>
  );
}
