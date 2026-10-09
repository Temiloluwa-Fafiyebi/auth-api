import { Router } from "express";
import User from "../models/User.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/users", authenticate, requireRole("admin"), async (req, res) => {
  const users = await User.find().select("email role createdAt").sort({ createdAt: -1 }).limit(100);
  res.json({ users });
});

export default router;
