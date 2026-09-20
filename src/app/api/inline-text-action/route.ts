import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth-guards";
import { withRateLimit } from "@/lib/ratelimit";
import { createErrorResponse, parseJsonSafely, LIMITS } from "@/lib/validation";

function localSummarize(text: string): string {
    const trimmed = text.trim();
    if (trimmed.length <= 60) return trimmed;

    const sentences = trimmed.split(/(?<=[.!?])\s+/);
    if (sentences.length > 1) {
        const first = sentences[0];
        if (first.length >= 20) return first;
        return first + " " + sentences[1];
    }

    const words = trimmed.split(/\s+/);
    if (words.length > 12) {
        return words.slice(0, 12).join(" ") + "...";
    }
    return trimmed;
}

function localChangeTone(text: string): string {
    const replacements: Record<string, string> = {
        "you can": "you are empowered to",
        "we provide": "we deliver",
        "we have": "we offer",
        "want to": "aim to",
        "need to": "aspire to",
        "build": "craft",
        "making": "forging",
        "make": "craft",
        "easy": "seamless",
        "easily": "effortlessly",
        "fast": "blazing-fast",
        "simple": "intuitive",
        "simply": "intuitively",
        "help": "streamline",
        "use": "leverage",
        "start": "launch",
        "good": "exceptional",
        "better": "optimum",
        "change": "transform",
        "website": "platform",
        "program": "solution",
        "creator": "architect",
        "nice": "refined",
        "great": "stellar",
        "cool": "sophisticated",
        "awesome": "outstanding",
        "developer": "engineer",
        "developers": "engineers",
        "code": "logic",
        "run": "execute",
        "show": "visualize",
        "look": "observe",
        "see": "preview",
        "new": "novel",
        "old": "legacy",
        "big": "substantial",
        "small": "granular",
        "quick": "instant",
        "automatically": "seamlessly",
        "automatic": "autonomous",
        "sync": "synchronize",
        "free": "local-first",
        "paid": "premium",
        "ai": "local rules",
        "copilot": "editor",
        "assistant": "workspace",
        "smart": "deterministic",
        "smarter": "more precise"
    };
    let modified = text;
    for (const [word, replacement] of Object.entries(replacements)) {
        const regex = new RegExp(`\\b${word}\\b`, "gi");
        modified = modified.replace(regex, (match) => {
            if (match[0] === match[0].toUpperCase()) {
                if (match.length > 1 && match[1] === match[1].toUpperCase()) {
                    return replacement.toUpperCase();
                }
                return replacement.charAt(0).toUpperCase() + replacement.slice(1);
            }
            return replacement;
        });
    }
    return modified;
}

export async function POST(req: NextRequest) {
    const rateLimited = await withRateLimit("inline-text-action", req, { limit: 40, windowMs: 60_000 });
    if (rateLimited) return rateLimited;

    const authCheck = await requireAuthenticatedUser();
    if (authCheck.error) {
        return createErrorResponse(authCheck.error.code, authCheck.error.message, authCheck.error.status);
    }

    const { data, error: jsonError } = await parseJsonSafely<{ action?: string; value?: string }>(
        req,
        LIMITS.TEXT_VALUE_MAX_LENGTH + 1024
    );
    if (jsonError) return jsonError;

    const action = data?.action?.trim();
    const value = data?.value;

    if (!action || typeof value !== "string") {
        return createErrorResponse("INVALID_INPUT", "action and string value are required", 400);
    }

    if (value.length > LIMITS.TEXT_VALUE_MAX_LENGTH) {
        return createErrorResponse("VALUE_TOO_LONG", "Text value exceeds maximum allowed length", 400);
    }

    let result = value;
    if (action === "summarize") {
        result = localSummarize(value);
    } else if (action === "change-tone") {
        result = localChangeTone(value);
    } else {
        return createErrorResponse("INVALID_ACTION", `Unsupported action "${action}". Allowed: summarize, change-tone`, 400);
    }

    return NextResponse.json({
        success: true,
        value: result.trim(),
    });
}
