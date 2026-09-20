import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrate() {
  console.log("[Migration] Checking projects for legacy brandGuidelines.gsd data...");
  const projects = await prisma.project.findMany();
  let migratedCount = 0;

  for (const project of projects) {
    const guidelines = project.brandGuidelines;
    if (guidelines && typeof guidelines === "object" && "gsd" in guidelines) {
      const gsd = guidelines.gsd;
      const cleanGuidelines = { ...guidelines };
      delete cleanGuidelines.gsd;

      await prisma.project.update({
        where: { id: project.id },
        data: {
          gsdState: gsd.stateMd ? { stateMd: gsd.stateMd } : project.gsdState,
          gsdContext: gsd.contextMd ? { contextMd: gsd.contextMd } : project.gsdContext,
          gsdPlan: gsd.planMd ? { planMd: gsd.planMd } : project.gsdPlan,
          brandGuidelines: Object.keys(cleanGuidelines).length > 0 ? cleanGuidelines : null,
        },
      });
      migratedCount++;
    }
  }

  console.log(`[Migration] Done. Migrated ${migratedCount} projects.`);
}

migrate()
  .catch((e) => {
    console.error("[Migration Error]:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
