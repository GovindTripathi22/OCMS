/**
 * GSD Core Markdown Parser & Serializer Utilities for OCMS.
 */

export interface GsdState {
    status: string;
    currentPhase: string;
    currentPhaseNum: number;
    totalPhases: number;
    currentPlanNum: number;
    totalPlans: number;
    phaseStatus: string;
    lastActivity: string;
    decisions: string[];
    blockers: string[];
}

export interface GsdPhase {
    number: string;
    name: string;
    description: string;
    status: "Not started" | "In progress" | "Complete";
    plans: Array<{ id: string; name: string; completed: boolean }>;
}

export interface GsdRequirement {
    id: string;
    category: string;
    description: string;
    completed: boolean;
}

/**
 * Parses STATE.md content into a structured object.
 */
export function parseState(md: string): GsdState {
    const state: GsdState = {
        status: "planning",
        currentPhase: "",
        currentPhaseNum: 1,
        totalPhases: 1,
        currentPlanNum: 0,
        totalPlans: 0,
        phaseStatus: "Planning",
        lastActivity: "",
        decisions: [],
        blockers: [],
    };

    // Extract frontmatter status
    const fmMatch = md.match(/^---\r?\n([\s\S]+?)\r?\n---/);
    if (fmMatch) {
        const fmContent = fmMatch[1];
        const statusMatch = fmContent.match(/status:\s*['"]?([a-zA-Z0-9_-]+)['"]?/);
        if (statusMatch) {
            state.status = statusMatch[1];
        }
    }

    // Extract Current Position
    const phaseMatch = md.match(/Phase:\s*\[?(\d+(?:\.\d+)?)\]?\s*of\s*\[?(\d+)\]?\s*(?:\(([^)]+)\))?/i);
    if (phaseMatch) {
        state.currentPhaseNum = parseInt(phaseMatch[1], 10);
        state.totalPhases = parseInt(phaseMatch[2], 10);
        state.currentPhase = phaseMatch[3] ? phaseMatch[3].trim() : "";
    }

    const planMatch = md.match(/Plan:\s*\[?(\d+)\]?\s*of\s*\[?(\d+)\]?/i);
    if (planMatch) {
        state.currentPlanNum = parseInt(planMatch[1], 10);
        state.totalPlans = parseInt(planMatch[2], 10);
    }

    const statusLineMatch = md.match(/Status:\s*\[?([^\]\r\n]+)\]?/i);
    if (statusLineMatch) {
        state.phaseStatus = statusLineMatch[1].trim();
    }

    const activityMatch = md.match(/Last activity:\s*(.+)/i);
    if (activityMatch) {
        state.lastActivity = activityMatch[1].trim();
    }

    // Extract Decisions section
    const decisionsSection = md.match(/### Decisions([\s\S]+?)(?:###|$)/i);
    if (decisionsSection) {
        const lines = decisionsSection[1].split("\n");
        for (const line of lines) {
            const cleanLine = line.replace(/^\s*-\s*\[?[^\]]*\]?\s*:/, "").replace(/^\s*-\s*/, "").trim();
            if (cleanLine && !cleanLine.toLowerCase().includes("decisions are logged") && !cleanLine.toLowerCase().includes("recent decisions")) {
                state.decisions.push(cleanLine);
            }
        }
    }

    // Extract Blockers/Concerns section
    const blockersSection = md.match(/### Blockers\/Concerns([\s\S]+?)(?:##|$)/i);
    if (blockersSection) {
        const lines = blockersSection[1].split("\n");
        for (const line of lines) {
            const cleanLine = line.replace(/^\s*-\s*\[?[^\]]*\]?\s*/, "").replace(/^\s*-\s*/, "").trim();
            if (cleanLine && !cleanLine.toLowerCase().includes("none yet")) {
                state.blockers.push(cleanLine);
            }
        }
    }

    return state;
}

/**
 * Parses ROADMAP.md content into a structured list of phases.
 */
export function parseRoadmap(md: string): GsdPhase[] {
    const phases: GsdPhase[] = [];
    const lines = md.split("\n");

    let currentPhase: GsdPhase | null = null;
    let isParsingPlans = false;

    for (const line of lines) {
        // Match Phase Header, e.g., "### Phase 1: Name" or "### Phase 2.1: Name (INSERTED)"
        const phaseHeaderMatch = line.match(/^###\s+Phase\s+(\d+(?:\.\d+)?):\s*(.+)/i);
        if (phaseHeaderMatch) {
            const phaseNum = phaseHeaderMatch[1];
            const phaseName = phaseHeaderMatch[2].replace(/\(INSERTED\)/i, "").trim();

            currentPhase = {
                number: phaseNum,
                name: phaseName,
                description: "",
                status: "Not started",
                plans: [],
            };
            phases.push(currentPhase);
            isParsingPlans = false;
            continue;
        }

        if (!currentPhase) continue;

        // Match Goal
        const goalMatch = line.match(/^\*\*Goal\*\*:\s*(.+)/i);
        if (goalMatch) {
            currentPhase.description = goalMatch[1].trim();
            continue;
        }

        // Match Plans header
        if (line.match(/^Plans:/i)) {
            isParsingPlans = true;
            continue;
        }

        // Match plan item, e.g. "- [ ] 01-01: description" or "- [x] 01-02: description"
        if (isParsingPlans) {
            const planItemMatch = line.match(/^\s*-\s*\[([ xX])\]\s*(\d+(?:\.\d+)?-\d+):\s*(.+)/);
            if (planItemMatch) {
                const completed = planItemMatch[1].trim().toLowerCase() === "x";
                const id = planItemMatch[2];
                const name = planItemMatch[3].trim();
                currentPhase.plans.push({ id, name, completed });
            }
        }
    }

    // Sync phase status based on plans completion
    for (const p of phases) {
        if (p.plans.length > 0) {
            const allDone = p.plans.every(pl => pl.completed);
            const someDone = p.plans.some(pl => pl.completed);
            p.status = allDone ? "Complete" : someDone ? "In progress" : "Not started";
        }
    }

    return phases;
}

/**
 * Parses REQUIREMENTS.md content into a checklist.
 */
export function parseRequirements(md: string): GsdRequirement[] {
    const requirements: GsdRequirement[] = [];
    const lines = md.split("\n");

    let currentCategory = "General";

    for (const line of lines) {
        // Category headers
        const headerMatch = line.match(/^###\s+(.+)/);
        if (headerMatch) {
            currentCategory = headerMatch[1].trim();
            continue;
        }

        // Match checklist item: "- [ ] **AUTH-01**: User can..."
        const reqMatch = line.match(/^\s*-\s*\[([ xX])\]\s*\*\*([A-Z0-9_-]+)\*\*:\s*(.+)/);
        if (reqMatch) {
            const completed = reqMatch[1].trim().toLowerCase() === "x";
            const id = reqMatch[2];
            const description = reqMatch[3].trim();

            requirements.push({
                id,
                category: currentCategory,
                description,
                completed,
            });
        }
    }

    return requirements;
}

/**
 * Serializes state to standard GSD STATE.md string.
 */
export function serializeState(state: GsdState): string {
    const totalPlans = state.totalPlans;
    const completedPlans = Math.round(state.currentPlanNum);
    const percent = totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;
    const filledBlocks = Math.round(percent / 10);
    const progressBar = "█".repeat(filledBlocks) + "░".repeat(10 - filledBlocks);

    const decisionsText = state.decisions.length > 0
        ? state.decisions.map(d => `- ${d}`).join("\n")
        : "None yet.";

    const blockersText = state.blockers.length > 0
        ? state.blockers.map(b => `- ${b}`).join("\n")
        : "None yet.";

    return `---
gsd_state_version: '1.0'
status: ${state.status}
progress:
  total_phases: ${state.totalPhases}
  completed_phases: ${state.currentPhaseNum - 1}
  total_plans: ${state.totalPlans}
  completed_plans: ${state.currentPlanNum}
  percent: ${percent}
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated ${new Date().toISOString().split('T')[0]})

**Core value:** Build Smarter. Edit Faster.
**Current focus:** ${state.currentPhase || "Phase " + state.currentPhaseNum}

## Current Position

Phase: ${state.currentPhaseNum} of ${state.totalPhases} (${state.currentPhase || "Phase " + state.currentPhaseNum})
Plan: ${state.currentPlanNum} of ${state.totalPlans} in current phase
Status: ${state.phaseStatus}
Last activity: ${state.lastActivity || new Date().toISOString().split('T')[0]}

Progress: [${progressBar}] ${percent}%

## Performance Metrics

**Velocity:**
- Total plans completed: ${completedPlans}
- Average duration: 15 min
- Total execution time: ${(completedPlans * 15 / 60).toFixed(1)} hours

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

${decisionsText}

### Pending Todos

None yet.

### Blockers/Concerns

${blockersText}

## Deferred Items

*(none)*

## Session Continuity

Last session: ${new Date().toISOString().replace('T', ' ').substring(0, 16)}
Stopped at: ${state.lastActivity || "Initialization"}
Resume file: None
`;
}
