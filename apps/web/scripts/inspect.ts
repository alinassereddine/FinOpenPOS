import { db } from "@/lib/db";
import { customers, paymentMethods, orders } from "@/lib/db/schema";
import { eq, like, inArray } from "drizzle-orm";

async function main() {
  const walkedInCustomers = await db.query.customers.findMany({
    where: like(customers.name, "%Walked%"),
  });
  console.log("Walked-in customers:", walkedInCustomers);

  const methods = await db.query.paymentMethods.findMany();
  console.log("Payment methods:", methods);

  // keep the first walked in customer, delete the rest
  if (walkedInCustomers.length > 1) {
    const keepId = walkedInCustomers[0].id;
    const deleteIds = walkedInCustomers.slice(1).map(c => c.id);
    console.log("Keeping ID:", keepId, "Deleting IDs:", deleteIds);
    
    // First update any orders that might point to the deleted IDs
    await db.update(orders).set({ customer_id: keepId }).where(inArray(orders.customer_id, deleteIds));
    await db.delete(customers).where(inArray(customers.id, deleteIds));
    console.log("Deleted duplicate customers.");
  }
}

main().catch(console.error).finally(() => process.exit(0));
