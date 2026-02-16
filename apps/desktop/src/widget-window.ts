import type { BrowserWindow as BrowserWindowType } from 'electron';

export interface WidgetWindowOptions {
  width: number;
  height: number;
  frame: boolean;
  transparent: boolean;
  resizable: boolean;
  minimizable: boolean;
  maximizable: boolean;
  alwaysOnTop: boolean;
  skipTaskbar: boolean;
  hasShadow: boolean;
  autoHideMenuBar: boolean;
  backgroundColor: string;
  icon: string;
  title: string;
  webPreferences: {
    preload: string;
    partition: string;
    additionalArguments: string[];
    contextIsolation: boolean;
    nodeIntegration: boolean;
    sandbox: boolean;
    webviewTag: boolean;
    webSecurity: boolean;
    allowRunningInsecureContent: boolean;
  };
}

export function getSessionWidgetWindowOptions(params: {
  iconPath: string;
  preloadPath: string;
  partition: string;
  additionalArguments: string[];
}): WidgetWindowOptions {
  return {
    width: 290,
    height: 180,
    frame: false,
    transparent: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    autoHideMenuBar: true,
    title: 'DevSuite Session Widget',
    backgroundColor: '#00000000',
    icon: params.iconPath,
    webPreferences: {
      preload: params.preloadPath,
      partition: params.partition,
      additionalArguments: params.additionalArguments,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  };
}

export function getBottomRightWidgetPosition(params: {
  workAreaSize: { width: number; height: number };
  windowSize: [number, number];
  marginPx?: number;
}): { x: number; y: number } {
  const marginPx = params.marginPx ?? 16;
  const [windowWidth, windowHeight] = params.windowSize;
  const x = params.workAreaSize.width - windowWidth - marginPx;
  const y = params.workAreaSize.height - windowHeight - marginPx;

  return {
    x,
    y,
  };
}

export function positionWidgetBottomRight(params: {
  window: BrowserWindowType;
  workAreaSize: { width: number; height: number };
}): void {
  const [rawWidth, rawHeight] = params.window.getSize();
  const windowWidth = rawWidth ?? 0;
  const windowHeight = rawHeight ?? 0;
  const position = getBottomRightWidgetPosition({
    workAreaSize: params.workAreaSize,
    windowSize: [windowWidth, windowHeight],
  });

  params.window.setPosition(position.x, position.y);
}
