import chalk from "chalk";
import { Account, Group } from "../../types";
import { UserInterface } from "../UserInterface";
import { DiscordManager } from "../../manager/DiscordManager";

export class StatusMonitorModule {
  private ui: UserInterface;
  private discordManager: DiscordManager;
  private statusMonitorInterval: NodeJS.Timeout | null = null;

  constructor(ui: UserInterface, discordManager: DiscordManager) {
    this.ui = ui;
    this.discordManager = discordManager;
  }

  /**
   * Show status monitor to track all connected accounts
   */
  public async showStatusMonitor(): Promise<void> {
    const runningClients = this.discordManager.getRunningClients();

    if (runningClients.length === 0) {
      this.ui.showWarning(
        "Không có tài khoản nào đang kết nối. Vui lòng kết nối trước khi theo dõi trạng thái."
      );
      return;
    }

    // Clear screen
    console.clear();
    this.ui.showBanner();
    this.ui.showInfo("=== Bảng Theo Dõi Trạng Thái Kết Nối ===");
    this.ui.showInfo("Nhấn Ctrl+C để trở về menu chính");

    // Display initial status
    this.displayAccountStatus();

    // Set up interval to refresh status
    if (this.statusMonitorInterval) {
      clearInterval(this.statusMonitorInterval);
    }

    this.statusMonitorInterval = setInterval(() => {
      console.clear();
      this.ui.showBanner();
      this.ui.showInfo("=== Bảng Theo Dõi Trạng Thái Kết Nối ===");
      this.ui.showInfo("Nhấn Ctrl+C để trở về menu chính");
      this.displayAccountStatus();
    }, 5000); // Refresh every 5 seconds

    // Wait for user to press any key
    await new Promise<void>((resolve) => {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on("data", () => {
        if (this.statusMonitorInterval) {
          clearInterval(this.statusMonitorInterval);
          this.statusMonitorInterval = null;
        }
        process.stdin.setRawMode(false);
        process.stdin.pause();
        resolve();
      });
    });
  }

  /**
   * Stop status monitor if it's running
   */
  public stopStatusMonitor(): void {
    if (this.statusMonitorInterval) {
      clearInterval(this.statusMonitorInterval);
      this.statusMonitorInterval = null;
    }
  }

  /**
   * Format uptime from milliseconds to readable format
   */
  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }

  /**
   * Display status of all connected accounts with improved visuals
   */
  private displayAccountStatus(): void {
    const runningClients = this.discordManager.getRunningClients();
    const groups = this.getGroupsFromClients(runningClients);
    const totalAccounts = runningClients.length;

    // Create a map for faster group lookup
    const groupMap = new Map<string, Group>();
    for (const group of groups) {
      groupMap.set(group.id, group);
    }

    // Show header with stats
    console.log("\n");
    console.log(
      this.ui.createStatusHeader(runningClients.length, totalAccounts)
    );

    // Group clients by their group
    const groupedClients = new Map<string, typeof runningClients>();

    // Add "Ungrouped" category
    groupedClients.set("ungrouped", []);

    // Initialize groups
    groups.forEach((group) => {
      groupedClients.set(group.id, []);
    });

    // Categorize clients by group
    runningClients.forEach((client) => {
      const groupId = client.account.group;
      if (groupId && groupedClients.has(groupId)) {
        groupedClients.get(groupId)!.push(client);
      } else {
        groupedClients.get("ungrouped")!.push(client);
      }
    });

    // Display clients by group
    groupedClients.forEach((clients, groupId) => {
      if (clients.length === 0) return; // Skip empty groups

      // Get group name
      let groupName = "Chưa phân nhóm";
      if (groupId !== "ungrouped") {
        const group = groupMap.get(groupId);
        if (group) {
          groupName = group.name;
        }
      }

      // Show group header
      console.log(this.ui.createGroupHeader(groupName, clients.length));

      // Display accounts in this group
      clients.forEach((client, index) => {
        const { account } = client;
        const discordClient = client.client;

        // Get guild and channel info
        const guild = discordClient.guilds.cache.get(account.guildId);
        const channel = guild?.channels.cache.get(account.channelId);

        // Check connection status
        const isConnected =
          (discordClient.voice?.connection &&
            discordClient.voice.connection.channel.id === account.channelId) ||
          false;

        // Calculate uptime
        const uptime = discordClient.readyTimestamp
          ? this.formatUptime(Date.now() - discordClient.readyTimestamp)
          : "N/A";

        // Display account status card
        console.log(
          this.ui.createAccountStatusCard(
            index + 1,
            account.name || "Không tên",
            discordClient.user?.tag || "Unknown",
            guild?.name || "Không tìm thấy",
            channel?.name || "Không tìm thấy",
            isConnected,
            uptime,
            account.selfMute,
            account.selfDeaf,
            account.selfVideo
          )
        );
      });

      // Add separator between groups
      console.log(this.ui.separator());
    });

    // Show footer with help text
    console.log(this.ui.createStatusFooter());
  }

  /**
   * Get unique groups from client list
   */
  private getGroupsFromClients(clients: any[]): Group[] {
    const groupMap = new Map<string, Group>();
    
    clients.forEach(client => {
      if (client.account.group && !groupMap.has(client.account.group)) {
        // We don't have full group info from clients, so create minimal group objects
        groupMap.set(client.account.group, {
          id: client.account.group,
          name: client.account.groupName || client.account.group,
        });
      }
    });
    
    return Array.from(groupMap.values());
  }
}