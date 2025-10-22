import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function askGemini(prompt: string): Promise<string> {
    try {
        // Check if API key is configured
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY not configured");
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error: any) {
        console.error("Gemini API error:", error);

        // Providing more specific error messages based on the error type
        if (error?.message?.includes("API_KEY_INVALID") || error?.message?.includes("API key")) {
            throw new Error("API_KEY_INVALID: Invalid or missing API key");
        } else if (error?.message?.includes("QUOTA_EXCEEDED") || error?.message?.includes("quota")) {
            throw new Error("API_QUOTA_EXCEEDED: API quota exceeded");
        } else if (error?.message?.includes("SAFETY") || error?.message?.includes("safety")) {
            throw new Error("CONTENT_POLICY_VIOLATION: Content violates safety policies");
        } else if (error?.message?.includes("RATE_LIMIT") || error?.message?.includes("rate limit")) {
            throw new Error("RATE_LIMIT_EXCEEDED: Rate limit exceeded");
        } else if (error?.code === "ENOTFOUND" || error?.code === "ECONNREFUSED") {
            throw new Error("NETWORK_ERROR: Network connection failed");
        } else {
            throw new Error(`API_ERROR: ${error?.message || "Failed to get response from Gemini"}`);
        }
    }
}
