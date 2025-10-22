import { Request, Response } from "express";
import { validationResult } from "express-validator";
import Stripe from 'stripe';
import prisma from "../config/db";

import dotenv from "dotenv";
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: "2025-08-27.basil",
    typescript: true,
});

// SUBSCRIBE TO PRO PLAN
export const subscribePro = async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const user = await prisma.users.findUnique({ where: { id: userId } });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Check if price ID is configured
        const priceId = process.env.STRIPE_PRO_PLAN_PRICE_ID;
        if (!priceId) {
            return res.status(500).json({ message: "Stripe price ID not configured." });
        }

        // Check already subscribed with active plan
        const subscribedUser = await prisma.subscriptions.findFirst({
            where: { userId, plan: "pro", status: "active", currentPeriodEnd: { gt: new Date() } },
            select: { id: true, plan: true, currentPeriodEnd: true }
        })
        if (subscribedUser) {
            return res.status(200).json({ message: `You already have an active plan`, subscribedUser })
        }

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "subscription",
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            customer_email: user.email ?? undefined,
            success_url: `${process.env.BACKEND_BASE_URL}/api/billing/dummy/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.BACKEND_BASE_URL}/api/billing/dummy/cancel`,
            metadata: { userId },
        });

        return res.json({ url: session.url, message: "Subscription link created successfully", fullName: user.fullName ?? null, email: user.email ?? null, phoneNumber: user.phoneNumber });
    } catch (error) {
        console.error("Stripe subscription error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// STRIPE WEBHOOK - Need to update payment status from stripe DB
export const stripeWebhook = async (req: Request, res: Response) => {
    try {
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET
        if (!endpointSecret) {
            res.status(400).json({ message: "Stripe webhook not configured" })
        }
        const body = (req as any).rawBody;

        const signature = req.headers["stripe-signature"];

        let event;
        try {
            event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
        } catch (err) {
            console.log(`Webhook signature verification failed.`, err.message);
            return res.sendStatus(400).json({ message: `Webhook Error: ${err.message}` });
        }

        const session = event.data.object;
        const stripeSubId = session.subscription;

        if (event.type == "checkout.session.completed") {
            const userId = session.metadata.userId;
            const currentPeriodEnd = new Date(session.expires_at * 1000).toISOString();
            const commonDataForUpdate = { plan: "pro", status: "active", stripeSubId, currentPeriodEnd }

            // Check existing subscription
            const existingSubscription = await prisma.subscriptions.findFirst({ where: { userId } });

            if (existingSubscription)
                // Update existing
                await prisma.subscriptions.update({ where: { id: existingSubscription.id }, data: commonDataForUpdate });

            else
                // Create new subscription
                await prisma.subscriptions.create({ data: { ...commonDataForUpdate, userId } });
        }
        else if (event.type == "refund.updated" || event.type == "customer.subscription.deleted")
            await prisma.subscriptions.updateMany({ where: { stripeSubId }, data: { plan: "basic", status: "inactive" } })
        else
            console.log(`Unhandled event type ${event.type}`);
        res.sendStatus(200)
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// CHECK SUBSCRIPTION STATUS
export const subscriptionStatus = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // Get user details
        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
                verifiedAt: true,
                createdAt: true
            }
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Get user's subscription from database
        const subscription = await prisma.subscriptions.findFirst({
            where: {
                userId,
                status: {
                    in: ['active', 'trialing', 'past_due']
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Determine user tier
        let tier = 'basic';

        if (subscription) {
            const isActive = subscription.status === 'active' || subscription.status === 'trialing';
            const isExpired = new Date() > subscription.currentPeriodEnd;

            if (isActive && !isExpired) {
                tier = 'pro';
            }
        }
        return res.status(200).json({ user, tier, subscription: subscription ?? null });

    } catch (error) {
        console.error("Error checking subscription status:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// DUMMY SUCCESS URL - AFTER STRIPE PAYMENT
export const dummySuccessUrl = async (req: Request, res: Response) => {
    try {
        res.status(200).json({ message: "Transaction successful" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// DUMMY CANCEL URL - AFTER STRIPE PAYMENT
export const dummyCancelUrl = async (req: Request, res: Response) => {
    try {
        res.status(200).json({ message: "Transaction failed" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal server error" });
    }
};
