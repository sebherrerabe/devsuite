module.exports = {
  appId: 'com.devsuite.desktop',
  productName: 'DevSuite',
  executableName: 'DevSuite',
  directories: { output: 'out', buildResources: 'assets' },
  files: ['dist/**/*', 'renderer/**/*', 'package.json'],
  extraResources: [
    {
      from: 'assets',
      to: 'assets',
      filter: ['icon.ico', 'icon.png', 'hosts-write-helper.ps1'],
    },
  ],
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'assets/icon.ico',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    installerIcon: 'assets/icon.ico',
    uninstallerIcon: 'assets/icon.ico',
    installerHeader: 'assets/installer-header.bmp',
    installerSidebar: 'assets/installer-sidebar.bmp',
    shortcutName: 'DevSuite',
    include: 'assets/installer-custom.nsh',
  },
  asar: true,
  publish: [
    {
      provider: 'github',
      owner: 'sebherrerabe',
      repo: 'devsuite',
      releaseType: 'release',
      channel: 'latest',
    },
  ],
};
