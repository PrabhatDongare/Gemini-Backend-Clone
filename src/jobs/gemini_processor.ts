import { Worker } from "bullmq";
import prisma from "../config/db";
import redisClient from "../config/redis";
import { askGemini } from "../utils/llmOperation";

// Processing Jobs from Redis 
const geminiWorker = new Worker("ask-gemini-queue", async (job) => {
    const { contentPrompt, userMessage, userId, chatroomId } = job.data

    let llmResponse: string;

    try {
        const fullPrompt = contentPrompt + userMessage.trim();
        llmResponse = await askGemini(fullPrompt);

        // llm response stored in DB
        await prisma.message.create({
            data: {
                content: llmResponse,
                role: "assistant",
                chatroomId: chatroomId
            }
        });
    }
    // llm error well defined
    catch (llmError) {
        console.error("LLM Error:", llmError);

        // Determine the type of error and provide appropriate response
        let errorResponse: string;

        if (llmError instanceof Error) {
            if (llmError.message.includes("API_KEY_INVALID")) {
                errorResponse = "I'm currently experiencing configuration issues. Please contact support.";
            } else if (llmError.message.includes("API_QUOTA_EXCEEDED")) {
                errorResponse = "I've reached my usage limit for today. Please try again tomorrow or contact support for assistance.";
            } else if (llmError.message.includes("CONTENT_POLICY_VIOLATION")) {
                errorResponse = "I can't process this request as it may violate content policies. Please rephrase your message in a different way.";
            } else if (llmError.message.includes("RATE_LIMIT_EXCEEDED")) {
                errorResponse = "I'm receiving too many requests right now. Please wait a moment and try again.";
            } else if (llmError.message.includes("NETWORK_ERROR")) {
                errorResponse = "I'm having trouble connecting to my AI service. Please check your internet connection and try again.";
            } else if (llmError.message.includes("GEMINI_API_KEY not configured")) {
                errorResponse = "I'm currently not configured properly. Please contact support.";
            } else {
                errorResponse = "I encountered an unexpected error while processing your message. Please try again or contact support if the issue persists.";
            }
        } else {
            errorResponse = "I'm unable to process your request at the moment. Please try again later.";
        }

        // Store error response as assistant message
        await prisma.message.create({
            data: {
                content: errorResponse,
                role: "assistant",
                chatroomId: chatroomId
            }
        });

        llmResponse = errorResponse;
    }

    // Update chatroom's updatedAt timestamp
    await prisma.chatroom.update({
        where: { id: chatroomId },
        data: { updatedAt: new Date() }
    });

    // Invalidated old chatroom list from cache
    const cachedKey = `user:chatrooms:${userId}`
    await redisClient.del(cachedKey)

}, { connection: redisClient, concurrency: 2 })

// Additional Data for console
geminiWorker.on("completed", (job) => {
    console.log(`Worker -> Job ${job.id} completed`);
});

geminiWorker.on("failed", (job, err) => {
    console.error(`Worker -> Job ${job?.id} failed:`, err.message);
});
