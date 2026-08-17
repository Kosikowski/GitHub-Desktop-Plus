import { describe, it } from 'node:test'
import assert from 'node:assert'

import {
  resolveFavoriteGroupSelection,
  shouldActivateFavoriteGroup,
} from '../../src/lib/favorites-selection'
import { FavoriteGroup } from '../../src/models/favorite-group'
import { Repository } from '../../src/models/repository'
import { CloningRepository } from '../../src/models/cloning-repository'

const repository = (
  id: number,
  favoriteGroupId: number | null,
  missing = false
) =>
  new Repository(
    `/path/${id}`,
    id,
    null,
    missing,
    null,
    {},
    false,
    undefined,
    favoriteGroupId
  )

const group = (id: number, lastSelectedRepositoryId: number | null) =>
  new FavoriteGroup(id, `Group ${id}`, id, lastSelectedRepositoryId)

describe('resolveFavoriteGroupSelection', () => {
  it('returns null when there is no group', () => {
    const repositories = [repository(1, 10)]

    assert.equal(resolveFavoriteGroupSelection(null, repositories), null)
  })

  it('returns null when the group has never remembered a repository', () => {
    const repositories = [repository(1, 10)]

    assert.equal(
      resolveFavoriteGroupSelection(group(10, null), repositories),
      null
    )
  })

  it('returns the remembered repository', () => {
    const remembered = repository(1, 10)
    const repositories = [repository(2, 10), remembered]

    assert.equal(
      resolveFavoriteGroupSelection(group(10, 1), repositories),
      remembered
    )
  })

  it('returns a remembered repository that is missing from disk', () => {
    const remembered = repository(1, 10, true)

    assert.equal(
      resolveFavoriteGroupSelection(group(10, 1), [remembered]),
      remembered
    )
  })

  it('returns null when the remembered repository is gone', () => {
    const repositories = [repository(2, 10)]

    assert.equal(
      resolveFavoriteGroupSelection(group(10, 1), repositories),
      null
    )
  })

  it('returns null when the remembered repository moved to another group', () => {
    const repositories = [repository(1, 20)]

    assert.equal(
      resolveFavoriteGroupSelection(group(10, 1), repositories),
      null
    )
  })

  it('returns null when the remembered repository is no longer a favorite', () => {
    const repositories = [repository(1, null)]

    assert.equal(
      resolveFavoriteGroupSelection(group(10, 1), repositories),
      null
    )
  })

  it('ignores a cloning repository sharing the remembered id', () => {
    const cloning = new CloningRepository('/path/1', 'https://example.com/1')
    const repositories = [cloning]

    assert.equal(
      resolveFavoriteGroupSelection(group(10, cloning.id), repositories),
      null
    )
  })
})

describe('shouldActivateFavoriteGroup', () => {
  it('is false for a repository outside any group', () => {
    assert.equal(
      shouldActivateFavoriteGroup(repository(1, null), repository(2, 10)),
      false
    )
  })

  it('is true when another repository was selected', () => {
    assert.equal(
      shouldActivateFavoriteGroup(repository(1, 10), repository(2, 20)),
      true
    )
  })

  it('is true when nothing was selected before', () => {
    assert.equal(shouldActivateFavoriteGroup(repository(1, 10), null), true)
  })

  it('is true when a cloning repository was selected before', () => {
    const cloning = new CloningRepository('/path/1', 'https://example.com/1')

    assert.equal(shouldActivateFavoriteGroup(repository(1, 10), cloning), true)
  })

  it('is true when the current repository joined another group', () => {
    assert.equal(
      shouldActivateFavoriteGroup(repository(1, 10), repository(1, 20)),
      true
    )
  })

  it('is true when the current repository just became a favorite', () => {
    assert.equal(
      shouldActivateFavoriteGroup(repository(1, 10), repository(1, null)),
      true
    )
  })

  it('is false when the same repository is re-selected in the same group', () => {
    assert.equal(
      shouldActivateFavoriteGroup(repository(1, 10), repository(1, 10)),
      false
    )
  })
})
