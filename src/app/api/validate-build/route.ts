import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import path from "path";
import fs from "fs";
import { requireAuthenticatedUser } from "@/lib/auth-guards";
import { withRateLimit } from "@/lib/ratelimit";
import { createErrorResponse } from "@/lib/validation";

export type BuildValidationStatus = "RUN" | "PASS" | "FAIL" | "NOT_AVAILABLE";

interface ValidateBuildResponse {
    success: boolean;
    valid: boolean;
    status: BuildValidationStatus;
    errorCount: number;
    errors: string[];
    stdout: string;
    stderr: string;
    checkedAt: string;
    executionTimeMs?: number;
}

/**
 * GET /api/validate-build
 * Runs deterministic local TypeScript check using the fixed local tsc binary.
 * Requires authentication and rate limiting. Never reports valid=true when no check ran.
 */
export async function GET(req: NextRequest) {
    const rateLimited = await withRateLimit("validate-build", req, { limit: 10, windowMs: 60_000 });
    if (rateLimited) return rateLimited;

    const authCheck = await requireAuthenticatedUser();
    if (authCheck.error) {
        return createErrorResponse(authCheck.error.code, authCheck.error.message, authCheck.error.status);
    }

    const tscBinaryPath = path.join(process.cwd(), "node_modules", "typescript", "bin", "tsc");

    if (!fs.existsSync(tscBinaryPath)) {
        const res: ValidateBuildResponse = {
            success: false,
            valid: false,
            status: "NOT_AVAILABLE",
            errorCount: 1,
            errors: ["Local TypeScript executable was not found at node_modules/typescript/bin/tsc."],
            stdout: "",
            stderr: "NOT_AVAILABLE: TypeScript compiler missing",
            checkedAt: new Date().toISOString(),
        };
        return NextResponse.json(res, { status: 503 });
    }

    const startTime = Date.now();

    return new Promise<NextResponse>((resolve) => {
        // Execute the fixed local TypeScript binary with bounded output and 30s timeout
        execFile(
            process.execPath,
            [tscBinaryPath, "--noEmit"],
            {
                cwd: process.cwd(),
                timeout: 30000,
                maxBuffer: 2 * 1024 * 1024, // 2MB buffer limit
                env: {
                    ...process.env,
                    NODE_ENV: "development",
                },
            },
            (error, stdout, stderr) => {
                const duration = Date.now() - startTime;
                const stdoutStr = (stdout || "").trim();
                const stderrStr = (stderr || "").trim();

                // If exit code is 0, build passed without any type errors
                if (!error) {
                    const res: ValidateBuildResponse = {
                        success: true,
                        valid: true,
                        status: "PASS",
                        errorCount: 0,
                        errors: [],
                        stdout: stdoutStr.slice(0, 10000),
                        stderr: stderrStr.slice(0, 5000),
                        checkedAt: new Date().toISOString(),
                        executionTimeMs: duration,
                    };
                    return resolve(NextResponse.json(res, { status: 200 }));
                }

                // If tsc failed with compilation errors or execution error
                const combined = [stdoutStr, stderrStr].filter(Boolean).join("\n");
                const allLines = combined
                    .split("\n")
                    .map((l) => l.trim())
                    .filter((l) => l.length > 0);

                // Collect diagnostic error lines
                const errorLines = allLines.filter(
                    (line) => line.includes("error TS") || line.includes("Error:") || line.toLowerCase().includes("error")
                );

                const finalErrors = errorLines.length > 0 ? errorLines : (allLines.length > 0 ? allLines : [error.message]);

                const res: ValidateBuildResponse = {
                    success: false,
                    valid: false,
                    status: "FAIL",
                    errorCount: finalErrors.length,
                    errors: finalErrors.slice(0, 30), // Bound returned errors to 30 items
                    stdout: stdoutStr.slice(0, 10000),
                    stderr: stderrStr.slice(0, 5000),
                    checkedAt: new Date().toISOString(),
                    executionTimeMs: duration,
                };

                return resolve(NextResponse.json(res, { status: 200 }));
            }
        );
    });
}
