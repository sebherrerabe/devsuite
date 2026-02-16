export interface DesktopWindowApiShape {
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onMaximizeChange: (
    listener: (maximized: boolean) => void | Promise<void>
  ) => () => void;
}

export function resolveDesktopWindowApi(
  runtimeWindow: (Window & typeof globalThis) | undefined
): DesktopWindowApiShape | null {
  if (!runtimeWindow || !runtimeWindow.desktopWindow) {
    return null;
  }

  return runtimeWindow.desktopWindow;
}

export function getMaximizeButtonAriaLabel(isMaximized: boolean): string {
  return isMaximized ? 'Restore window' : 'Maximize window';
}

export async function triggerWindowAction(params: {
  api: DesktopWindowApiShape;
  action: 'minimize' | 'maximize' | 'close';
}): Promise<void> {
  await params.api[params.action]();
}
