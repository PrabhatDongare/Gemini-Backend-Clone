import express, { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from 'dotenv';
import routes from "./routes";

dotenv.config()
const port = process.env.PORT || 3000;
const app: Express = express();

app.use(cors())
app.use(express.json({
    verify: (req: Request & { rawBody?: string }, res, buf) => {
        if (req.originalUrl && req.originalUrl.startsWith('/api/billing/webhook/stripe')) {
            req.rawBody = buf.toString();
        }
    },
}));
app.use(express.urlencoded({ extended: false }))

app.get("/", (req: Request, res: Response) => {
    try {
        res.status(200).json({ success: true, message: "Backend is LIVE" });
    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, message: "Internal server error" });
    }
})
app.use("/api", routes);

// BullMQ worker
import "./jobs/gemini_processor";

app.listen(port, () => {
    console.log(`BACKEND listening  on port ${port}`);
});
