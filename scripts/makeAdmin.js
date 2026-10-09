import mongoose from "mongoose";
import { config } from "../src/config.js";
import User from "../src/models/User.js";

const email = process.argv[2];
if (!email) {
  console.error("Usage: npm run make-admin -- you@example.com");
  process.exit(1);
}

await mongoose.connect(config.mongoUri);
const user = await User.findOneAndUpdate({ email: email.toLowerCase() }, { role: "admin" }, { new: true });
console.log(user ? `${user.email} is now an admin` : "No user with that email");
await mongoose.disconnect();
