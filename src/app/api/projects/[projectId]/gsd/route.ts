import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser, requireOwnedProject } from "@/lib/auth-guards";
import { Octokit } from "@octokit/rest";
import type { SchemaField } from "@/types/schema";
import { validateMutationOrigin } from "@/lib/csrf";
import { createErrorResponse, parseJsonSafely, LIMITS } from "@/lib/validation";

import {
    parseState,
    parseRoadmap,
    parseRequirements,
    serializeState,
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

async function getAccessToken(userId: string): Promise<string | null> {
    const account = await prisma.account.findFirst({
        where: { userId, provider: "github" },
        select: { access_token: true }
    });
    return account?.access_token || null;
}

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

async function saveGsdFiles(
    projectId: string,
    files: Partial<GsdFiles>
) {
    // Persist GSD planning files to dedicated database columns only (do not pollute user repository)
    const updateData: Prisma.ProjectUpdateInput = {};
    if (files.stateMd !== undefined) {
        updateData.gsdState = { stateMd: files.stateMd };
    }
    if (files.contextMd !== undefined) {
        updateData.gsdContext = { contextMd: files.contextMd };
    }
    if (files.planMd !== undefined) {
        updateData.gsdPlan = { planMd: files.planMd };
    }

    if (Object.keys(updateData).length > 0) {
        await prisma.project.update({
            where: { id: projectId },
            data: updateData,
        });
    }
}

// GET: Checks GSD planning status and returns parsed contents
export async function GET(
    _req: NextRequest,
    { params }: { params: { projectId: string } }
) {
    try {
        const authCheck = await requireAuthenticatedUser();
        if (authCheck.error) {
            return createErrorResponse(authCheck.error.code, authCheck.error.message, authCheck.error.status);
        }
        const userId = authCheck.userId;

        const projectCheck = await requireOwnedProject(params.projectId, userId);
        if (projectCheck.error) {
            return createErrorResponse(projectCheck.error.code, projectCheck.error.message, projectCheck.error.status);
        }
        const project = projectCheck.project;

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
                console.warn("[GSD] GitHub fetch failed, checking database state:", err);
            }
        }

        // Dedicated database fields fallback
        if (!exists) {
            const gsdStateObj = project.gsdState as Record<string, string> | null;
            if (gsdStateObj && gsdStateObj.stateMd) {
                stateMd = gsdStateObj.stateMd;
                roadmapMd = gsdStateObj.roadmapMd || "";
                requirementsMd = gsdStateObj.requirementsMd || "";
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
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch GSD planning status", 500);
    }
}

// POST: Run GSD Lifecycle action
export async function POST(
    req: NextRequest,
    { params }: { params: { projectId: string } }
) {
    const csrfError = validateMutationOrigin(req);
    if (csrfError) return csrfError;

    const authCheck = await requireAuthenticatedUser();
    if (authCheck.error) {
        return createErrorResponse(authCheck.error.code, authCheck.error.message, authCheck.error.status);
    }
    const userId = authCheck.userId;

    const projectCheck = await requireOwnedProject(params.projectId, userId);
    if (projectCheck.error) {
        return createErrorResponse(projectCheck.error.code, projectCheck.error.message, projectCheck.error.status);
    }
    const project = projectCheck.project;

    const { data, error: jsonError } = await parseJsonSafely<{
        action?: string;
        payload?: { message?: string };
    }>(req, 100 * 1024);
    if (jsonError) return jsonError;

    const action = data?.action?.trim();
    const payload = data?.payload;

    const accessToken = await getAccessToken(userId);
    const octokit = accessToken ? new Octokit({ auth: accessToken }) : null;
    const branch = project.githubBranch || "main";

    if (action === "init") {
        const projectName = project.name || "Untitled Project";
        const sourceUrl = project.sourceUrl || "scratch";

        const initialFiles: GsdFiles = {
            projectMd: `# Project: ${projectName}\n\nSource: ${sourceUrl}\nCreated: ${new Date().toISOString().split('T')[0]}\n\n## Core Value\n\nBuild Smarter. Edit Faster. Ship Confidently.\n\n## Objectives\n\n1. Establish responsive, accessible page layouts\n2. Implement brand-consistent design system\n3. Optimize content delivery and performance`,
            requirementsMd: `# Requirements: ${projectName}\n\n## v1 Requirements\n\n### General\n- [ ] **GEN-01**: Build responsive main landing layout\n- [ ] **GEN-02**: Integrate dynamic typography and theme configuration\n- [ ] **GEN-03**: Ensure cross-browser compatibility\n\n### Content\n- [ ] **CNT-01**: All headings and body text are CMS-editable\n- [ ] **CNT-02**: Images support alt-text and lazy loading\n- [ ] **CNT-03**: Links and CTAs are configurable\n\n### Performance\n- [ ] **PRF-01**: Page load under 3 seconds\n- [ ] **PRF-02**: Local static performance check passes`,
            roadmapMd: `# Roadmap: ${projectName}\n\n## Phases\n\n- [ ] **Phase 1: Foundation** — Core page structure and navigation\n- [ ] **Phase 2: Content & Theme** — CMS fields and brand styling\n- [ ] **Phase 3: Polish & Ship** — Performance optimization and deployment\n\n### Phase 1: Foundation\nGoal: Build the base responsive layout\nPlans:\n- [ ] 01-01: Create page skeleton and navigation components\n- [ ] 01-02: Set up routing and responsive breakpoints\n\n### Phase 2: Content & Theme\nGoal: Integrate all CMS-editable content fields\nPlans:\n- [ ] 02-01: Map all text, image, and link fields to CMS schema\n\n### Phase 3: Polish & Ship\nGoal: Optimize and prepare for production\nPlans:\n- [ ] 03-01: Run deterministic audit and verify issues\n\n## Progress\n| Phase | Plans | Status | Completed |\n|---|---|---|---|\n| 1. Foundation | 0/2 | Not started | - |\n| 2. Content & Theme | 0/1 | Not started | - |\n| 3. Polish & Ship | 0/1 | Not started | - |`,
            stateMd: `---\ngsd_state_version: '1.0'\nstatus: planning\nprogress:\n  total_phases: 3\n  completed_phases: 0\n  total_plans: 4\n  completed_plans: 0\n  percent: 0\n---\n# Project State\n## Current Position\nPhase: 1 of 3 (Foundation)\nPlan: 0 of 4 in current phase\nStatus: Planning\nLast activity: Initialized project`
        };

        await saveGsdFiles(params.projectId, initialFiles);
        return NextResponse.json({ success: true, message: "GSD Core planning initialized successfully" });
    }

    // Retrieve current GSD files (GitHub first, then database fields)
    let stateMd = "";
    let contextMd = "";
    let planMd = "";
    let exists = false;

    const isGithub = octokit && project.githubOwner && project.githubRepo;
    if (isGithub) {
        try {
            const stateFile = await getFile(octokit, project.githubOwner!, project.githubRepo!, ".planning/STATE.md", branch);
            const roadmapFile = await getFile(octokit, project.githubOwner!, project.githubRepo!, ".planning/ROADMAP.md", branch);
            if (stateFile && roadmapFile) {
                stateMd = stateFile.content;
                exists = true;

                const stateObj = parseState(stateMd);
                const phaseNumString = String(stateObj.currentPhaseNum).padStart(2, "0");
                const phaseNameSlug = stateObj.currentPhase.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                const phaseDir = `.planning/phases/${phaseNumString}-${phaseNameSlug}`;

                const contextFile = await getFile(octokit, project.githubOwner!, project.githubRepo!, `${phaseDir}/${phaseNumString}-CONTEXT.md`, branch);
                const planFile = await getFile(octokit, project.githubOwner!, project.githubRepo!, `${phaseDir}/${phaseNumString}-01-PLAN.md`, branch);
                contextMd = contextFile?.content || "";
                planMd = planFile?.content || "";
            }
        } catch (gitErr) {
            console.warn("[GSD] GitHub load error:", gitErr);
        }
    }

    if (!exists) {
        const gsdStateObj = project.gsdState as Record<string, string> | null;
        const gsdContextObj = project.gsdContext as Record<string, string> | null;
        const gsdPlanObj = project.gsdPlan as Record<string, string> | null;

        if (gsdStateObj?.stateMd) {
            stateMd = gsdStateObj.stateMd;
            contextMd = gsdContextObj?.contextMd || "";
            planMd = gsdPlanObj?.planMd || "";
            exists = true;
        }
    }

    if (!exists) {
        return createErrorResponse("NOT_INITIALIZED", "GSD Core not initialized. Run initialization first.", 400);
    }

    const state = parseState(stateMd);
    const phaseNumString = String(state.currentPhaseNum).padStart(2, "0");
    const phaseNameSlug = state.currentPhase.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const phaseDir = `.planning/phases/${phaseNumString}-${phaseNameSlug}`;

    if (action === "discuss") {
        const userMsg = (payload?.message || "").trim();
        if (userMsg.length > LIMITS.GSD_MESSAGE_MAX_LENGTH) {
            return createErrorResponse("MESSAGE_TOO_LONG", `Message cannot exceed ${LIMITS.GSD_MESSAGE_MAX_LENGTH} characters`, 400);
        }

        const newContext = contextMd
            ? `${contextMd}\n\n### User Decision (${new Date().toISOString().split('T')[0]})\n${userMsg}`
            : `# Phase ${state.currentPhaseNum} Context\n\n## Design Decisions & Guidelines\n\n- ${userMsg}`;

        state.phaseStatus = "Ready to plan";
        state.lastActivity = `Captured user design preference: "${userMsg.length > 40 ? userMsg.substring(0, 40) + "..." : userMsg}"`;

        await saveGsdFiles(params.projectId, {
            contextMd: newContext,
            stateMd: serializeState(state)
        });

        if (isGithub) {
            const contextPath = `${phaseDir}/${phaseNumString}-CONTEXT.md`;
            await commitFile(octokit, project.githubOwner!, project.githubRepo!, contextPath, newContext, `chore(gsd): update context for phase ${state.currentPhaseNum}`, branch);
        }

        return NextResponse.json({ success: true, message: "Discussion captured" });
    }

    if (action === "plan") {
        const schemaFields = (project.generatedSchema as unknown as SchemaField[]) || [];
        const textFields = schemaFields.filter((f) => f.type === "text").length;
        const imageFields = schemaFields.filter((f) => f.type === "image").length;
        const linkFields = schemaFields.filter((f) => f.type === "link").length;

        const newPlanMd = `# Plan: Phase ${state.currentPhaseNum}\n\n## Tasks\n\n### Task 1: Review and Update Content Fields\n- Text fields to review: ${textFields}\n- Image fields to review: ${imageFields}\n- Link fields to review: ${linkFields}\n\n### Task 2: Validate Schema & Constraints\n- Check that all schema fields have non-empty IDs\n- Verify images have valid alt text for accessibility\n- Ensure no javascript: or unsafe links exist\n\n### Task 3: Quality Assurance\n- Confirm responsive viewport layout\n- Verify deterministic code patch consistency\n\n## Acceptance Criteria\n- Schema validation passed: 100%\n- Zero insecure links (no javascript: scheme)\n- All image tags have descriptive alt text\n- Project code builds cleanly`;

        state.phaseStatus = "Ready to execute";
        state.lastActivity = `Generated execution plan for phase ${state.currentPhaseNum}`;

        await saveGsdFiles(params.projectId, {
            planMd: newPlanMd,
            stateMd: serializeState(state)
        });

        if (isGithub) {
            const planPath = `${phaseDir}/${phaseNumString}-01-PLAN.md`;
            await commitFile(octokit, project.githubOwner!, project.githubRepo!, planPath, newPlanMd, `chore(gsd): create plan for phase ${state.currentPhaseNum}`, branch);
        }

        return NextResponse.json({ success: true, message: "Plan created successfully" });
    }

    if (action === "execute") {
        if (!planMd) {
            return createErrorResponse("PLAN_REQUIRED", "Plan not found for current phase. Run planning first.", 400);
        }

        // Actually execute deterministic checks on actual project and schema state!
        const schemaFields = (project.generatedSchema as unknown as SchemaField[]) || [];
        const executionTasks: { name: string; status: "PASS" | "FAIL" | "WARN"; details: string }[] = [];
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check 1: Schema validation
        const emptyFields = schemaFields.filter((f) => !f.value || f.value.trim() === "");
        if (emptyFields.length > 0) {
            warnings.push(`${emptyFields.length} field(s) have empty values.`);
            executionTasks.push({ name: "Schema Validation", status: "WARN", details: `${emptyFields.length} empty field(s)` });
        } else {
            executionTasks.push({ name: "Schema Validation", status: "PASS", details: `All ${schemaFields.length} fields populated` });
        }

        // Check 2: Link Security
        const linkFields = schemaFields.filter((f) => f.type === "link");
        const unsafeLinks = linkFields.filter((f) => f.value && f.value.toLowerCase().startsWith("javascript:"));
        if (unsafeLinks.length > 0) {
            errors.push(`Insecure javascript: links detected in ${unsafeLinks.length} field(s).`);
            executionTasks.push({ name: "Link Security Check", status: "FAIL", details: "Blocked javascript: pseudo-protocol" });
        } else {
            executionTasks.push({ name: "Link Security Check", status: "PASS", details: `Verified ${linkFields.length} link(s)` });
        }

        // Check 3: Image Accessibility
        const imageFields = schemaFields.filter((f) => f.type === "image");
        const missingAlt = imageFields.filter((f) => !f.alt || f.alt.trim() === "");
        if (missingAlt.length > 0) {
            warnings.push(`${missingAlt.length} image(s) are missing descriptive alt text.`);
            executionTasks.push({ name: "Image Accessibility", status: "WARN", details: `${missingAlt.length} image(s) missing alt text` });
        } else {
            executionTasks.push({ name: "Image Accessibility", status: "PASS", details: `All ${imageFields.length} image(s) have alt text` });
        }

        // Update GSD state
        state.currentPlanNum = Math.min(state.totalPlans, state.currentPlanNum + 1);
        state.phaseStatus = errors.length > 0 ? "Execution issues found" : "Phase complete";
        state.lastActivity = `Executed plan 01 for phase ${state.currentPhaseNum} (${executionTasks.filter(t => t.status === "PASS").length}/${executionTasks.length} checks passed)`;

        await saveGsdFiles(params.projectId, {
            stateMd: serializeState(state)
        });

        const summaryText = `# Plan 01 Execution Summary\n\nDate: ${new Date().toISOString()}\nPhase: ${state.currentPhaseNum}\n\n## Tasks Executed\n${executionTasks.map(t => `- [${t.status === "PASS" ? "x" : " "}] **${t.name}**: ${t.status} — ${t.details}`).join("\n")}\n\n## Outcome\n- Errors: ${errors.length}\n- Warnings: ${warnings.length}\n`;

        return NextResponse.json({
            success: errors.length === 0,
            status: errors.length === 0 ? "PASSED" : "FAILED",
            tasks: executionTasks,
            errors,
            warnings,
            artifacts: { summary: summaryText },
            message: errors.length === 0 ? "Plan executed successfully!" : "Plan execution found errors that must be resolved.",
        });
    }

    if (action === "verify") {
        // Run actual verification checks before completing
        const schemaFields = (project.generatedSchema as unknown as SchemaField[]) || [];
        const unsafeLinks = schemaFields.filter((f) => f.type === "link" && f.value?.toLowerCase().startsWith("javascript:"));

        if (unsafeLinks.length > 0) {
            return NextResponse.json({
                success: false,
                status: "VERIFICATION_FAILED",
                errors: ["Security verification failed: insecure links present in project schema."],
                message: "Cannot verify phase: security checks failed.",
            }, { status: 422 });
        }

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

        await saveGsdFiles(params.projectId, {
            stateMd: serializeState(state),
            contextMd: "",
            planMd: ""
        });

        return NextResponse.json({
            success: true,
            status: "VERIFIED",
            message: `Phase ${completedPhaseNum} verified successfully!`,
            state,
        });
    }

    if (action === "ship") {
        if (!isGithub) {
            return createErrorResponse(
                "GITHUB_REQUIRED",
                "Shipping a release requires a connected GitHub repository with write permissions.",
                400
            );
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
            return NextResponse.json({
                success: true,
                status: "PR_CREATED",
                message: `Created Pull Request: ${pr.data.html_url}`,
                url: pr.data.html_url,
                localSynced: true,
                githubSynced: true,
            });
        } catch (prError: unknown) {
            console.error("PR creation error:", prError);
            const msg = prError instanceof Error ? prError.message : "Failed to create pull request on GitHub";
            return createErrorResponse("PR_FAILED", `GitHub PR creation failed: ${msg}`, 502);
        }
    }

    return createErrorResponse("INVALID_ACTION", `Unknown GSD action: ${action}`, 400);
}
