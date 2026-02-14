import { Badge } from '@/components/ui/badge';

interface GreetingBarProps {
  userName: string;
  companyName: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function GreetingBar({ userName, companyName }: GreetingBarProps) {
  const firstName = userName.split(' ')[0] || userName;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground">{getFormattedDate()}</p>
        </div>
        <Badge variant="secondary" className="text-xs">
          {companyName}
        </Badge>
      </div>
      <div className="h-0.5 w-full rounded-full bg-linear-to-r from-primary via-chart-2 to-chart-5 opacity-60" />
    </div>
  );
}
