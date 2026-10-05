/** A button the host adds to the Quest in-scene menu. */
export type StudioQuestMenuItem = {
    label: string;
    onPress: () => void;
};
/** Who writes to the store: each navigator passes a token of its own. */
export type StudioQuestMenuOwner = object;
/**
 * The navigator's `questMenuItems`, for the menu in StudioQuestSceneHudOverlay.
 * The scene runs in VRActivity's React root, which the navigator's props never
 * reach, so they cross here. The latest navigator to write owns the items, and
 * an older one unmounting leaves them alone.
 */
declare class QuestMenuStore {
    private items;
    private owner;
    private listeners;
    getItems(): readonly StudioQuestMenuItem[];
    subscribe(listener: () => void): () => void;
    set(items: readonly StudioQuestMenuItem[] | undefined, owner: StudioQuestMenuOwner): void;
    clear(owner: StudioQuestMenuOwner): void;
}
export declare const questMenuStore: QuestMenuStore;
export {};
