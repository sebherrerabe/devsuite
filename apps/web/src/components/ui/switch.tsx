import * as React from 'react';
import { cn } from '@/lib/utils';

interface SwitchProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange'
> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      className,
      checked,
      defaultChecked = false,
      onCheckedChange,
      disabled,
      ...props
    },
    ref
  ) => {
    const [uncontrolledChecked, setUncontrolledChecked] =
      React.useState(defaultChecked);
    const isControlled = checked !== undefined;
    const value = isControlled ? checked : uncontrolledChecked;

    const handleClick = React.useCallback(() => {
      if (disabled) {
        return;
      }
      const next = !value;
      if (!isControlled) {
        setUncontrolledChecked(next);
      }
      onCheckedChange?.(next);
    }, [disabled, isControlled, onCheckedChange, value]);

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        data-state={value ? 'checked' : 'unchecked'}
        className={cn(
          'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          value ? 'bg-primary' : 'bg-input',
          className
        )}
        onClick={handleClick}
        {...props}
      >
        <span
          data-state={value ? 'checked' : 'unchecked'}
          className={cn(
            'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-sm ring-0 transition-transform',
            value ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    );
  }
);

Switch.displayName = 'Switch';

export { Switch };
