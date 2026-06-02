const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Fetching all projects...");
    const projects = await prisma.project.findMany();
    console.log("Projects:", JSON.stringify(projects, null, 2));

    console.log("Fetching all users...");
    const users = await prisma.user.findMany();
    console.log("Users:", JSON.stringify(users, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
