import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validate, registerSchema, loginSchema } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import { register, login, refresh, logout, logoutAll, me } from "../controllers/authController.js";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many attempts, try again later" },
  skip: () => process.env.NODE_ENV === "test",
});

router.post("/register", authLimiter, validate(registerSchema), register);
router.post("/login", authLimiter, validate(loginSchema), login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.post("/logout-all", authenticate, logoutAll);
router.get("/me", authenticate, me);

export default router;
