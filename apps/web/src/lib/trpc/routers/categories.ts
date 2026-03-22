import { z } from "zod/v4";
import { protectedProcedure, router } from "../init";
import { db } from "@/lib/db";
import { productCategories, products } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const categorySchema = z.object({
  id: z.number(),
  name: z.string().min(1),
  user_uid: z.string(),
  created_at: z.date().nullable(),
});

export const categoriesRouter = router({
  list: protectedProcedure
    .meta({ openapi: { method: "GET", path: "/categories", tags: ["Categories"], summary: "List all categories" } })
    .input(z.void())
    .output(z.array(categorySchema))
    .query(async ({ ctx }) => {
      return db
        .select()
        .from(productCategories)
        .where(eq(productCategories.user_uid, ctx.user.id))
        .orderBy(asc(productCategories.name));
    }),

  create: protectedProcedure
    .meta({ openapi: { method: "POST", path: "/categories", tags: ["Categories"], summary: "Create a category" } })
    .input(z.object({ name: z.string().min(1) }))
    .output(categorySchema)
    .mutation(async ({ ctx, input }) => {
      const [data] = await db
        .insert(productCategories)
        .values({
          name: input.name,
          user_uid: ctx.user.id,
        })
        .returning();
      return data;
    }),

  update: protectedProcedure
    .meta({ openapi: { method: "PATCH", path: "/categories/{id}", tags: ["Categories"], summary: "Update a category" } })
    .input(z.object({ id: z.number(), name: z.string().min(1) }))
    .output(categorySchema)
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(productCategories)
        .set({ name: input.name })
        .where(and(eq(productCategories.id, input.id), eq(productCategories.user_uid, ctx.user.id)))
        .returning();
      
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
      }
      return updated;
    }),

  delete: protectedProcedure
    .meta({ openapi: { method: "DELETE", path: "/categories/{id}", tags: ["Categories"], summary: "Delete a category" } })
    .input(z.object({ id: z.number() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      // Set category_id to null for products in this category before deleting
      await db
        .update(products)
        .set({ category_id: null })
        .where(and(eq(products.category_id, input.id), eq(products.user_uid, ctx.user.id)));

      const result = await db
        .delete(productCategories)
        .where(and(eq(productCategories.id, input.id), eq(productCategories.user_uid, ctx.user.id)));
      
      return { success: true };
    }),
});
