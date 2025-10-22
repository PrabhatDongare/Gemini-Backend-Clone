import express, { Router } from "express";
const router: Router = express.Router();

import { subscribePro, stripeWebhook, subscriptionStatus, dummySuccessUrl, dummyCancelUrl } from "../controllers/billingController";
import { authenticateUser } from "../middlewares/authenticateUser";

router.post("/subscribe/pro", authenticateUser, subscribePro);
router.post("/webhook/stripe", express.raw({ type: "application/json" }), stripeWebhook);
router.get("/subscription/status", authenticateUser, subscriptionStatus);
router.get("/dummy/success", dummySuccessUrl);
router.get("/dummy/cancel", dummyCancelUrl);

export default router;
