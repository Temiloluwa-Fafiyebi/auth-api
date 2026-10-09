import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.set("trust proxy", 1); // Render sits behind a proxy; needed so rate limiting sees real IPs
app.use(helmet());
app.use(
  cors({
    origin: config.clientOrigin || false,
    credentials: true, // allow the refresh cookie; origin must be explicit, never "*"
  })
);
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
