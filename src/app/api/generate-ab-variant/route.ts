import { NextRequest, NextResponse } from "next/server";
import type { SchemaField } from "@/types/schema";

function localAbRewrite(schema: SchemaField[], target: string): SchemaField[] {
    const tones: Record<string, {
        headline: string;
        subtitle: string;
        button: string;
        general: (val: string) => string;
    }> = {
        "gen-z": {
            headline: "No cap, the next-gen web platform is here. It's bussin'.",
            subtitle: "Main character energy for your content. Edit directly in the page without boomer lag. 100% free.",
            button: "LAUNCH INSTANTLY 🚀",
            general: (val) => val + " (fr fr, no cap)"
        },
        "corporate": {
            headline: "Optimize your enterprise digital value chain.",
            subtitle: "Achieve operational excellence and synergistic workflows with our industry-leading headless experience platform.",
            button: "SCHEDULE DEMO",
            general: (val) => "Leveraging " + val
        },
        "casual": {
            headline: "Hey there! We make editing websites super easy.",
            subtitle: "No complicated systems, no headaches. Just click and edit whatever you want, right in place.",
            button: "Let's Get Started!",
            general: (val) => val + " - simple as that!"
        },
        "luxury": {
            headline: "Exquisite digital experiences. Curated for you.",
            subtitle: "Indulge in premium content orchestration. Tailored craftsmanship meets ultimate performance.",
            button: "ENTER EXPERIENCE",
            general: (val) => "Bespoke " + val
        },
        "minimalist": {
            headline: "Less, but better.",
            subtitle: "Content. Streamlined. Local-first headless CMS.",
            button: "ENTER",
            general: (val) => val
        },
        "playful": {
            headline: "A site so fine, you'll want to edit all the time! 🥳",
            subtitle: "Wrangling content doesn't have to be a drag. Click anything, swap in a cool 3D model, and let's play!",
            button: "GIVE IT A SPIN! ✨",
            general: (val) => val + " 🎉"
        },
        "technical": {
            headline: "A local-first, zero-dependency content runtime.",
            subtitle: "Zero API latency, AST-driven JSX code patching, and custom PBR model variant pipeline.",
            button: "INITIALIZE CLIENT",
            general: (val) => "Compile-time " + val.charAt(0).toLowerCase() + val.slice(1)
        }
    };

    const tone = tones[target] || tones["casual"];

    return schema.map((field) => {
        if (field.type !== "text" && field.type !== "link") return field;
        if (!field.value || field.value.trim().length < 10) return field;
        
        let newValue = field.value;
        const id = (field.id || "").toLowerCase();
        
        if (id.includes("title") || id.includes("headline") || id.includes("main")) {
            newValue = tone.headline;
        } else if (id.includes("subtitle") || id.includes("description") || id.includes("desc") || id.includes("para")) {
            newValue = tone.subtitle;
        } else if (id.includes("button") || id.includes("cta") || id.includes("action") || id.includes("get-started")) {
            newValue = tone.button;
        } else {
            newValue = tone.general(field.value);
        }

        return { ...field, value: newValue };
    });
}

export async function POST(req: NextRequest) {
    try {
        const { schema, targetAudience } = await req.json();

        if (!schema || !targetAudience) {
            return NextResponse.json({ error: "schema and targetAudience are required" }, { status: 400 });
        }

        const newSchema = localAbRewrite(schema, targetAudience);

        return NextResponse.json({ schema: newSchema });
    } catch (err) {
        console.error("A/B Variant generation error:", err);
        return NextResponse.json({ error: "Failed to generate variant" }, { status: 500 });
    }
}
