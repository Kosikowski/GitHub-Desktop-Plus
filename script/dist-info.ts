import * as Path from 'path'
import * as Fs from 'fs'

import { getProductName, getVersion } from '../app/package-info'
import { join } from 'path'

const productName = getProductName()
const version = getVersion()

const projectRoot = Path.join(__dirname, '..')

export function getDistRoot() {
  return Path.join(projectRoot, 'dist')
}

export function getDistPath() {
  return Path.join(
    getDistRoot(),
    `${getExecutableName()}-${process.platform}-${getDistArchitecture()}`
  )
}

export function getExecutableName() {
  const suffix = process.env.NODE_ENV === 'development' ? '-dev' : ''

  if (process.platform === 'win32') {
    return `${getWindowsIdentifierName()}${suffix}`
  } else if (process.platform === 'linux') {
    return 'desktop'
  } else {
    return productName
  }
}

export function getOSXZipName() {
  return `${productName}-${getDistArchitecture()}.zip`
}

export function getOSXZipPath() {
  return Path.join(getDistPath(), '..', getOSXZipName())
}

export function getWindowsInstallerName() {
  const productName = getExecutableName()
  return `${productName}Setup-${getDistArchitecture()}.msi`
}

export function getWindowsInstallerPath() {
  return Path.join(getDistPath(), '..', 'installer', getWindowsInstallerName())
}

export function getWindowsStandaloneName() {
  const productName = getExecutableName()
  return `${productName}Setup-${getDistArchitecture()}.exe`
}

export function getWindowsStandalonePath() {
  return Path.join(getDistPath(), '..', 'installer', getWindowsStandaloneName())
}

/**
 * The NuGet-compatible form of the app version that Squirrel.Windows uses
 * when naming package files: dots in the prerelease part are stripped
 * (3.6.4-plus.1 becomes 3.6.4-plus1), mirroring electron-winstaller's
 * convertVersion.
 */
export function getNuGetVersion() {
  const [mainVersion, ...preRelease] = version.split('-')
  return preRelease.length === 0
    ? mainVersion
    : `${mainVersion}-${preRelease.join('-').replace(/\./g, '')}`
}

export function getWindowsFullNugetPackageName(
  includeArchitecture: boolean = false
) {
  const architectureInfix = includeArchitecture
    ? `-${getDistArchitecture()}`
    : ''
  return `${getWindowsIdentifierName()}-${getNuGetVersion()}${architectureInfix}-full.nupkg`
}

export function getWindowsFullNugetPackagePath() {
  return Path.join(
    getDistPath(),
    '..',
    'installer',
    getWindowsFullNugetPackageName()
  )
}

export function getWindowsDeltaNugetPackageName(
  includeArchitecture: boolean = false
) {
  const architectureInfix = includeArchitecture
    ? `-${getDistArchitecture()}`
    : ''
  return `${getWindowsIdentifierName()}-${getNuGetVersion()}${architectureInfix}-delta.nupkg`
}

export function getWindowsDeltaNugetPackagePath() {
  return Path.join(
    getDistPath(),
    '..',
    'installer',
    getWindowsDeltaNugetPackageName()
  )
}

export function getWindowsIdentifierName() {
  return 'GitHubDesktopPlus'
}

export function getBundleSizes() {
  const outPath = Path.join(projectRoot, 'out')
  return {
    // eslint-disable-next-line no-sync
    rendererBundleSize: Fs.statSync(Path.join(outPath, 'renderer.js')).size,
    // eslint-disable-next-line no-sync
    mainBundleSize: Fs.statSync(Path.join(outPath, 'main.js')).size,
  }
}
export const isPublishable = () =>
  ['production', 'beta', 'test'].includes(getChannel())

export const getChannel = () =>
  process.env.RELEASE_CHANNEL ?? process.env.NODE_ENV ?? 'development'

export function getDistArchitecture(): 'arm64' | 'x64' {
  // If a specific npm_config_arch is set, we use that one instead of the OS arch (to support cross compilation)
  if (
    process.env.npm_config_arch === 'arm64' ||
    process.env.npm_config_arch === 'x64'
  ) {
    return process.env.npm_config_arch
  }

  if (process.arch === 'arm64') {
    return 'arm64'
  }

  // TODO: Check if it's x64 running on an arm64 Windows with IsWow64Process2
  // More info: https://www.rudyhuyn.com/blog/2017/12/13/how-to-detect-that-your-x86-application-runs-on-windows-on-arm/
  // Right now (March 3, 2021) is not very important because support for x64
  // apps on an arm64 Windows is experimental. See:
  // https://blogs.windows.com/windows-insider/2020/12/10/introducing-x64-emulation-in-preview-for-windows-10-on-arm-pcs-to-the-windows-insider-program/

  return 'x64'
}

export function getUpdatesURL() {
  // Served by https://update.electronjs.org — a free Squirrel-compatible
  // feed that proxies GitHub Releases. It returns the latest non-prerelease
  // release, so betas/test builds (marked as prereleases on the GitHub
  // Releases page) are not offered as updates here; plus and production
  // releases are.
  return `https://update.electronjs.org/Kosikowski/GitHub-Desktop-Plus/${
    process.platform
  }-${getDistArchitecture()}/${version}`
}

export function shouldMakeDelta() {
  // Only production and beta channels include deltas. Test releases aren't
  // necessarily sequential so deltas wouldn't make sense.
  return ['production', 'beta'].includes(getChannel())
}

/**
 * Path to the directory containing all icon assets for the current release channel.
 */
export function getIconDirectory() {
  const devOrProd = getChannel() === 'development' ? 'dev' : 'prod'
  return join(projectRoot, 'app', 'static', 'logos', devOrProd)
}

export function getChannelFromReleaseBranch(): string {
  const branchName = process.env.GITHUB_HEAD_REF ?? ''

  if (!branchName.includes('releases/')) {
    return 'development'
  }

  if (getVersion().includes('test')) {
    return 'test'
  }

  if (getVersion().includes('beta')) {
    return 'beta'
  }

  if (getVersion().includes('plus')) {
    return 'plus'
  }

  return 'production'
}
