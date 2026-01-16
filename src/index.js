import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import express from "express";
import cors from "cors";
import googleTokenRoutes from "./routes/googleToken.js";
import voiceCommandRoutes from "./routes/voiceCommand.js";
import twilioWebhookRoutes from "./routes/twilioWebhook.js";
import { sequelize } from "./db/sequelize.js";

async function startServer() {
  try {
    // Connect to DB
    await sequelize.authenticate();
    console.log("✅ Database connected");

    // Sync models
    await sequelize.sync();
    console.log("✅ Sequelize models synced");

    const app = express();

    // CORS configuration
    app.use(cors({
      origin: "*",
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"]
    }));

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Google OAuth routes
    app.use("/auth", googleTokenRoutes);

    // Voice command routes (Includes Calling Webhooks)
    app.use("/voice", voiceCommandRoutes);
    app.use("/voice", twilioWebhookRoutes);

    // Health check
    app.get("/health", (req, res) => {
      console.log("🏥 Health check pinged");
      res.json({ status: "ok" });
    });

    // Start server
    app.listen(4000, () => {
      console.log("🚀 Backend running on port 4000");
    });
  } catch (err) {
    console.error("❌ Server startup failed", err);
    process.exit(1);
  }
}

startServer();
