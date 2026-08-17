import { FavoriteGroup } from '../models/favorite-group'
import { Repository } from '../models/repository'
import { CloningRepository } from '../models/cloning-repository'

/**
 * Whether selecting the given repository should bring its favorites group to
 * the front of the sidebar.
 */
export function shouldActivateFavoriteGroup(
  repository: Repository,
  previouslySelectedRepository: Repository | CloningRepository | null
): boolean {
  if (repository.favoriteGroupId === null) {
    return false
  }

  // Re-selecting the repository that's already current (a refresh of its
  // GitHub metadata, say) mustn't drag the sidebar back to its group — the
  // user may have moved to another tab meanwhile. A change of membership
  // still counts, so pinning the current repository to a group follows it.
  return !(
    previouslySelectedRepository instanceof Repository &&
    previouslySelectedRepository.id === repository.id &&
    previouslySelectedRepository.favoriteGroupId === repository.favoriteGroupId
  )
}

/**
 * Resolve the repository to select when a favorites group becomes active.
 *
 * Returns null whenever the group has no remembered repository, or the
 * remembered one is gone or no longer a member of the group — the caller is
 * then expected to leave the current selection alone. Repositories missing
 * from disk are still returned; they're selectable everywhere else in the app.
 */
export function resolveFavoriteGroupSelection(
  group: FavoriteGroup | null,
  repositories: ReadonlyArray<Repository | CloningRepository>
): Repository | null {
  if (group === null || group.lastSelectedRepositoryId === null) {
    return null
  }

  const repository = repositories.find(
    r => r instanceof Repository && r.id === group.lastSelectedRepositoryId
  )

  if (!(repository instanceof Repository)) {
    return null
  }

  return repository.favoriteGroupId === group.id ? repository : null
}
