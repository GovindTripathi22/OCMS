import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Octokit } from "@octokit/rest";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        let userId = session?.user?.id;

        if (!userId) {
            let guestUser = await prisma.user.findFirst({
                where: { email: "guest@ocms.ai" }
            });
            if (!guestUser) {
                guestUser = await prisma.user.create({
                    data: {
                        name: "Guest User",
                        email: "guest@ocms.ai",
                    }
                });
            }
            userId = guestUser.id;
        }

        const account = await prisma.account.findFirst({
            where: {
                userId: userId,
                provider: "github",
            },
        });

        if (!account || !account.access_token) {
            return NextResponse.json({ authenticated: false, repos: [] });
        }

        if (account.access_token === "mock_token") {
            const searchParams = req.nextUrl.searchParams;
            const owner = searchParams.get("owner");
            const repo = searchParams.get("repo");

            if (owner && repo) {
                try {
                    const localRoot = path.resolve(process.env.LOCAL_WORKSPACE_PATH || process.cwd());
                    const files: { path: string; size: number }[] = [];

                    const scanDir = (dir: string) => {
                        const list = fs.readdirSync(dir);
                        for (const file of list) {
                            const fullPath = path.join(dir, file);
                            const relativePath = path.relative(localRoot, fullPath).replace(/\\/g, "/");
                            
                            // Exclude system/dependency folders
                            if (
                                relativePath === "node_modules" || relativePath.startsWith("node_modules/") ||
                                relativePath === ".git" || relativePath.startsWith(".git/") ||
                                relativePath === ".next" || relativePath.startsWith(".next/") ||
                                relativePath === "dist" || relativePath.startsWith("dist/") ||
                                relativePath === "scratch" || relativePath.startsWith("scratch/") ||
                                relativePath.includes("/node_modules/") ||
                                relativePath.includes("/dist/")
                            ) {
                                continue;
                            }

                            const stat = fs.statSync(fullPath);
                            if (stat.isDirectory()) {
                                scanDir(fullPath);
                            } else {
                                if (
                                    relativePath.endsWith(".tsx") ||
                                    relativePath.endsWith(".jsx") ||
                                    relativePath.endsWith(".ts") ||
                                    relativePath.endsWith(".js") ||
                                    relativePath.endsWith(".html") ||
                                    relativePath.endsWith(".css")
                                ) {
                                    files.push({
                                        path: relativePath,
                                        size: stat.size
                                    });
                                }
                            }
                        }
                    };

                    scanDir(localRoot);

                    return NextResponse.json({
                        authenticated: true,
                        defaultBranch: "main",
                        files
                    });
                } catch (err) {
                    console.error("Local scan error:", err);
                    return NextResponse.json({
                        authenticated: true,
                        error: "Failed to scan local workspace files",
                        details: err instanceof Error ? err.message : String(err)
                    }, { status: 500 });
                }
            }

            return NextResponse.json({
                authenticated: true,
                repos: [
                    {
                        id: 999999,
                        name: "ocms",
                        full_name: "local-workspace/ocms",
                        owner: "local-workspace",
                        html_url: "#",
                        default_branch: "main"
                    }
                ]
            });
        }

        const octokit = new Octokit({ auth: account.access_token });

        const searchParams = req.nextUrl.searchParams;
        const owner = searchParams.get("owner");
        const repo = searchParams.get("repo");

        // Mode 2: Fetch files in repository
        if (owner && repo) {
            try {
                // Fetch the default branch or main branch tree recursively to find files
                const { data: repoData } = await octokit.repos.get({
                    owner,
                    repo,
                });
                
                const defaultBranch = repoData.default_branch || "main";

                const { data: treeData } = await octokit.git.getTree({
                    owner,
                    repo,
                    tree_sha: defaultBranch,
                    recursive: "true",
                });

                // Filter for common page files
                const files = treeData.tree
                    .filter((item) => item.type === "blob" && (
                        item.path?.endsWith(".tsx") ||
                        item.path?.endsWith(".jsx") ||
                        item.path?.endsWith(".ts") ||
                        item.path?.endsWith(".js") ||
                        item.path?.endsWith(".html") ||
                        item.path?.endsWith(".css")
                    ))
                    .map((item) => ({
                        path: item.path,
                        size: item.size,
                    }));

                return NextResponse.json({
                    authenticated: true,
                    defaultBranch,
                    files,
                });
            } catch (err: unknown) {
                console.error("Octokit getTree error:", err);
                return NextResponse.json({
                    authenticated: true,
                    error: "Failed to load repository files",
                    details: err instanceof Error ? err.message : String(err)
                }, { status: 500 });
            }
        }

        // Mode 1: Fetch user repositories
        try {
            const { data: repos } = await octokit.repos.listForAuthenticatedUser({
                sort: "updated",
                per_page: 100,
            });

            const formattedRepos = repos.map((r) => ({
                id: r.id,
                name: r.name,
                full_name: r.full_name,
                owner: r.owner.login,
                html_url: r.html_url,
                default_branch: r.default_branch,
            }));

            return NextResponse.json({
                authenticated: true,
                repos: formattedRepos,
            });
        } catch (err: unknown) {
            console.error("Octokit listForAuthenticatedUser error:", err);
            return NextResponse.json({
                authenticated: true,
                error: "Failed to load GitHub repositories",
                details: err instanceof Error ? err.message : String(err)
            }, { status: 500 });
        }

    } catch (error: unknown) {
        console.error("GitHub API error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
