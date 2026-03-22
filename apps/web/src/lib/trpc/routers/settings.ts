import { z } from "zod/v4";
import { protectedProcedure, router } from "../init";
import { db } from "@/lib/db";
import { storeSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const settingsRouter = router({
  getStoreSettings: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/settings/store",
        tags: ["Settings"],
        summary: "Get store settings",
      },
    })
    .input(z.void())
    .output(
      z.object({
        currency: z.string(),
        lbp_rate: z.number(),
      })
    )
    .query(async ({ ctx }) => {
      let settings = await db.query.storeSettings.findFirst({
        where: eq(storeSettings.user_uid, ctx.user.id),
      });

      if (!settings) {
        const [newSettings] = await db
          .insert(storeSettings)
          .values({
            user_uid: ctx.user.id,
          })
          .returning();
        settings = newSettings;
      }

      return {
        currency: settings.currency,
        lbp_rate: settings.lbp_rate,
      };
    }),

  updateStoreSettings: protectedProcedure
    .meta({
      openapi: {
        method: "PATCH",
        path: "/settings/store",
        tags: ["Settings"],
        summary: "Update store settings",
      },
    })
    .input(
      z.object({
        currency: z.string().optional(),
        lbp_rate: z.number().int().positive().optional(),
      })
    )
    .output(
      z.object({
        currency: z.string(),
        lbp_rate: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let settings = await db.query.storeSettings.findFirst({
        where: eq(storeSettings.user_uid, ctx.user.id),
      });

      if (!settings) {
        const [newSettings] = await db
          .insert(storeSettings)
          .values({
            user_uid: ctx.user.id,
            currency: input.currency ?? "USD",
            lbp_rate: input.lbp_rate ?? 89000,
          })
          .returning();
        settings = newSettings;
      } else {
        const [updatedSettings] = await db
          .update(storeSettings)
          .set({
            ...input,
            updated_at: new Date(),
          })
          .where(eq(storeSettings.user_uid, ctx.user.id))
          .returning();
        settings = updatedSettings;
      }

      return {
        currency: settings.currency,
        lbp_rate: settings.lbp_rate,
      };
    }),
});
