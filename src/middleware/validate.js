import { z } from "zod";

export const registerSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(72), // bcrypt only uses the first 72 bytes
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(72),
});

export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: result.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    });
  }
  req.body = result.data;
  next();
};
