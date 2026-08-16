import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../../.env" });

export function createApp() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  return app;
}
