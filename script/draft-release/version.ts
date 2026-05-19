import { compare, inc, parse, SemVer } from 'semver'

import { Channel } from './channel'

function isBetaTag(version: SemVer) {
  return version.prerelease.some(
    p => typeof p === 'string' && p.startsWith('beta')
  )
}

function isTestTag(version: SemVer) {
  return version.prerelease.some(
    p => typeof p === 'string' && p.startsWith('test')
  )
}

function tryGetBetaNumber(version: SemVer): number | null {
  if (isBetaTag(version)) {
    const tag = version.prerelease[0]
    const text = tag.substring(4)
    const betaNumber = parseInt(text, 10)
    return isNaN(betaNumber) ? null : betaNumber
  }

  return null
}

function isPlusTag(version: SemVer) {
  return version.prerelease[0] === 'plus'
}

function tryGetPlusNumber(version: SemVer): number | null {
  if (isPlusTag(version) && typeof version.prerelease[1] === 'number') {
    return version.prerelease[1]
  }
  return null
}

export function getNextVersionNumber(
  version: string,
  channel: Channel
): string {
  const semanticVersion = parse(version)

  if (semanticVersion == null) {
    throw new Error(`Unable to parse input '${version}' into version`)
  }

  switch (channel) {
    case 'production':
      if (isBetaTag(semanticVersion)) {
        throw new Error(
          `Unable to draft production release using beta version '${version}'`
        )
      }

      if (isTestTag(semanticVersion)) {
        throw new Error(
          `Unable to draft production release using test version '${version}'`
        )
      }

      const nextVersion = inc(version, 'patch')
      if (nextVersion == null) {
        throw new Error(
          `Unable to increment next production version from release version '${version}'`
        )
      }

      return nextVersion

    case 'beta':
      if (isTestTag(semanticVersion)) {
        throw new Error(
          `Unable to draft beta release using test version '${version}'`
        )
      }

      const betaNumber = tryGetBetaNumber(semanticVersion)

      if (betaNumber) {
        return semanticVersion.version.replace(
          `-beta${betaNumber}`,
          `-beta${betaNumber + 1}`
        )
      } else {
        const nextVersion = inc(semanticVersion, 'patch')
        const firstBeta = `${nextVersion}-beta1`
        return firstBeta
      }
    case 'test':
      if (isBetaTag(semanticVersion)) {
        throw new Error(
          `Unable to draft test release using beta version '${version}'`
        )
      }

      if (isTestTag(semanticVersion)) {
        const tag = semanticVersion.prerelease[0]
        const text = tag.substring(4)
        const testNumber = parseInt(text, 10)
        return semanticVersion.version.replace(
          `-test${testNumber}`,
          `-test${testNumber + 1}`
        )
      } else {
        const nextVersion = inc(semanticVersion, 'patch')
        const firstTest = `${nextVersion}-test1`
        return firstTest
      }
    case 'plus':
      if (isBetaTag(semanticVersion)) {
        throw new Error(
          `Unable to draft plus release using beta version '${version}'`
        )
      }

      if (isTestTag(semanticVersion)) {
        throw new Error(
          `Unable to draft plus release using test version '${version}'`
        )
      }

      const plusNumber = tryGetPlusNumber(semanticVersion)
      if (plusNumber !== null) {
        return semanticVersion.version.replace(
          `-plus.${plusNumber}`,
          `-plus.${plusNumber + 1}`
        )
      } else {
        const nextVersion = inc(semanticVersion, 'patch')
        return `${nextVersion}-plus.1`
      }
    default:
      throw new Error(
        `Resolving the next version is not implemented for channel ${channel}`
      )
  }
}

/**
 * Computes the next plus release version under the policy that plus
 * releases are always cut from upstream stable and share its X.Y.Z.
 *
 * - No previous plus tag → `${upstreamStable}-plus.1`
 * - Previous plus base < upstream stable → `${upstreamStable}-plus.1`
 * - Previous plus base == upstream stable → bump N
 * - Previous plus base > upstream stable → throw (a plus tag exists for
 *   a version upstream hasn't shipped as stable yet; wait for upstream)
 */
export function getNextPlusVersion(
  previousPlus: string | null,
  upstreamStable: string
): string {
  const upstreamSv = parse(upstreamStable)
  if (upstreamSv == null) {
    throw new Error(
      `Unable to parse upstream stable version '${upstreamStable}'`
    )
  }
  if (upstreamSv.prerelease.length > 0) {
    throw new Error(
      `Upstream stable must not be a prerelease: '${upstreamStable}'`
    )
  }

  if (previousPlus == null) {
    return `${upstreamStable}-plus.1`
  }

  const previousSv = parse(previousPlus)
  if (previousSv == null) {
    throw new Error(`Unable to parse previous plus version '${previousPlus}'`)
  }
  if (!isPlusTag(previousSv)) {
    throw new Error(
      `Previous version '${previousPlus}' is not a plus release tag`
    )
  }

  const previousBase = `${previousSv.major}.${previousSv.minor}.${previousSv.patch}`
  const cmp = compare(previousBase, upstreamStable)

  if (cmp < 0) {
    return `${upstreamStable}-plus.1`
  }

  if (cmp === 0) {
    const n = tryGetPlusNumber(previousSv)
    if (n == null) {
      throw new Error(
        `Unable to read plus number from previous version '${previousPlus}'`
      )
    }
    return `${upstreamStable}-plus.${n + 1}`
  }

  throw new Error(
    `Cannot draft a plus release: latest plus tag '${previousPlus}' is ` +
      `anchored on ${previousBase}, which is ahead of the latest upstream ` +
      `stable ${upstreamStable}. Wait for desktop/desktop to release ` +
      `${previousBase} (or newer) as stable.`
  )
}
