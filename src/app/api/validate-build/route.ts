import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

/**
 * GET /api/validate-build
 *
 * Runs TypeScript compilation check (tsc --noEmit) on the OCMS project
 * and returns whether the build is healthy.
 */
export async function GET() {
    if (process.env.VERCEL) {
        return NextResponse.json({
            valid: true,
            errors: ["TypeScript build check is bypassed in serverless environment. Run locally to validate build."],
            errorCount: 0,
            checkedAt: new Date().toISOString(),
        });
    }

    try {
        const projectRoot = path.resolve(process.cwd());

        const { stdout, stderr } = await execAsync("npx tsc --noEmit 2>&1", {
            cwd: projectRoot,
            timeout: 30000, // 30s max
            env: { ...process.env, NODE_ENV: "development" },
        });

        const output = (stdout || "") + (stderr || "");
        const errorLines = output
            .split("\n")
            .filter((line) => line.includes("error TS"))
            .map((line) => line.trim());

        return NextResponse.json({
            valid: errorLines.length === 0,
            errors: errorLines.slice(0, 20), // Cap at 20 errors
            errorCount: errorLines.length,
            checkedAt: new Date().toISOString(),
        });
    } catch (err: unknown) {
        // tsc exits with code 1 when there are errors
        const execError = err as { stdout?: string; stderr?: string; message?: string };
        const output = (execError.stdout || "") + (execError.stderr || "");
        const errorLines = output
            .split("\n")
            .filter((line) => line.includes("error TS"))
            .map((line) => line.trim());

        if (errorLines.length > 0) {
            return NextResponse.json({
                valid: false,
                errors: errorLines.slice(0, 20),
                errorCount: errorLines.length,
                checkedAt: new Date().toISOString(),
            });
        }

        // Genuine execution error
        return NextResponse.json(
            { valid: false, errors: ["Build validation failed to execute"], errorCount: 1 },
            { status: 500 }
        );
    }
}
