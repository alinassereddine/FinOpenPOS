import { pglite, db } from "../src/lib/db";
import { products, productCategories } from "../src/lib/db/schema";
import { sql, eq, isNull } from "drizzle-orm";

async function migrate() {
  console.log("Starting category migration...");

  try {
    // 1. Create product_categories table if it doesn't exist
    // drizzle-kit push usually does this, but we'll be safe
    await pglite.query(`
      CREATE TABLE IF NOT EXISTS product_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        user_uid VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 2. Add category_id to products if it doesn't exist
    try {
      await pglite.query(`ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES product_categories(id)`);
      console.log("Added category_id column to products.");
    } catch (e) {
      console.log("category_id column already exists or failed to add.");
    }

    // 3. Get unique categories from products
    const allProducts = await db.select().from(products);
    console.log(`Found ${allProducts.length} products.`);

    const uniqueCategories = Array.from(new Set(allProducts.map(p => (p as any).category).filter(Boolean)));
    console.log(`Unique categories found: ${uniqueCategories.join(", ")}`);

    for (const catName of uniqueCategories) {
      // Find users who have this category
      const users = Array.from(new Set(allProducts.filter(p => (p as any).category === catName).map(p => p.user_uid)));
      
      for (const userUid of users) {
        // Create the category for this user if it doesn't exist
        console.log(`Creating category "${catName}" for user ${userUid}...`);
        
        let [cat] = await db.insert(productCategories).values({
          name: catName!,
          user_uid: userUid,
        }).returning();

        // Update products
        console.log(`Updating products in category "${catName}"...`);
        await db.update(products)
          .set({ category_id: cat.id })
          .where(eq((products as any).category, catName!));
      }
    }

    // 4. Drop the old category column
    try {
      await pglite.query(`ALTER TABLE products DROP COLUMN category`);
      console.log("Dropped old category column.");
    } catch (e) {
      console.log("Failed to drop category column (might be already gone).");
    }

    console.log("Migration finished successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    process.exit(0);
  }
}

migrate();
