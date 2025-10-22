import { Request, Response } from "express";
import prisma from "../config/db";

import dotenv from "dotenv";
dotenv.config();

// USER DETAILS
export const userDetails = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        if (!userId) {
            return res
                .status(401)
                .json({ message: "Unauthorized: User not authenticated" });
        }

        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: {
                id: true,
                phoneNumber: true,
                email: true,
                fullName: true,
                verifiedAt: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({ user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};
