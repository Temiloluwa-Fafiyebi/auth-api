import crypto from "crypto";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export function signAccessToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, config.accessSecret, {
    expiresIn: config.accessTtl,
    algorithm: "HS256",
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.accessSecret, { algorithms: ["HS256"] });
}

// Refresh tokens are random opaque strings. Only their SHA-256 hash is stored.
export function newRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function newFamilyId() {
  return crypto.randomUUID();
}
