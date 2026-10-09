process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test-secret-test-secret-test-secret-123456";
process.env.BCRYPT_ROUNDS = "4"; // fast hashing in tests only
process.env.CLIENT_ORIGIN = "http://localhost:5173";
