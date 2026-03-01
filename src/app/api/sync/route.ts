import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { syncToGitHub } from "@/lib/github-sync";

/**
 * POST /api/sync
 *
 * Triggers the GitHub sync process.
 * Expects: { projectId, updates: [{ id, oldValue, newValue }], commitMessage? }
 */
export async function POST(request: Request) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized — sign in to sync" },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { projectId, updates, commitMessage } = body;

        if (!projectId || !Array.isArray(updates) || updates.length === 0) {
            return NextResponse.json(
                { error: "projectId and a non-empty updates array are required" },
                { status: 400 }
            );
        }

        const result = await syncToGitHub({
            userId: session.user.id,
            projectId,
            updates,
            commitMessage,
        });

        if (!result.success) {
            return NextResponse.json(
                { error: result.error, filesChanged: result.filesChanged },
                { status: 400 }
            );
        }

        return NextResponse.json(result);
    } catch (err) {
        const message =
            err instanceof Error ? err.message : "Sync failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
