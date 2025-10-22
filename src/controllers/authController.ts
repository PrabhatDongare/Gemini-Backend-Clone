import { Request, Response } from "express";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { validationResult } from "express-validator";
import prisma from "../config/db";

import dotenv from "dotenv";
dotenv.config()


// SIGN UP USER
export const signUp = async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { phoneNumber, email, fullName, password } = req.body as {
            phoneNumber: string;
            email?: string | null;
            fullName?: string | null;
            password: string;
        };

        // Check existing by phoneNumber
        const existingByPhone = await prisma.users.findUnique({ where: { phoneNumber } });
        if (existingByPhone) {
            return res.status(409).json({ message: "Phone Number already exists" });
        }

        // If email provided, ensure it's unique as well
        if (email) {
            const existingByEmail = await prisma.users.findUnique({ where: { email } });
            if (existingByEmail) {
                return res.status(409).json({ message: "Email already exists" });
            }
        }

        // Hash password
        const passwordSalt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, passwordSalt);

        const createdUser = await prisma.users.create({
            data: {
                phoneNumber,
                email: email ?? null,
                fullName: fullName ?? null,
                password: passwordHash,
            } as any,
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

        return res.status(201).json({ message: "Account created", user: createdUser });
    } catch (error: any) {
        console.log(error)
        return res.status(500).json({ message: "Internal server error" });
    }
}

// SEND OTP
export const sendOtp = async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { phoneNumber } = req.body as { phoneNumber: string };

        // Ensure user exists
        const user = await prisma.users.findUnique({ where: { phoneNumber } });
        if (!user) {
            return res.status(404).json({ message: "Invalid phone number" });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Hash OTP using bcrypt with salt
        const salt = await bcrypt.genSalt(10);
        const otpHash = await bcrypt.hash(otp, salt);

        // Expiration (5 minutes)
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        // Upsert OTP for user (unique userId in Otps)
        const existingOtp = await prisma.otps.findUnique({ where: { userId: user.id } });
        if (existingOtp) {
            await prisma.otps.update({
                where: { userId: user.id },
                data: { code: otpHash, expiresAt, isUsed: false },
            });
        } else {
            await prisma.otps.create({
                data: { userId: user.id, code: otpHash, expiresAt },
            });
        }

        return res.status(200).json({
            message: "OTP generated",
            otp,
            phoneNumber: user.phoneNumber,
            email: user.email ?? null,
            fullName: user.fullName ?? null,
        });
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: "Internal server error" });
    }
}

// VERIFY OTP
export const verifyOtp = async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { phoneNumber, otp } = req.body as { phoneNumber: string; otp: string };

        // Ensure user exists
        const user = await prisma.users.findUnique({ where: { phoneNumber } });
        if (!user) {
            return res.status(404).json({ message: "Invalid phone number" });
        }

        // Load OTP record for this user
        const otpRecord = await prisma.otps.findUnique({ where: { userId: user.id } });
        if (!otpRecord || otpRecord.isUsed) {
            return res.status(400).json({ message: "Please request a new OTP." });
        }

        if (otpRecord.expiresAt.getTime() < Date.now()) {
            return res.status(400).json({ message: "OTP expired. Please request a new OTP." });
        }

        // Compare OTP
        const isMatch = await bcrypt.compare(otp, otpRecord.code);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid OTP" });
        }

        // Mark verified and consume OTP
        await prisma.$transaction([
            prisma.users.update({ where: { id: user.id }, data: { verifiedAt: new Date() } }),
            prisma.otps.update({ where: { id: otpRecord.id }, data: { isUsed: true } }),
        ]);

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            return res.status(500).json({ message: "JWT secret not configured" });
        }
        const tokenData = { user: { id: user.id, phoneNumber: user.phoneNumber } };

        const authToken = jwt.sign(tokenData, jwtSecret, { expiresIn: "7d" });

        return res.status(200).json({
            message: "Verification successful",
            phoneNumber: user.phoneNumber,
            email: user.email ?? null,
            fullName: user.fullName ?? null,
            authToken,
        });
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: "Internal server error" });
    }
}

// FORGOT PASSWORD
export const forgotPassword = async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { phoneNumber } = req.body as { phoneNumber: string };

        // Ensure user exists
        const user = await prisma.users.findUnique({ where: { phoneNumber } });
        if (!user) {
            return res.status(404).json({ message: "Invalid phone number" });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Hash OTP using bcrypt with salt
        const salt = await bcrypt.genSalt(10);
        const otpHash = await bcrypt.hash(otp, salt);

        // Expiration (5 minutes)
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        // Upsert OTP for user (unique userId in Otps)
        const existingOtp = await prisma.otps.findUnique({ where: { userId: user.id } });
        if (existingOtp) {
            await prisma.otps.update({
                where: { userId: user.id },
                data: { code: otpHash, expiresAt, isUsed: false },
            });
        } else {
            await prisma.otps.create({
                data: { userId: user.id, code: otpHash, expiresAt },
            });
        }

        return res.status(200).json({
            message: "OTP sent for password reset",
            otp,
            phoneNumber: user.phoneNumber,
            email: user.email ?? null,
            fullName: user.fullName ?? null,
        });
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: "Internal server error" });
    }
}

// CHANGE PASSWORD
export const changePassword = async (req: Request, res: Response) => {
    // console.log("working change pass otp 1")
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
        const authUser = (req as any).user as { id: string } | undefined;
        if (!authUser?.id) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const user = await prisma.users.findUnique({ where: { id: authUser.id } });
        if (!user || !user.password) {
            return res.status(404).json({ message: "User not found" });
        }

        const isCurrentValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentValid) {
            return res.status(400).json({ message: "Incorrect Password" });
        }

        const sameAsOld = await bcrypt.compare(newPassword, user.password);
        if (sameAsOld) {
            return res.status(400).json({ message: "New password must be different from current password" });
        }

        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(newPassword, salt);

        await prisma.users.update({
            where: { id: authUser.id },
            data: { password: newHash },
        });

        return res.status(200).json({ message: "Password changed successfully" });
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: "Internal server error" });
    }
}
