import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * One row per store account: the cashier's open POS carts.
 * Convex pushes changes to every subscribed device instantly — a scan on the
 * phone shows up on the desktop cart without a refresh.
 */
export default defineSchema({
  cartStates: defineTable({
    accountId: v.string(),
    data: v.any(),
    savedAt: v.number(),
  }).index("by_account", ["accountId"]),
})
