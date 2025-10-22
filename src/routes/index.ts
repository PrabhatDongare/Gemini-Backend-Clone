import express, { Router } from "express";
const router: Router = express.Router();

import chatroomRoute from "./chatroomRoute";
import userRoute from "./userRoute";
import authRoute from "./authRoute";
import billingRoute from "./billingRoute";

router.use("/", chatroomRoute);
router.use("/user", userRoute);
router.use("/auth", authRoute);
router.use("/billing", billingRoute);

export default router;
