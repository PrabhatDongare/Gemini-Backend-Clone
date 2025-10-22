import jwt, { JwtPayload } from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import dotenv from "dotenv";
dotenv.config();

// Authentication Middleware
export const authenticateUser = (req: Request, res: Response, next: NextFunction) => {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
        res.status(401).json({ success: false, message: "Authentication token not sent" });
        return
    }
    try {
        const data = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
        (req as any).user = data.user;
        next();
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Authenticate with valid token" });
    }
}