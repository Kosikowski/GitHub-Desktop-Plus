/**
 * Tag discovery functions, extracted from run.ts for use by ci.ts.
 * This avoids pulling in run.ts's full dependency chain when only
 * tag discovery is needed.
 */
import { sort as semverSort } from 'semver'
import { sh } from '../sh'

/**
 * Returns the latest release tag, according to git and semver.
 *
 * @param options.excludeBetaReleases - when true, filters out beta release tags
 * @param options.excludeTestReleases - when true, filters out test release tags
 * @param options.excludePlusReleases - when true, filters out plus release tags
 * @param options.onlyBetaReleases - when true, returns only beta release tags
 * @param options.onlyPlusReleases - when true, returns only plus release tags
 */
export async function getLatestRelease(options: {
  excludeBetaReleases: boolean
  excludeTestReleases: boolean
  excludePlusReleases?: boolean
  onlyBetaReleases?: boolean
  onlyPlusReleases?: boolean
}): Promise<string> {
  if (options.excludeBetaReleases && options.onlyBetaReleases) {
    throw new Error('Cannot set both excludeBetaReleases and onlyBetaReleases')
  }
  if (options.excludePlusReleases && options.onlyPlusReleases) {
    throw new Error('Cannot set both excludePlusReleases and onlyPlusReleases')
  }
  if (options.onlyBetaReleases && options.onlyPlusReleases) {
    throw new Error('Cannot set both onlyBetaReleases and onlyPlusReleases')
  }

  let releaseTags = (await sh('git', 'tag'))
    .split('\n')
    .filter(tag => tag.startsWith('release-'))
    .filter(tag => !tag.includes('-linux'))

  if (options.onlyBetaReleases) {
    releaseTags = releaseTags.filter(tag => tag.includes('-beta'))
  } else if (options.excludeBetaReleases) {
    releaseTags = releaseTags.filter(tag => !tag.includes('-beta'))
  }

  if (options.excludeTestReleases) {
    releaseTags = releaseTags.filter(tag => !tag.includes('-test'))
  }

  if (options.onlyPlusReleases) {
    releaseTags = releaseTags.filter(tag => tag.includes('-plus.'))
  } else if (options.excludePlusReleases) {
    releaseTags = releaseTags.filter(tag => !tag.includes('-plus.'))
  }

  const releaseVersions = releaseTags.map(tag => tag.substring(8))

  const sortedTags = semverSort(releaseVersions)
  const latestTag = sortedTags.at(-1)

  if (latestTag == null) {
    throw new Error('No matching release tags found')
  }

  return String(latestTag)
}

/**
 * Returns the latest non-prerelease, non-draft release tag on
 * desktop/desktop with the leading `release-` prefix stripped
 * (e.g. `'3.5.8'`).
 *
 * Uses the `gh` CLI; in CI the workflow's GITHUB_TOKEN authenticates it,
 * locally the developer's `gh auth login` does.
 */
export async function getUpstreamLatestStable(): Promise<string> {
  const json = await sh(
    'gh',
    'release',
    'list',
    '--repo',
    'desktop/desktop',
    '--limit',
    '30',
    '--json',
    'tagName,isPrerelease,isDraft'
  )

  const releases: ReadonlyArray<{
    tagName: string
    isPrerelease: boolean
    isDraft: boolean
  }> = JSON.parse(json)

  const latest = releases.find(r => !r.isPrerelease && !r.isDraft)
  if (latest == null) {
    throw new Error(
      'Could not find a latest non-prerelease release on desktop/desktop'
    )
  }

  return latest.tagName.replace(/^release-/, '')
}
