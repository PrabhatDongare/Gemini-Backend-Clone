import Redis from "ioredis";
import dotenv from "dotenv";
dotenv.config();

const redisClient = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null
});
// redisClient.on("connect", () => console.error("Connected to Redis"));
redisClient.on("error", (err) => console.error("Redis connection error:", err));

export default redisClient
