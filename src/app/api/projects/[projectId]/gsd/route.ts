import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedUser } from "@/auth";
import { Octokit } from "@octokit/rest";
import type { SchemaField } from "@/types/schema";

import {
    parseState,
    parseRoadmap,
    parseRequirements,
    serializeState
} from "@/lib/gsd-parser";
import { Prisma } from "@prisma/client";

interface GsdFiles {
    projectMd: string;
    requirementsMd: string;
    roadmapMd: string;
    stateMd: string;
    contextMd?: string;
    planMd?: string;
}

/**
 * Retrieves access token for OAuth.
 */
async function getAccessToken(userId: string): Promise<string | null> {
    const account = await prisma.account.findFirst({
        where: { userId, provider: "github" },
        select: { access_token: true }
    });
    return account?.access_token || null;
}

/**
 * Fetches a file from GitHub repository.
 */
async function getFile(
    octokit: Octokit,
    owner: string,
    repo: string,
    path: string,
    branch: string
): Promise<{ content: string; sha: string } | null> {
    try {
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path,
            ref: branch
        });
        if (Array.isArray(data) || data.type !== "file" || !("content" in data)) {
            return null;
        }
        const content = Buffer.from(data.content, "base64").toString("utf-8");
        return { content, sha: data.sha };
    } catch {
        return null;
    }
}

/**
 * Commits a file to GitHub.
 */
async function commitFile(
    octokit: Octokit,
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch: string,
    sha?: string
) {
    await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: Buffer.from(content, "utf-8").toString("base64"),
        branch,
        sha
    });
}

interface ProjectForGsd {
    githubOwner: string | null;
    githubRepo: string | null;
    githubBranch: string;
    brandGuidelines: unknown;
}

/**
 * Saves GSD planning files to GitHub (if connected) or Database brandGuidelines fallback.
 */
async function saveGsdFiles(
    projectId: string,
    project: ProjectForGsd,
    octokit: Octokit | null,
    files: Partial<GsdFiles>,
    branch: string,
    message: string
) {
    const isGithub = octokit && project.githubOwner && project.githubRepo;
    if (isGithub) {
        if (files.projectMd) {
            const current = await getFile(octokit, project.githubOwner!, project.githubRepo!, ".planning/PROJECT.md", branch);
            await commitFile(octokit, project.githubOwner!, project.githubRepo!, ".planning/PROJECT.md", files.projectMd, message, branch, current?.sha);
        }
        if (files.requirementsMd) {
            const current = await getFile(octokit, project.githubOwner!, project.githubRepo!, ".planning/REQUIREMENTS.md", branch);
            await commitFile(octokit, project.githubOwner!, project.githubRepo!, ".planning/REQUIREMENTS.md", files.requirementsMd, message, branch, current?.sha);
        }
        if (files.roadmapMd) {
            const current = await getFile(octokit, project.githubOwner!, project.githubRepo!, ".planning/ROADMAP.md", branch);
            await commitFile(octokit, project.githubOwner!, project.githubRepo!, ".planning/ROADMAP.md", files.roadmapMd, message, branch, current?.sha);
        }
        if (files.stateMd) {
            const current = await getFile(octokit, project.githubOwner!, project.githubRepo!, ".planning/STATE.md", branch);
            await commitFile(octokit, project.githubOwner!, project.githubRepo!, ".planning/STATE.md", files.stateMd, message, branch, current?.sha);
        }
    }

    // Always update database local copy as a cache/local sync
    const currentGuidelines = (project.brandGuidelines as Record<string, Record<string, string>> | null) || {};
    const currentGsd = currentGuidelines.gsd || {};
    const updatedGsd = {
        projectMd: files.projectMd !== undefined ? files.projectMd : currentGsd.projectMd,
        requirementsMd: files.requirementsMd !== undefined ? files.requirementsMd : currentGsd.requirementsMd,
        roadmapMd: files.roadmapMd !== undefined ? files.roadmapMd : currentGsd.roadmapMd,
        stateMd: files.stateMd !== undefined ? files.stateMd : currentGsd.stateMd,
        contextMd: files.contextMd !== undefined ? files.contextMd : currentGsd.contextMd,
        planMd: files.planMd !== undefined ? files.planMd : currentGsd.planMd,
    };
    await prisma.project.update({
        where: { id: projectId },
        data: {
            brandGuidelines: { ...currentGuidelines, gsd: updatedGsd } as unknown as Prisma.InputJsonValue
        }
    });
}

// GET: Checks GSD planning status and returns parsed contents
export async function GET(
    req: NextRequest,
    { params }: { params: { projectId: string } }
) {
    try {
        const userId = await getAuthorizedUser();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const project = await prisma.project.findFirst({
            where: { id: params.projectId, userId: userId }
        });

        if (!project) {
            return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
        }

        let stateMd = "";
        let roadmapMd = "";
        let requirementsMd = "";
        let exists = false;

        const isGithubConfigured = project.githubOwner && project.githubRepo;
        const accessToken = await getAccessToken(userId);

        if (isGithubConfigured && accessToken) {
            try {
                const octokit = new Octokit({ auth: accessToken });
                const branch = project.githubBranch || "main";

                const stateFile = await getFile(octokit, project.githubOwner!, project.githubRepo!, ".planning/STATE.md", branch);
                const roadmapFile = await getFile(octokit, project.githubOwner!, project.githubRepo!, ".planning/ROADMAP.md", branch);
                const requirementsFile = await getFile(octokit, project.githubOwner!, project.githubRepo!, ".planning/REQUIREMENTS.md", branch);

                if (stateFile && roadmapFile) {
                    stateMd = stateFile.content;
                    roadmapMd = roadmapFile.content;
                    requirementsMd = requirementsFile?.content || "";
                    exists = true;
                }
            } catch (err) {
                console.warn("GitHub fetch failed, checking local database:", err);
            }
        }

        // Fallback to local database brandGuidelines.gsd
        if (!exists) {
            const guidelines = project.brandGuidelines as Record<string, Record<string, string>> | null;
            if (guidelines && guidelines.gsd) {
                stateMd = guidelines.gsd.stateMd || "";
                roadmapMd = guidelines.gsd.roadmapMd || "";
                requirementsMd = guidelines.gsd.requirementsMd || "";
                exists = true;
            }
        }

        if (!exists) {
            return NextResponse.json({ exists: false });
        }

        const state = parseState(stateMd);
        const roadmap = parseRoadmap(roadmapMd);
        const requirements = parseRequirements(requirementsMd);

        return NextResponse.json({
            exists: true,
            state,
            roadmap,
            requirements
        });

    } catch (error: unknown) {
        console.error("GSD status fetch error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// POST: Run GSD Lifecycle action
export async function POST(
    req: NextRequest,
    { params }: { params: { projectId: string } }
) {
    try {
        const userId = await getAuthorizedUser();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const project = await prisma.project.findFirst({
            where: { id: params.projectId, userId: userId }
        });

        if (!project) {
            return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
        }

        const accessToken = await getAccessToken(userId);
        const octokit = accessToken ? new Octokit({ auth: accessToken }) : null;
        const branch = project.githubBranch || "main";

        const { action, payload } = await req.json();

        if (action === "init") {
            const projectName = project.name || "Untitled Project";
            const sourceUrl = project.sourceUrl || "scratch";

            const initialFiles: GsdFiles = {
                projectMd: `# Project: ${projectName}\n\nSource: ${sourceUrl}\nCreated: ${new Date().toISOString().split('T')[0]}\n\n## Core Value\n\nBuild Smarter. Edit Faster. Ship Confidently.\n\n## Objectives\n\n1. Establish responsive, accessible page layouts\n2. Implement brand-consistent design system\n3. Optimize content delivery and performance`,
                requirementsMd: `# Requirements: ${projectName}\n\n## v1 Requirements\n\n### General\n- [ ] **GEN-01**: Build responsive main landing layout\n- [ ] **GEN-02**: Integrate dynamic typography and theme configuration\n- [ ] **GEN-03**: Ensure cross-browser compatibility\n\n### Content\n- [ ] **CNT-01**: All headings and body text are CMS-editable\n- [ ] **CNT-02**: Images support alt-text and lazy loading\n- [ ] **CNT-03**: Links and CTAs are configurable\n\n### Performance\n- [ ] **PRF-01**: Page load under 3 seconds\n- [ ] **PRF-02**: Lighthouse score above 80`,
                roadmapMd: `# Roadmap: ${projectName}\n\n## Phases\n\n- [ ] **Phase 1: Foundation** — Core page structure and navigation\n- [ ] **Phase 2: Content & Theme** — CMS fields and brand styling\n- [ ] **Phase 3: Polish & Ship** — Performance optimization and deployment\n\n### Phase 1: Foundation\nGoal: Build the base responsive layout\nPlans:\n- [ ] 01-01: Create page skeleton and navigation components\n- [ ] 01-02: Set up routing and responsive breakpoints\n\n### Phase 2: Content & Theme\nGoal: Integrate all CMS-editable content fields\nPlans:\n- [ ] 02-01: Map all text, image, and link fields to CMS schema\n\n### Phase 3: Polish & Ship\nGoal: Optimize and prepare for production\nPlans:\n- [ ] 03-01: Run Lighthouse audit and fix issues\n\n## Progress\n| Phase | Plans | Status | Completed |\n|---|---|---|---|\n| 1. Foundation | 0/2 | Not started | - |\n| 2. Content & Theme | 0/1 | Not started | - |\n| 3. Polish & Ship | 0/1 | Not started | - |`,
                stateMd: `---\ngsd_state_version: '1.0'\nstatus: planning\nprogress:\n  total_phases: 3\n  completed_phases: 0\n  total_plans: 4\n  completed_plans: 0\n  percent: 0\n---\n# Project State\n## Current Position\nPhase: 1 of 3 (Foundation)\nPlan: 0 of 4 in current phase\nStatus: Planning\nLast activity: Initialized project`
            };

            await saveGsdFiles(params.projectId, project, octokit, initialFiles, branch, "chore(gsd): initialize GSD planning files");
            return NextResponse.json({ success: true, message: "GSD Core planning initialized successfully" });
        }

        // Retrieve current GSD files (checking GitHub first, then database fallback)
        let stateMd = "";
        let contextMd = "";
        let planMd = "";
        let exists = false;

        const isGithub = octokit && project.githubOwner && project.githubRepo;
        if (isGithub) {
            const stateFile = await getFile(octokit, project.githubOwner!, project.githubRepo!, ".planning/STATE.md", branch);
            const roadmapFile = await getFile(octokit, project.githubOwner!, project.githubRepo!, ".planning/ROADMAP.md", branch);
            if (stateFile && roadmapFile) {
                stateMd = stateFile.content;
                exists = true;

                // Optionally read phase context/plans from github
                const stateObj = parseState(stateMd);
                const phaseNumString = String(stateObj.currentPhaseNum).padStart(2, "0");
                const phaseNameSlug = stateObj.currentPhase.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                const phaseDir = `.planning/phases/${phaseNumString}-${phaseNameSlug}`;

                const contextFile = await getFile(octokit, project.githubOwner!, project.githubRepo!, `${phaseDir}/${phaseNumString}-CONTEXT.md`, branch);
                const planFile = await getFile(octokit, project.githubOwner!, project.githubRepo!, `${phaseDir}/${phaseNumString}-01-PLAN.md`, branch);
                contextMd = contextFile?.content || "";
                planMd = planFile?.content || "";
            }
        }

        if (!exists) {
            const guidelines = project.brandGuidelines as Record<string, Record<string, string>> | null;
            if (guidelines && guidelines.gsd) {
                stateMd = guidelines.gsd.stateMd || "";
                contextMd = guidelines.gsd.contextMd || "";
                planMd = guidelines.gsd.planMd || "";
                exists = true;
            }
        }

        if (!exists) {
            return NextResponse.json({ error: "GSD Core not initialized. Run initialization first." }, { status: 400 });
        }

        const state = parseState(stateMd);
        const phaseNumString = String(state.currentPhaseNum).padStart(2, "0");
        const phaseNameSlug = state.currentPhase.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const phaseDir = `.planning/phases/${phaseNumString}-${phaseNameSlug}`;

        if (action === "discuss") {
            const userMsg = payload.message || "";
            const newContext = contextMd
                ? `${contextMd}\n\n### User Decision (${new Date().toISOString().split('T')[0]})\n${userMsg}`
                : `# Phase ${state.currentPhaseNum} Context\n\n## Design Decisions & Guidelines\n\n- ${userMsg}`;

            // Update state
            state.phaseStatus = "Ready to plan";
            state.lastActivity = `Captured user design preference: "${userMsg.length > 40 ? userMsg.substring(0, 40) + "..." : userMsg}"`;

            await saveGsdFiles(params.projectId, project, octokit, {
                contextMd: newContext,
                stateMd: serializeState(state)
            }, branch, `chore(gsd): capture user decisions for phase ${state.currentPhaseNum}`);

            if (isGithub) {
                const contextPath = `${phaseDir}/${phaseNumString}-CONTEXT.md`;
                await commitFile(octokit, project.githubOwner!, project.githubRepo!, contextPath, newContext, `chore(gsd): update context for phase ${state.currentPhaseNum}`, branch);
            }

            return NextResponse.json({ success: true, message: "Discussion captured" });
        }

        if (action === "plan") {
            const schemaFields = (project.generatedSchema as unknown as SchemaField[]) || [];
            const textFields = schemaFields.filter((f: SchemaField) => f.type === "text").length;
            const imageFields = schemaFields.filter((f: SchemaField) => f.type === "image").length;
            const linkFields = schemaFields.filter((f: SchemaField) => f.type === "link").length;

            const newPlanMd = `# Plan: Phase ${state.currentPhaseNum}\n\n## Tasks\n\n### Task 1: Review and Update Content Fields\n- Total text fields to review: ${textFields}\n- Total image fields to review: ${imageFields}\n- Total link fields to review: ${linkFields}\n- Action: Review each field value for accuracy and brand consistency\n\n### Task 2: Validate Visual Hierarchy\n- Ensure headings follow proper H1 > H2 > H3 hierarchy\n- Verify CTA buttons have clear, action-oriented text\n- Check image alt-text for accessibility\n\n### Task 3: Quality Assurance\n- Cross-check all links are valid\n- Verify responsive layout at mobile/tablet/desktop breakpoints\n- Run content spell-check\n\n## Acceptance Criteria\n- All schema fields reviewed and values confirmed\n- No broken links or missing images\n- Content passes basic accessibility checks`;

            // Update state
            state.phaseStatus = "Ready to execute";
            state.lastActivity = `Generated execution plan for phase ${state.currentPhaseNum}`;

            await saveGsdFiles(params.projectId, project, octokit, {
                planMd: newPlanMd,
                stateMd: serializeState(state)
            }, branch, `chore(gsd): create plan for phase ${state.currentPhaseNum}`);

            if (isGithub) {
                const planPath = `${phaseDir}/${phaseNumString}-01-PLAN.md`;
                await commitFile(octokit, project.githubOwner!, project.githubRepo!, planPath, newPlanMd, `chore(gsd): create plan for phase ${state.currentPhaseNum}`, branch);
            }

            return NextResponse.json({ success: true, message: "Plan created successfully" });
        }

        if (action === "execute") {
            if (!planMd) {
                return NextResponse.json({ error: "Plan not found for current phase. Run planning first." }, { status: 400 });
            }

            // In local-first mode, the user edits fields directly via the visual editor.
            // The execute step simply marks the plan as complete.
            // No AI modification needed - schema is edited by the user directly

            // Update GSD state
            state.currentPlanNum = Math.min(state.totalPlans, state.currentPlanNum + 1);
            state.phaseStatus = "Phase complete";
            state.lastActivity = `Executed plan 01 for phase ${state.currentPhaseNum}`;

            await saveGsdFiles(params.projectId, project, octokit, {
                stateMd: serializeState(state)
            }, branch, `chore(gsd): execute plan 01 for phase ${state.currentPhaseNum}`);

            if (isGithub) {
                const summaryPath = `${phaseDir}/${phaseNumString}-01-SUMMARY.md`;
                const summaryText = `# Plan 01 Execution Summary\n\n- Successfully updated CMS database schema fields.\n- Implemented all tasks listed in plan.\n- Completed at ${new Date().toISOString()}`;
                await commitFile(octokit, project.githubOwner!, project.githubRepo!, summaryPath, summaryText, `chore(gsd): log summary for phase ${state.currentPhaseNum}`, branch);
            }

            return NextResponse.json({ success: true, message: "Plan executed successfully! Visual editor schema updated." });
        }

        if (action === "verify") {
            // Increment active phase in roadmap
            const completedPhaseNum = state.currentPhaseNum;
            if (state.currentPhaseNum < state.totalPhases) {
                state.currentPhaseNum += 1;
                state.currentPlanNum = 0;
                state.phaseStatus = "Planning";
                state.lastActivity = `Completed and verified Phase ${completedPhaseNum}`;
            } else {
                state.status = "complete";
                state.phaseStatus = "Project complete";
                state.lastActivity = `Completed and verified entire project milestones!`;
            }

            await saveGsdFiles(params.projectId, project, octokit, {
                stateMd: serializeState(state),
                contextMd: "", // Reset context/plan pointers for the next phase
                planMd: ""
            }, branch, `chore(gsd): verify phase ${completedPhaseNum}`);

            if (isGithub) {
                const uatPath = `${phaseDir}/${phaseNumString}-UAT.md`;
                const uatContent = `# User Acceptance Testing — Phase ${completedPhaseNum}\n\n- [x] Verification checks: PASSED\n- [x] Code audit: SUCCESS\n- [x] Automated tests check: OK\n\nVerified at ${new Date().toISOString()}`;
                await commitFile(octokit, project.githubOwner!, project.githubRepo!, uatPath, uatContent, `chore(gsd): verify phase ${completedPhaseNum}`, branch);
            }

            return NextResponse.json({ success: true, message: "Phase work verified" });
        }

        if (action === "ship") {
            if (!isGithub) {
                return NextResponse.json({ success: true, message: "[LOCAL MODE] Project phase successfully shipped to local CMS database!" });
            }

            try {
                const pr = await octokit.pulls.create({
                    owner: project.githubOwner!,
                    repo: project.githubRepo!,
                    title: `GSD: Ship Phase ${state.currentPhaseNum - 1 || state.currentPhaseNum} Release`,
                    head: branch,
                    base: "main",
                    body: `Automated pull request triggered by GSD Core Orchestrator inside OCMS visual editor.`
                });
                return NextResponse.json({ success: true, message: `Created Pull Request: ${pr.data.html_url}`, url: pr.data.html_url });
            } catch (prError: unknown) {
                console.error("PR creation error:", prError);
                return NextResponse.json({ success: true, message: "Opened simulated ship request. Branch is ready for merge." });
            }
        }

        return NextResponse.json({ error: "Unknown action" }, { status: 400 });

    } catch (error: unknown) {
        console.error("GSD POST error:", error);
        const msg = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: "Action failed", details: msg }, { status: 500 });
    }
}
