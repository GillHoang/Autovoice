import { Application } from "./client/Application";

// Create and start the application
const app = new Application();
app.start().catch((error) => {
  console.error("Error starting application:", error);
  process.exit(1);
});
