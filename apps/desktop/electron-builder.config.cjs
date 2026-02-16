module.exports = {
  appId: 'com.devsuite.desktop',
  productName: 'DevSuite',
  directories: { output: 'out', buildResources: 'assets' },
  files: ['dist/**/*', 'renderer/**/*', 'package.json'],
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'assets/icon.ico',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopIcon: true,
    createStartMenuShortcut: true,
    installerIcon: 'assets/icon.ico',
    uninstallerIcon: 'assets/icon.ico',
    installerHeader: 'assets/installer-header.bmp',
    installerSidebar: 'assets/installer-sidebar.bmp',
    shortcutName: 'DevSuite',
  },
  asar: true,
};
