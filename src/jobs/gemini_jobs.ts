import { Queue } from "bullmq";
import redisClient from "../config/redis";

const geminiQueue = new Queue("ask-gemini-queue", {
    connection: redisClient
})

// Adding prompts to Redis for async processing
export const enqueueGeminiJob = async (data) => {
    await geminiQueue.add("process-gemini-message", data, {
        attempts: 2,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false
    })
}
