import mongoose from "mongoose";
import app from "./src/app.js";
import { config, assertConfig } from "./src/config.js";

assertConfig();

mongoose
  .connect(config.mongoUri)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(config.port, () => console.log(`Server running on port ${config.port}`));
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
