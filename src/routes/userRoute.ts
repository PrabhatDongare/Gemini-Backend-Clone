import express, { Router } from "express";
const router: Router = express.Router();

import { userDetails } from "../controllers/userController";
import { authenticateUser } from "../middlewares/authenticateUser";

router.get("/me", authenticateUser, userDetails);

export default router;
