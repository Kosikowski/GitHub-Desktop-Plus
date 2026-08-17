/** A user-defined favorites group displayed as a tab in the sidebar. */
export class FavoriteGroup {
  public constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly sortOrder: number,
    /**
     * The repository that was last selected while it belonged to this group,
     * or null if the group has never had one selected. Switching to the group
     * restores this repository.
     */
    public readonly lastSelectedRepositoryId: number | null = null
  ) {}
}
