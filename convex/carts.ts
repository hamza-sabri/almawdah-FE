/**
 * Realtime POS cart state (one document per account).
 *
 * Written with the codegen-free `*Generic` helpers so the Next.js build never
 * depends on `convex/_generated` — `npx convex dev` still validates & deploys
 * these normally.
 */
import {
  mutationGeneric as mutation,
  queryGeneric as query,
} from "convex/server"
import { v } from "convex/values"

export const get = query({
  args: { accountId: v.string() },
  handler: async (ctx, { accountId }) => {
    return await ctx.db
      .query("cartStates")
      .withIndex("by_account", (q: any) => q.eq("accountId", accountId))
      .unique()
  },
})

export const put = mutation({
  args: { accountId: v.string(), data: v.any(), savedAt: v.number() },
  handler: async (ctx, { accountId, data, savedAt }) => {
    const existing = await ctx.db
      .query("cartStates")
      .withIndex("by_account", (q: any) => q.eq("accountId", accountId))
      .unique()
    // Last write wins, but never let an older snapshot clobber a newer one.
    if (existing) {
      if (savedAt >= (existing.savedAt ?? 0)) {
        await ctx.db.patch(existing._id, { data, savedAt })
      }
      return
    }
    await ctx.db.insert("cartStates", { accountId, data, savedAt })
  },
})
