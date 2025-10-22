import { Request, Response } from "express";
import dotenv from "dotenv";
import prisma from "../config/db";
import { askGemini } from "../utils/llmOperation";
import redisClient from "../config/redis";
import { enqueueGeminiJob } from "../jobs/gemini_jobs";
dotenv.config()

// GET CHATROOMS
export const getChatrooms = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // return chatroom's from cache
        const cacheKey = `user:chatrooms:${userId}`;

        const cachedChatroom = await redisClient.get(cacheKey)
        if (cachedChatroom) {
            return res.status(200).json({ message: "Chatrooms retrieved successfully", chatrooms: JSON.parse(cachedChatroom) })
        }

        const chatrooms = await prisma.chatroom.findMany({
            where: {
                userId
            },
            // // If need to include messages and message count both
            // include: {
            //     messages: {
            //         orderBy: {
            //             createdAt: 'desc'
            //         },
            //         take: 1 // Get only the latest message for preview
            //     },
            //     _count: {
            //         select: {
            //             messages: true
            //         }
            //     }
            // },
            orderBy: {
                updatedAt: 'desc'
            },
            select: {
                id: true,
                name: true,
                createdAt: true,
                updatedAt: true
            }
        });

        // Format the response to include message count and latest message
        // const formattedChatrooms = chatrooms.map(chatroom => ({
        //     id: chatroom.id,
        //     name: chatroom.name,
        //     createdAt: chatroom.createdAt,
        //     updatedAt: chatroom.updatedAt,
        //     messageCount: chatroom._count.messages,
        //     latestMessage: chatroom.messages[0] || null
        // }));

        if (!chatrooms || chatrooms.length === 0) {
            return res.status(200).json({ message: "No chatrooms found" });
        }

        await redisClient.set(cacheKey, JSON.stringify(chatrooms));
        await redisClient.expire(cacheKey, 600);
        // await redisClient.set(cacheKey, JSON.stringify(chatrooms), "EX", 600); // another way to add expiry

        res.status(200).json({ message: "Chatrooms retrieved successfully", chatrooms });
    } catch (error) {
        console.error("Error fetching chatrooms:", error);
        res.status(500).json({
            error: "Internal server error"
        });
    }
};

// CREATE CHATROOM
export const createChatroom = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // Assumption made - name will be provided by user for this chatroom
        const { name } = req.body;
        if (!name || typeof name !== 'string' || name.trim() === '') {
            return res.status(400).json({ message: "Name is required" });
        }

        // Not considering chatroom with the same name, if already exists
        const existingChatroomName = await prisma.chatroom.findFirst({
            where: {
                userId: userId,
                name: {
                    equals: name.trim().toLowerCase(),
                    mode: 'insensitive'
                }
            }
        });
        if (existingChatroomName) {
            return res.status(400).json({ message: "Name already exists" });
        }

        const chatroom = await prisma.chatroom.create({
            data: {
                name,
                userId: userId
            }
        });

        // invalidated old chatroom list from cache
        const cachedKey = `user:chatrooms:${userId}`
        await redisClient.del(cachedKey)

        res.status(201).json({ message: "Chatroom created successfully", chatroom });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// GET DETAILED CHATROOM INFO
export const getChatroomDetails = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const chatroomId = req.params.id;

        // Validate chatroom ID
        if (!chatroomId || typeof chatroomId !== 'string' || chatroomId.trim() === '') {
            return res.status(400).json({
                message: "Chatroom ID is required"
            });
        }

        // Fetch chatroom with user details and last 2 messages
        const chatroom = await prisma.chatroom.findFirst({
            where: {
                id: chatroomId,
                userId: userId // Ensure user owns this chatroom
            },
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phoneNumber: true
                    }
                },
                messages: {
                    orderBy: {
                        createdAt: 'desc'
                    },
                    take: 2 // Get last 2 messages
                }
            }
        });

        // Check if chatroom exists and user has access
        if (!chatroom) {
            return res.status(404).json({
                message: "Chatroom not accessible for to the user"
            });
        }

        // Format the response
        const response = {
            message: "Chatroom details retrieved successfully",
            chatroom: {
                id: chatroom.id,
                name: chatroom.name,
                createdAt: chatroom.createdAt,
                updatedAt: chatroom.updatedAt,
                user: {
                    id: chatroom.user.id,
                    fullName: chatroom.user.fullName,
                    email: chatroom.user.email,
                    phoneNumber: chatroom.user.phoneNumber
                },
                lastMessages: chatroom.messages // reverse ignored for now 
                // lastMessages: chatroom.messages.reverse() // Reverse to show oldest first
            }
        };

        res.status(200).json(response);
    } catch (error) {
        console.error("Error fetching chatroom details:", error);
        res.status(500).json({
            error: "Internal server error"
        });
    }
};

// CHAT WITH LLM
export const sendMessageToLLM = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { id: chatroomId } = req.params;
        const { userMessage } = req.body

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" })
        }

        if (!userMessage || typeof userMessage !== 'string' || userMessage.trim() === ''
            ||
            !chatroomId || typeof chatroomId !== 'string' || chatroomId.trim() === '') {
            return res.status(400).json({ message: "Invalid parameters" });
        }

        // Check chatroom exists and user owns it
        const chatroom = await prisma.chatroom.findFirst({
            where: {
                id: chatroomId,
                userId
            }
        });

        if (!chatroom) {
            return res.status(404).json({
                message: "Chatroom not found or you don't have access to this chatroom"
            });
        }

        const midnight = new Date();
        midnight.setHours(0, 0, 0, 0);

        const subscription = await prisma.subscriptions.findFirst({
            where: { userId, status: 'active', plan: 'pro' }
        });

        const isPro = !!subscription;
        const dailyLimit = isPro ? Infinity : 5;

        const messageCount = await prisma.message.count({
            where: {
                chatroom: { userId },
                createdAt: { gte: midnight },
                role: "user"
            }
        });
        if (messageCount >= dailyLimit) {
            return res.status(429).json({
                error: 'Daily message limit reached for free plan. Upgrade to Pro.'
            });
        }

        // Get recent chat history for context (last 10 messages)
        const recentMessages = await prisma.message.findMany({
            where: { chatroomId: chatroomId },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
                role: true,
                content: true,
                createdAt: true,
            }
        });

        // Chronological order for context
        const chatHistory = recentMessages.reverse();
        let contentPrompt = '';

        if (chatHistory.length > 0) {
            contentPrompt = 'Previous conversation:\n' + chatHistory.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n') + '\n\nCurrent user message: ';

            // // Basic Rate Limit
            // const proUser = await prisma.subscriptions.findFirst({
            //     where: {
            //         userId
            //     },
            //     select: {
            //         id: true,
            //         plan: true,
            //     }
            // })
            // if (!proUser) {
            //     const lastMessageDate = new Date(chatHistory[0].createdAt);
            //     const today = new Date();
            //     today.setHours(0, 0, 0, 0);

            //     if (lastMessageDate >= today) {
            //         return res.status(400).json({ message: "You've exhausted the daily limit, Upgrade Now or wait for a day" });
            //     }
            // }
        }

        // Store user message in database
        await prisma.message.create({
            data: {
                content: userMessage.trim(),
                role: "user",
                chatroomId: chatroomId
            }
        });

        const data = {
            contentPrompt,
            userMessage: userMessage.trim(),
            userId,
            chatroomId
        }

        await enqueueGeminiJob(data)
        res.status(200).json({ message: "You'll receive the response shortly." });

    } catch (error) {
        console.error("Error chatting with LLM:", error);
        res.status(500).json({
            error: "Internal server error"
        });
    }
};
