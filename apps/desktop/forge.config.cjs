const packageJson = require('./package.json');

const buildVersion = (
  process.env.DEVSUITE_DESKTOP_BUILD_VERSION || packageJson.version
).replace(/[^0-9A-Za-z.-]/g, '-');

module.exports = {
  packagerConfig: {
    asar: true,
    derefSymlinks: true,
    executableName: 'DevSuite',
    prune: false,
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'devsuite_desktop',
        setupExe: `DevSuite-${buildVersion}-Setup.exe`,
        noMsi: true,
      },
    },
  ],
};
