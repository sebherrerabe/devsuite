import React from 'react';
import { Copy, Minus, Square, X } from 'lucide-react';
import {
  getMaximizeButtonAriaLabel,
  resolveDesktopWindowApi,
  triggerWindowAction,
} from './window-controls-helpers';

export function WindowControls() {
  const { useEffect, useMemo, useState } = React;
  const desktopWindow = useMemo(
    () =>
      resolveDesktopWindowApi(
        typeof window === 'undefined' ? undefined : window
      ),
    []
  );
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!desktopWindow) {
      return;
    }

    let disposed = false;

    void desktopWindow.isMaximized().then(value => {
      if (!disposed) {
        setIsMaximized(Boolean(value));
      }
    });

    const unsubscribe = desktopWindow.onMaximizeChange(nextValue => {
      setIsMaximized(Boolean(nextValue));
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [desktopWindow]);

  if (!desktopWindow) {
    return null;
  }

  return (
    <div
      className="absolute right-2 top-2 z-50 flex items-center gap-1 [-webkit-app-region:no-drag]"
      data-testid="window-controls"
    >
      <button
        type="button"
        aria-label="Minimize window"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
        onClick={() => {
          void triggerWindowAction({
            api: desktopWindow,
            action: 'minimize',
          });
        }}
      >
        <Minus className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={getMaximizeButtonAriaLabel(isMaximized)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
        onClick={() => {
          void triggerWindowAction({
            api: desktopWindow,
            action: 'maximize',
          });
        }}
      >
        {isMaximized ? (
          <Copy className="h-4 w-4" />
        ) : (
          <Square className="h-4 w-4" />
        )}
      </button>
      <button
        type="button"
        aria-label="Close window"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive hover:text-destructive-foreground"
        onClick={() => {
          void triggerWindowAction({
            api: desktopWindow,
            action: 'close',
          });
        }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
