import type { BrowserWindow as BrowserWindowType, IpcMain } from 'electron';

export const DESKTOP_WINDOW_MINIMIZE_CHANNEL = 'desktop-window:minimize';
export const DESKTOP_WINDOW_MAXIMIZE_CHANNEL = 'desktop-window:maximize';
export const DESKTOP_WINDOW_CLOSE_CHANNEL = 'desktop-window:close';
export const DESKTOP_WINDOW_IS_MAXIMIZED_CHANNEL =
  'desktop-window:is-maximized';
export const DESKTOP_WINDOW_MAXIMIZE_CHANGED_CHANNEL =
  'desktop-window:maximize-changed';

interface ElectronEventLike {
  sender: unknown;
}

interface BrowserWindowLike {
  minimize: () => void;
  maximize: () => void;
  unmaximize: () => void;
  close: () => void;
  isMaximized: () => boolean;
}

interface BrowserWindowModuleLike {
  fromWebContents: (sender: unknown) => BrowserWindowLike | null;
}

export function registerDesktopWindowIpcHandlers(params: {
  ipcMain: IpcMain;
  browserWindowModule: BrowserWindowModuleLike;
}): void {
  params.ipcMain.handle(DESKTOP_WINDOW_MINIMIZE_CHANNEL, event => {
    params.browserWindowModule
      .fromWebContents((event as ElectronEventLike).sender)
      ?.minimize();
  });

  params.ipcMain.handle(DESKTOP_WINDOW_MAXIMIZE_CHANNEL, event => {
    const targetWindow = params.browserWindowModule.fromWebContents(
      (event as ElectronEventLike).sender
    );

    if (!targetWindow) {
      return;
    }

    if (targetWindow.isMaximized()) {
      targetWindow.unmaximize();
      return;
    }

    targetWindow.maximize();
  });

  params.ipcMain.handle(DESKTOP_WINDOW_CLOSE_CHANNEL, event => {
    params.browserWindowModule
      .fromWebContents((event as ElectronEventLike).sender)
      ?.close();
  });

  params.ipcMain.handle(DESKTOP_WINDOW_IS_MAXIMIZED_CHANNEL, event => {
    return (
      params.browserWindowModule
        .fromWebContents((event as ElectronEventLike).sender)
        ?.isMaximized() ?? false
    );
  });
}

export function wireDesktopWindowMaximizeEvents(params: {
  window: BrowserWindowType;
}): void {
  params.window.on('maximize', () => {
    params.window.webContents.send(
      DESKTOP_WINDOW_MAXIMIZE_CHANGED_CHANNEL,
      true
    );
  });
  params.window.on('unmaximize', () => {
    params.window.webContents.send(
      DESKTOP_WINDOW_MAXIMIZE_CHANGED_CHANNEL,
      false
    );
  });
}
