import { z } from "zod/v4";
import { protectedProcedure, router } from "../init";
import { db } from "@/lib/db";
import { TRPCError } from "@trpc/server";
import { customers, orders } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";

const customerSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  status: z.string().nullable(),
  user_uid: z.string(),
  created_at: z.date().nullable(),
});

const customerDetailsSchema = customerSchema.extend({
  totalOrders: z.number(),
  totalSpent: z.number(),
  orders: z.array(
    z.object({
      id: z.number(),
      total_amount: z.number(),
      status: z.string().nullable(),
      created_at: z.date().nullable(),
      orderItems: z.array(
        z.object({
          id: z.number(),
          quantity: z.number(),
          price: z.number(),
          discount: z.number(),
          product: z.object({
            name: z.string(),
            category: z.string().nullable(),
          }).nullable(),
        })
      ).optional(),
    })
  ),
});

export const customersRouter = router({
  list: protectedProcedure
    .meta({ openapi: { method: "GET", path: "/customers", tags: ["Customers"], summary: "List all customers" } })
    .input(z.void())
    .output(z.array(customerSchema))
    .query(async ({ ctx }) => {
      return db
        .select()
        .from(customers)
        .where(eq(customers.user_uid, ctx.user.id))
        .orderBy(asc(customers.name));
    }),

  getDetails: protectedProcedure
    .meta({ openapi: { method: "GET", path: "/customers/{id}/details", tags: ["Customers"], summary: "Get customer details and history" } })
    .input(z.object({ id: z.number() }))
    .output(customerDetailsSchema)
    .query(async ({ ctx, input }) => {
      const customer = await db.query.customers.findFirst({
        where: and(eq(customers.id, input.id), eq(customers.user_uid, ctx.user.id)),
      });

      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      }

      const customerOrders = await db.query.orders.findMany({
        where: and(eq(orders.customer_id, input.id), eq(orders.user_uid, ctx.user.id)),
        orderBy: (orders, { desc }) => [desc(orders.created_at)],
        with: {
          orderItems: {
            with: {
              product: {
                columns: { name: true, category: true },
              },
            },
          },
        },
      });

      const completedOrders = customerOrders.filter((o) => o.status === "completed");
      const totalSpent = completedOrders.reduce((sum, o) => sum + o.total_amount, 0);
      const totalOrders = completedOrders.length;

      return {
        ...customer,
        totalOrders,
        totalSpent,
        orders: customerOrders,
      };
    }),

  create: protectedProcedure
    .meta({ openapi: { method: "POST", path: "/customers", tags: ["Customers"], summary: "Create a customer" } })
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        status: z.enum(["active", "inactive"]).optional(),
      })
    )
    .output(customerSchema)
    .mutation(async ({ ctx, input }) => {
      const [data] = await db
        .insert(customers)
        .values({ ...input, user_uid: ctx.user.id })
        .returning();
      return data;
    }),

  update: protectedProcedure
    .meta({ openapi: { method: "PATCH", path: "/customers/{id}", tags: ["Customers"], summary: "Update a customer" } })
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        status: z.enum(["active", "inactive"]).optional(),
      })
    )
    .output(customerSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [updated] = await db
        .update(customers)
        .set({ ...data, user_uid: ctx.user.id })
        .where(and(eq(customers.id, id), eq(customers.user_uid, ctx.user.id)))
        .returning();
      return updated;
    }),

  delete: protectedProcedure
    .meta({ openapi: { method: "DELETE", path: "/customers/{id}", tags: ["Customers"], summary: "Delete a customer" } })
    .input(z.object({ id: z.number() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(customers)
        .where(and(eq(customers.id, input.id), eq(customers.user_uid, ctx.user.id)));
      return { success: true };
    }),
});
