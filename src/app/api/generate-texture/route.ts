import { NextRequest, NextResponse } from "next/server";

function generateProceduralSvgTexture(prompt: string): string {
    const p = prompt.toLowerCase();
    let svg = "";

    if (p.includes("wood")) {
        svg = `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
            <rect width="256" height="256" fill="#8B5A2B"/>
            <path d="M 0 40 Q 64 20 128 40 T 256 40 M 0 100 Q 80 120 160 100 T 256 100 M 0 180 Q 50 160 128 180 T 256 180" stroke="#5C3A21" stroke-width="4" fill="none" opacity="0.6"/>
            <path d="M 0 70 Q 120 90 200 70 T 256 70 M 0 140 Q 60 120 140 140 T 256 140 M 0 220 Q 90 240 180 220 T 256 220" stroke="#3D2314" stroke-width="2" fill="none" opacity="0.4"/>
        </svg>`;
    } else if (p.includes("metal") || p.includes("steel") || p.includes("iron")) {
        svg = `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#718096"/>
                    <stop offset="50%" stop-color="#cbd5e0"/>
                    <stop offset="100%" stop-color="#4a5568"/>
                </linearGradient>
            </defs>
            <rect width="256" height="256" fill="url(#g)"/>
            <line x1="0" y1="20" x2="256" y2="20" stroke="#fff" stroke-width="1" opacity="0.15"/>
            <line x1="0" y1="65" x2="256" y2="65" stroke="#000" stroke-width="1.5" opacity="0.2"/>
            <line x1="0" y1="120" x2="256" y2="120" stroke="#fff" stroke-width="1" opacity="0.15"/>
            <line x1="0" y1="185" x2="256" y2="185" stroke="#000" stroke-width="1.5" opacity="0.2"/>
            <line x1="0" y1="230" x2="256" y2="230" stroke="#fff" stroke-width="1" opacity="0.15"/>
        </svg>`;
    } else if (p.includes("rust") || p.includes("corrode")) {
        svg = `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
            <rect width="256" height="256" fill="#4A3B32"/>
            <circle cx="40" cy="50" r="25" fill="#B85A1C" opacity="0.7"/>
            <circle cx="180" cy="190" r="45" fill="#8B4513" opacity="0.6"/>
            <circle cx="210" cy="70" r="15" fill="#A0522D" opacity="0.8"/>
            <circle cx="90" cy="140" r="30" fill="#CD853F" opacity="0.5"/>
            <path d="M 0 0 L 256 256" stroke="#5C2E0B" stroke-width="8" opacity="0.3" stroke-dasharray="10, 15"/>
            <path d="M 256 0 L 0 256" stroke="#5C2E0B" stroke-width="6" opacity="0.3" stroke-dasharray="5, 20"/>
        </svg>`;
    } else if (p.includes("leather") || p.includes("skin")) {
        svg = `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
            <rect width="256" height="256" fill="#3D2314"/>
            <g opacity="0.15" stroke="#fff" stroke-width="0.5">
                <circle cx="10" cy="10" r="2" fill="none"/>
                <circle cx="50" cy="30" r="1.5" fill="none"/>
                <circle cx="90" cy="20" r="2.5" fill="none"/>
                <circle cx="140" cy="40" r="1.8" fill="none"/>
                <circle cx="190" cy="15" r="2" fill="none"/>
                <circle cx="230" cy="35" r="1.2" fill="none"/>
                <circle cx="30" cy="80" r="2" fill="none"/>
                <circle cx="70" cy="110" r="1.5" fill="none"/>
                <circle cx="110" cy="90" r="2.5" fill="none"/>
                <circle cx="160" cy="120" r="1.8" fill="none"/>
                <circle cx="200" cy="85" r="2" fill="none"/>
                <circle cx="240" cy="105" r="1.2" fill="none"/>
                <circle cx="20" cy="160" r="2" fill="none"/>
                <circle cx="60" cy="190" r="1.5" fill="none"/>
                <circle cx="100" cy="170" r="2.5" fill="none"/>
                <circle cx="150" cy="200" r="1.8" fill="none"/>
                <circle cx="180" cy="165" r="2" fill="none"/>
                <circle cx="220" cy="185" r="1.2" fill="none"/>
            </g>
        </svg>`;
    } else if (p.includes("brick") || p.includes("wall")) {
        svg = `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
            <rect width="256" height="256" fill="#A52A2A"/>
            <line x1="0" y1="64" x2="256" y2="64" stroke="#e2e8f0" stroke-width="4"/>
            <line x1="0" y1="128" x2="256" y2="128" stroke="#e2e8f0" stroke-width="4"/>
            <line x1="0" y1="192" x2="256" y2="192" stroke="#e2e8f0" stroke-width="4"/>
            <line x1="64" y1="0" x2="64" y2="64" stroke="#e2e8f0" stroke-width="4"/>
            <line x1="192" y1="0" x2="192" y2="64" stroke="#e2e8f0" stroke-width="4"/>
            <line x1="128" y1="64" x2="128" y2="128" stroke="#e2e8f0" stroke-width="4"/>
            <line x1="0" y1="64" x2="0" y2="128" stroke="#e2e8f0" stroke-width="4"/>
            <line x1="64" y1="128" x2="64" y2="192" stroke="#e2e8f0" stroke-width="4"/>
            <line x1="192" y1="128" x2="192" y2="192" stroke="#e2e8f0" stroke-width="4"/>
            <line x1="128" y1="192" x2="128" y2="256" stroke="#e2e8f0" stroke-width="4"/>
        </svg>`;
    } else if (p.includes("checker") || p.includes("chess") || p.includes("grid")) {
        svg = `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
            <rect width="256" height="256" fill="#fff"/>
            <rect x="0" y="0" width="128" height="128" fill="#000"/>
            <rect x="128" y="128" width="128" height="128" fill="#000"/>
        </svg>`;
    } else {
        svg = `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="d" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#4f46e5"/>
                    <stop offset="50%" stop-color="#ec4899"/>
                    <stop offset="100%" stop-color="#f59e0b"/>
                </linearGradient>
            </defs>
            <rect width="256" height="256" fill="url(#d)"/>
            <circle cx="128" cy="128" r="60" fill="none" stroke="#fff" stroke-width="4" opacity="0.3"/>
            <circle cx="128" cy="128" r="80" fill="none" stroke="#fff" stroke-width="2" opacity="0.15"/>
        </svg>`;
    }

    const base64 = Buffer.from(svg).toString("base64");
    return `data:image/svg+xml;base64,${base64}`;
}

export async function POST(req: NextRequest) {
    try {
        const { prompt } = await req.json();
        if (!prompt) {
            return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
        }

        const replicateToken = process.env.REPLICATE_API_TOKEN;

        if (replicateToken) {
            console.log(`[Texture Generator] Using Replicate to generate texture for prompt: "${prompt}"`);
            
            const response = await fetch("https://api.replicate.com/v1/predictions", {
                method: "POST",
                headers: {
                    "Authorization": `Token ${replicateToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    version: "7762fd07cf82c09fd0b1ad0910abc5e7d6940416972008442e222aace21213d8", // SDXL version hash
                    input: {
                        prompt: `${prompt}, seamless texture, tileable, PBR texture mapping, high-resolution`,
                        negative_prompt: "seams, borders, cutouts, text, watermarks",
                        width: 512,
                        height: 512,
                    }
                })
            });

            if (response.ok) {
                let prediction = await response.json();
                const predictionId = prediction.id;
                
                let completed = false;
                let attempts = 0;
                while (!completed && attempts < 15) {
                    await new Promise(r => setTimeout(r, 800));
                    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
                        headers: {
                            "Authorization": `Token ${replicateToken}`,
                        }
                    });
                    
                    if (pollRes.ok) {
                        prediction = await pollRes.json();
                        if (prediction.status === "succeeded") {
                            completed = true;
                            const imageUrl = prediction.output?.[0] || prediction.output;
                            if (imageUrl) {
                                return NextResponse.json({ textureUrl: imageUrl });
                            }
                        } else if (prediction.status === "failed" || prediction.status === "canceled") {
                            break;
                        }
                    }
                    attempts++;
                }
            }
            console.warn("[Texture Generator] Replicate failed or timed out. Falling back to procedural generation.");
        }

        const textureUrl = generateProceduralSvgTexture(prompt);
        return NextResponse.json({ textureUrl, isFallback: true });

    } catch (err: unknown) {
        console.error("Texture generation error:", err);
        const errMsg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: errMsg }, { status: 500 });
    }
}
