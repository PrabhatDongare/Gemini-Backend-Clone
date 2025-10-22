import express, { Router } from "express";
const router: Router = express.Router();

import { getChatrooms, createChatroom, getChatroomDetails, sendMessageToLLM } from "../controllers/chatroomController";
import { authenticateUser } from "../middlewares/authenticateUser";

router.post("/chatroom", authenticateUser, createChatroom);
router.get("/chatroom", authenticateUser, getChatrooms);
router.get("/chatroom/:id", authenticateUser, getChatroomDetails);
router.post("/chatroom/:id/message", authenticateUser, sendMessageToLLM);

export default router;
