import * as React from 'react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { useTheme } from 'next-themes';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Smile } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmojiPickerWrapperProps {
  onChange: (emoji: string) => void;
  value?: string;
  disabled?: boolean;
  className?: string;
}

export function EmojiPickerWrapper({
  onChange,
  value,
  disabled,
  className,
}: EmojiPickerWrapperProps) {
  const { resolvedTheme } = useTheme();
  const [open, setOpen] = React.useState(false);

  const onEmojiClick = (emojiData: { emoji: string }) => {
    onChange(emojiData.emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-start text-left font-normal',
            className
          )}
          disabled={disabled}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl leading-none flex items-center justify-center">
              {value || <Smile className="h-4 w-4 text-muted-foreground" />}
            </span>
            <span className="text-muted-foreground text-sm truncate">
              {value ? null : 'Pick an icon'}
            </span>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-full p-0 border-none bg-transparent shadow-none"
        align="start"
      >
        <EmojiPicker
          theme={resolvedTheme === 'dark' ? Theme.DARK : Theme.LIGHT}
          onEmojiClick={onEmojiClick}
          width="100%"
          lazyLoadEmojis
        />
      </PopoverContent>
    </Popover>
  );
}
