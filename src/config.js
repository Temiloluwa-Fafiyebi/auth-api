import dotenv from "dotenv";
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || "development",
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI,
  accessSecret: process.env.JWT_ACCESS_SECRET,
  accessTtl: process.env.ACCESS_TOKEN_TTL || "15m",
  refreshDays: Number(process.env.REFRESH_TOKEN_DAYS || 7),
  clientOrigin: process.env.CLIENT_ORIGIN,
  cookieSameSite: process.env.COOKIE_SAMESITE || "lax",
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 12),
};

export function assertConfig() {
  if (!config.accessSecret || config.accessSecret.length < 32) {
    throw new Error("JWT_ACCESS_SECRET missing or too short (use 64 random bytes)");
  }
}
