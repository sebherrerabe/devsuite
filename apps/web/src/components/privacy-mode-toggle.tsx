import { usePrivacyMode } from '@/lib/privacy-mode-context';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function PrivacyModeToggle() {
  const { isPrivacyMode, togglePrivacyMode } = usePrivacyMode();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={togglePrivacyMode}
            className={isPrivacyMode ? 'text-primary' : 'text-muted-foreground'}
          >
            {isPrivacyMode ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {isPrivacyMode ? 'Disable Privacy Mode' : 'Enable Privacy Mode'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
