/**
 * Synthetic id used in `SessionRecord.itemId` for free-play sessions. Free
 * play isn't backed by a real song or exercise — sessions written under this
 * id show up in the global stats heatmap and minutes chart but are silently
 * dropped from per-item rollups (PromotionVelocityTable, etc.).
 */
export const FREE_PLAY_ITEM_ID = "__freeplay__";
export const FREE_PLAY_ITEM_TITLE = "Free Play";
