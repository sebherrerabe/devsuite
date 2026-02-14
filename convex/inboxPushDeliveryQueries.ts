import { internalQuery } from './_generated/server';
import { v } from 'convex/values';

export const getInboxItemForPush = internalQuery({
  args: {
    companyId: v.id('companies'),
    inboxItemId: v.id('inboxItems'),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.inboxItemId);
    if (!item || item.deletedAt !== null) {
      return null;
    }
    if (item.companyId !== args.companyId) {
      return null;
    }
    return item;
  },
});
