import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function readFile(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf-8");
}

function writeFile(relativePath: string, content: string): void {
  writeFileSync(join(ROOT, relativePath), content, "utf-8");
}

function deleteFile(relativePath: string): void {
  const fullPath = join(ROOT, relativePath);
  if (existsSync(fullPath)) {
    unlinkSync(fullPath);
    console.log(`  Deleted ${relativePath}`);
  }
}

async function main() {
  console.log("\n=== prepare-prod: Converting PGLite → PostgreSQL ===\n");

  // Step 1: Install pg, remove pglite
  console.log("1. Installing pg and removing @electric-sql/pglite...");
  execSync(`npm install pg @types/pg && npm uninstall @electric-sql/pglite`, { cwd: ROOT, stdio: "inherit" });
  console.log("  Done.\n");

  // Step 2: Rewrite src/lib/db/index.ts
  console.log("2. Rewriting src/lib/db/index.ts...");
  writeFile(
    "src/lib/db/index.ts",
    `import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required. Set it in your .env file.");
}

export const db = drizzle(process.env.DATABASE_URL, { schema });
`
  );
  console.log("  Done.\n");

  // Step 3: Rewrite drizzle.config.ts
  console.log("3. Rewriting drizzle.config.ts...");
  writeFile(
    "drizzle.config.ts",
    `import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
`
  );
  console.log("  Done.\n");

  // Step 4: Update package.json scripts
  console.log("4. Updating package.json scripts...");
  const pkg = JSON.parse(readFile("package.json"));

  // Remove db:ensure from dev and build scripts
  if (pkg.scripts.dev) {
    pkg.scripts.dev = pkg.scripts.dev.replace("npm run db:ensure && ", "");
  }
  if (pkg.scripts.build) {
    pkg.scripts.build = pkg.scripts.build.replace("npm run db:ensure && ", "");
  }

  // Remove db:ensure script itself
  delete pkg.scripts["db:ensure"];

  // Update prepare-prod script
  pkg.scripts["prepare-prod"] = "tsx scripts/prepare-prod.ts";

  writeFile("package.json", JSON.stringify(pkg, null, 2) + "\n");
  console.log("  Done.\n");

  // Step 5: Remove serverExternalPackages from next.config.mjs
  console.log("5. Updating next.config.mjs...");
  let nextConfig = readFile("next.config.mjs");
  // Remove the serverExternalPackages line
  nextConfig = nextConfig.replace(
    /\s*serverExternalPackages:\s*\[.*?\],?\n?/,
    "\n"
  );
  // Clean up empty config object
  nextConfig = nextConfig.replace(
    /const nextConfig = \{\s*\n\s*\};/,
    "const nextConfig = {};"
  );
  writeFile("next.config.mjs", nextConfig);
  console.log("  Done.\n");

  // Step 6: Delete scripts/ensure-db.ts
  console.log("6. Deleting scripts/ensure-db.ts...");
  deleteFile("scripts/ensure-db.ts");
  console.log("");

  // Step 7: Add DATABASE_URL to .env.example
  console.log("7. Updating .env.example...");
  let envExample = readFile(".env.example");
  if (!envExample.includes("DATABASE_URL")) {
    envExample += "DATABASE_URL=postgresql://user:password@localhost:5432/finopenpos\n";
    writeFile(".env.example", envExample);
  }
  console.log("  Done.\n");

  console.log("=== Migration complete! ===\n");
  console.log("Next steps:");
  console.log("  1. Set DATABASE_URL in your .env file");
  console.log("  2. Run: npm run db:push");
  console.log("  3. Run: npm run dev");
  console.log("");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
