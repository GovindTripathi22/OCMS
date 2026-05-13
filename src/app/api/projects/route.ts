import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: Request) {
    try {
        const { url, name } = await req.json();
        
        if (!url) {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        // Get the current user or use a fallback "Guest" user for development
        const session = await auth();
        let userId = session?.user?.id;

        if (!userId) {
            // Check if a Guest user already exists
            let guestUser = await prisma.user.findFirst({
                where: { email: "guest@ocms.ai" }
            });

            if (!guestUser) {
                // Create a Guest user
                guestUser = await prisma.user.create({
                    data: {
                        name: "Guest User",
                        email: "guest@ocms.ai",
                    }
                });
            }
            userId = guestUser.id;
        }

        // Create the project
        const project = await prisma.project.create({
            data: {
                name: name || "Untitled Project",
                sourceUrl: url,
                userId: userId,
                // Default placeholder schema
                generatedSchema: [
                    { id: "hero-title", type: "text", label: "Hero Title", value: "Welcome to Our Site", selector: "h1" },
                    { id: "hero-subtitle", type: "text", label: "Subtitle", value: "Build something amazing today.", selector: ".subtitle" },
                    { id: "hero-image", type: "image", label: "Hero Image", value: "/placeholder.jpg", selector: "img.hero" },
                    { id: "cta-link", type: "link", label: "CTA Link", value: "/get-started", selector: "a.cta" },
                ]
            }
        });

        return NextResponse.json(project);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Failed to create project:", error);
        return NextResponse.json({ error: "Internal Server Error", details: message }, { status: 500 });
    }
}
