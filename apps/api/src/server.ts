import { buildApp } from "./app.js";
import { prisma } from "./prisma.js";

const app = buildApp(prisma);
const port = Number(process.env.PORT ?? 4000);

const start = async () => {
  await app.listen({ port, host: "0.0.0.0" });
};

start().catch((error) => {
  app.log.error(error);
  void prisma.$disconnect();
  process.exit(1);
});
