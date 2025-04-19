import * as process from "process";
import { AccountManager } from "../manager/AccountManager";
import { DiscordManager } from "../manager/DiscordManager";
import { UserInterface } from "./UserInterface";
import { ConfigManager } from "../manager/ConfigManager";
import { SecurityManager } from "../manager/SecurityManager";
import { AccountModule } from "./modules/AccountModule";
import { GroupModule } from "./modules/GroupModule";
import { ScheduleModule } from "./modules/ScheduleModule";
import { SecurityModule } from "./modules/SecurityModule";
import { StatusMonitorModule } from "./modules/StatusMonitorModule";

export class Application {
  private accountManager: AccountManager;
  private discordManager: DiscordManager;
  private securityManager: SecurityManager;
  private ui: UserInterface;
  private isShuttingDown: boolean = false;

  // Application modules
  private accountModule: AccountModule;
  private groupModule: GroupModule;
  private scheduleModule: ScheduleModule;
  private securityModule: SecurityModule;
  private statusMonitorModule: StatusMonitorModule;

  constructor() {
    const configManager = new ConfigManager();
    this.ui = new UserInterface();
    this.accountManager = new AccountManager(configManager);
    this.discordManager = new DiscordManager(this.ui);
    this.securityManager = new SecurityManager(this.ui);

    // Initialize modules
    this.accountModule = new AccountModule(this.accountManager, this.discordManager, this.ui);
    this.groupModule = new GroupModule(this.accountManager, this.discordManager, this.ui);
    this.scheduleModule = new ScheduleModule(this.accountManager, this.discordManager, this.ui);
    this.securityModule = new SecurityModule(this.securityManager, this.ui);
    this.statusMonitorModule = new StatusMonitorModule(this.ui, this.discordManager);

    // Use the newer signal handling for Node.js compatibility
    this.setupSignalHandlers();
  }

  /**
   * Set up signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    // Using AbortSignal.addEventListener - more compatible with newer Node.js versions
    const signals = ["SIGINT", "SIGTERM", "SIGHUP"] as const;

    for (const signal of signals) {
      try {
        // Use AbortSignal for event handling to avoid direct process.on issues
        const abortController = new AbortController();
        const { signal: abortSignal } = abortController;

        process.on(signal, () => {
          if (!this.isShuttingDown) {
            this.isShuttingDown = true;
            this.ui.showInfo("\nĐang thoát chương trình...");
            this.discordManager.disconnectAll();
            this.discordManager.cleanup();
            // Make sure the status monitor is stopped
            this.statusMonitorModule.stopStatusMonitor();
            process.exit(0);
          }
        });
      } catch (error) {
        // Fallback for older Node versions if needed
        console.warn(
          `Could not set up "${signal}" handler using AbortController. Using fallback.`
        );
      }
    }
  }

  /**
   * Démarrer l'application
   */
  async start(): Promise<void> {
    this.ui.showBanner();
    this.ui.showInfo("=== Discord Autovoice Tool Nâng Cao ===");
    await this.showMainMenu();
  }

  /**
   * Afficher le menu principal
   */
  private async showMainMenu(): Promise<void> {
    try {
      const { action } = await this.ui.showMainMenu();

      switch (action) {
        case "connectAll":
          await this.accountModule.connectAllAccounts();
          break;
        case "connectOne":
          await this.accountModule.connectOneAccount();
          break;
        case "manageGroups":
          await this.groupModule.manageGroups();
          break;
        case "addAccount":
          await this.accountModule.addAccount();
          break;
        case "editAccount":
          await this.accountModule.editAccount();
          break;
        case "deleteAccount":
          await this.accountModule.deleteAccount();
          break;
        case "disconnectAll":
          this.discordManager.disconnectAll();
          break;
        case "statusMonitor":
          await this.statusMonitorModule.showStatusMonitor();
          break;
        case "scheduleAccounts":
          await this.scheduleModule.manageSchedules();
          break;
        case "securitySettings":
          await this.securityModule.manageSecuritySettings();
          break;
        case "exit":
          this.ui.showInfo("Tạm biệt!");
          this.discordManager.cleanup();
          process.exit(0);
          break;
      }

      // Return to main menu after action
      await this.showMainMenu();
    } catch (error) {
      this.ui.showError(`Lỗi trong menu chính: ${error}`);
      this.discordManager.disconnectAll();
    }
  }
}
