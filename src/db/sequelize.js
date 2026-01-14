import dotenv from "dotenv";
import { Sequelize } from "sequelize";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ✅ Load env FIRST
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// ✅ Debug (remove later if you want)
console.log("DATABASE_URL =", process.env.DATABASE_URL);

if (!process.env.DATABASE_URL) {
  throw new Error(
    "❌ DATABASE_URL is not defined. Make sure .env is in Backend root"
  );
}

export const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: false,
});
