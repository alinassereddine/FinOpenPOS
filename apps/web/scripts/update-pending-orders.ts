import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Updating all pending orders to completed...");
  const result = await db.update(orders).set({ status: "completed" }).where(eq(orders.status, "pending"));
  console.log("Update finished.");
  process.exit(0);
}

main().catch(console.error);
