import { Client, VoiceChannel } from "discord.js-selfbot-v13";
import {
  DiscordData,
  Account,
  RunningClient,
  IDiscordManager,
  MemoryUsage,
} from "../types";
import { UserInterface } from "../client/UserInterface";
import { SecurityManager } from "./SecurityManager";

// Định nghĩa global.gc cho TypeScript
declare global {
  namespace NodeJS {
    interface Global {
      gc?: () => void;
    }
  }
}

export class DiscordManager implements IDiscordManager {
  private runningClients: RunningClient[] = [];
  private ui: UserInterface;
  private securityManager: SecurityManager;
  private memoryMonitorInterval: NodeJS.Timeout | null = null;
  private isLowResourceMode: boolean = false;
  private connectionAttempts: Map<string, number> = new Map();
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_TIMEOUT = 5000; // 5 seconds
  private readonly MEMORY_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly HIGH_MEMORY_THRESHOLD = 500; // MB

  constructor(userInterface: UserInterface = new UserInterface()) {
    this.runningClients = [];
    this.ui = userInterface;
    this.securityManager = new SecurityManager(this.ui);
    this.startMemoryMonitor();
  }

  // Get all running clients
  getRunningClients(): RunningClient[] {
    return this.runningClients;
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitor(): void {
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
    }

    this.memoryMonitorInterval = setInterval(() => {
      const memoryUsage = this.getMemoryUsage();

      // Check if memory usage is high
      if (
        memoryUsage.heapUsedMB > this.HIGH_MEMORY_THRESHOLD &&
        !this.isLowResourceMode
      ) {
        this.ui.showWarning(
          `Phát hiện sử dụng bộ nhớ cao (${memoryUsage.heapUsedMB.toFixed(
            2
          )}MB). Đang chuyển sang chế độ tiết kiệm tài nguyên.`
        );
        this.isLowResourceMode = true;
        this.optimizeMemoryUsage();
      } else if (
        memoryUsage.heapUsedMB < this.HIGH_MEMORY_THRESHOLD * 0.7 &&
        this.isLowResourceMode
      ) {
        this.isLowResourceMode = false;
        this.ui.showInfo(
          `Đã trở lại chế độ bộ nhớ bình thường (${memoryUsage.heapUsedMB.toFixed(
            2
          )}MB).`
        );
      }
    }, this.MEMORY_CHECK_INTERVAL);
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage(): MemoryUsage {
    const memoryData = process.memoryUsage();
    return {
      rss: memoryData.rss,
      heapTotal: memoryData.heapTotal,
      heapUsed: memoryData.heapUsed,
      external: memoryData.external,
      arrayBuffers: memoryData.arrayBuffers || 0,
      rssMB: memoryData.rss / 1024 / 1024,
      heapTotalMB: memoryData.heapTotal / 1024 / 1024,
      heapUsedMB: memoryData.heapUsed / 1024 / 1024,
    };
  }

  /**
   * Optimize memory usage when running in low resource mode
   */
  private optimizeMemoryUsage(): void {
    // Reduce Discord.js cache sizes for clients
    for (const { client } of this.runningClients) {
      // Sweep client caches to free memory
      client.users.cache.clear();
      client.channels.cache.sweep(
        (channel) => channel.id !== client.voice?.connection?.channel?.id
      );
      client.guilds.cache.sweep(
        (guild) => guild.id !== client.voice?.connection?.channel?.guild?.id
      );

      // Force garbage collection if available (Node with --expose-gc flag)
      if (global.gc) {
        global.gc();
      }
    }
  }

  /**
   * Check Discord API status before connecting
   */
  private async checkDiscordAPIStatus(): Promise<boolean> {
    try {
      // Use Node's built-in https module to check Discord API status
      const https = require("https");

      return new Promise((resolve) => {
        const req = https.get(
          "https://discord.com/api/v9/gateway",
          (res: any) => {
            const { statusCode } = res;
            // 200 means API is up, 429 means rate limited but still up
            if (statusCode === 200 || statusCode === 429) {
              resolve(true);
            } else {
              resolve(false);
            }
          }
        );

        req.on("error", () => {
          resolve(false);
        });

        req.end();
      });
    } catch (error) {
      return false;
    }
  }

  // Connect an account to a voice channel
  async connectAccount(account: Account): Promise<Client | null> {
    // Check Discord API status first
    const apiStatus = await this.checkDiscordAPIStatus();
    if (!apiStatus) {
      this.ui.showError("Discord API đang gặp sự cố. Vui lòng thử lại sau.");
      return null;
    }

    // Giải mã token nếu được mã hóa
    const decryptedToken = this.securityManager.decryptToken(account.token);

    // Check if already connected
    const existingClient = this.runningClients.find(
      (rc) => rc.account.token === account.token
    );
    if (existingClient) {
      this.ui.showWarning(
        `Tài khoản ${
          account.name || "Không tên"
        } đã được kết nối. Ngắt kết nối trước.`
      );

      // Disconnect existing connection first
      if (existingClient.client.voice?.connection) {
        existingClient.client.voice.connection.disconnect();
      }
      existingClient.client.destroy();

      // Remove from running clients
      const index = this.runningClients.indexOf(existingClient);
      if (index !== -1) {
        this.runningClients.splice(index, 1);
      }

      // Reset connection attempts
      this.connectionAttempts.delete(account.token);
    }

    // Create new client with optimized options
    interface ClientWebSocketOptions {
      properties: {
        $browser: string;
      };
      large_threshold?: number;
    }

    interface SweepersMessagesOptions {
      interval: number;
      lifetime: number;
    }

    interface SweepersUsersOptions {
      interval: number;
      filter: () => (user: { id: string }) => boolean;
    }

    interface ClientSweepersOptions {
      messages?: SweepersMessagesOptions;
      users?: SweepersUsersOptions;
    }

    interface DiscordClientOptions {
      checkUpdate?: boolean;
      autoRedeemNitro?: boolean;
      patchVoice?: boolean;
      ws?: ClientWebSocketOptions;
      intents?: string[];
      sweepers?: ClientSweepersOptions;
    }

    const clientOptions: DiscordClientOptions = {
      checkUpdate: false,
      autoRedeemNitro: false,
      patchVoice: true,
      // Use low resource settings if in low resource mode
      ws: {
        properties: {
          $browser: "Discord Android", // Uses less resources than desktop client
        },
        large_threshold: this.isLowResourceMode ? 50 : 100, // Reduce guild member caching
      },
      // Disable unnecessary intents
      intents: ["GUILDS", "GUILD_VOICE_STATES"],
      // Minimal sweeping and caching in low resource mode
      sweepers: this.isLowResourceMode
        ? {
            messages: {
              interval: 60, // 1 minute
              lifetime: 120, // 2 minutes
            },
            users: {
              interval: 300, // 5 minutes
              filter: () => (user) => user.id !== account.token.split(".")[0],
            },
          }
        : undefined,
    };

    const client = new Client(clientOptions);

    // Setup connect handler
    client.on("ready", async () => {
      this.ui.showInfo(`Đã đăng nhập với tên ${client.user!.tag}`);

      const guild = client.guilds.cache.get(account.guildId);
      if (!guild) {
        this.ui.showError(`Không tìm thấy server ID: ${account.guildId}`);
        return;
      }

      const channel = guild.channels.cache.get(account.channelId);
      if (!channel) {
        this.ui.showError(`Không tìm thấy kênh ID: ${account.channelId}`);
        return;
      }

      if (channel instanceof VoiceChannel) {
        await client
          .voice!.joinChannel(account.channelId, {
            selfMute: account.selfMute,
            selfDeaf: account.selfDeaf,
            selfVideo: account.selfVideo,
          })
          .then(() => {
            this.ui.showSuccess(`Đã vào kênh voice: ${channel.name}`);
            this.setupAutoReconnect(client, account);
            // Reset connection attempts on success
            this.connectionAttempts.delete(account.token);
          })
          .catch((error) => {
            this.ui.showError(`Lỗi khi vào kênh voice: ${error}`);
          });
      } else {
        this.ui.showError(`Kênh không phải là kênh voice`);
      }
    });

    client.on("error", (error: Error) => {
      this.ui.showError(`Lỗi client: ${error}`);
    });

    // Handle client disconnection
    client.on("disconnect", () => {
      this.ui.showWarning(
        `Tài khoản ${account.name || "Không tên"} đã bị ngắt kết nối.`
      );

      // Remove from running clients
      const clientIndex = this.runningClients.findIndex(
        (rc) => rc.client === client
      );
      if (clientIndex !== -1) {
        this.runningClients.splice(clientIndex, 1);
      }
    });

    try {
      // Track connection attempts
      const attempts = this.connectionAttempts.get(account.token) || 0;
      if (attempts >= this.MAX_RECONNECT_ATTEMPTS) {
        this.ui.showError(
          `Đã thử kết nối ${attempts} lần không thành công. Tạm dừng kết nối tài khoản này.`
        );
        return null;
      }

      this.connectionAttempts.set(account.token, attempts + 1);

      // Sử dụng token đã giải mã để đăng nhập
      await client.login(decryptedToken);
      
      // Ghi lại nỗ lực đăng nhập thành công
      this.securityManager.recordLoginAttempt(account, this.securityManager.getCurrentIp(), true);
      
      this.runningClients.push({ client, account });
      return client;
    } catch (error) {
      this.ui.showError(`Lỗi đăng nhập: ${error}`);
      
      // Ghi lại nỗ lực đăng nhập thất bại
      this.securityManager.recordLoginAttempt(account, this.securityManager.getCurrentIp(), false);
      
      return null;
    }
  }

  // Disconnect all accounts from voice channels
  disconnectAll(): void {
    this.ui.showInfo("Đang ngắt kết nối tất cả tài khoản...");

    if (this.runningClients.length === 0) {
      this.ui.showWarning("Không có tài khoản nào đang kết nối.");
      return;
    }

    this.runningClients.forEach(({ client, account }) => {
      if (client.voice?.connection) {
        client.voice.connection.disconnect();
      }
      client.destroy();
      this.ui.showInfo(
        `Đã ngắt kết nối tài khoản: ${account.name || "Không tên"}`
      );
    });

    this.runningClients.length = 0;
    this.connectionAttempts.clear();
    this.ui.showSuccess("Đã ngắt kết nối tất cả tài khoản.");

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  // Get Discord data (servers, channels) from a token
  async getDiscordData(token: string): Promise<DiscordData> {
    // Giải mã token nếu được mã hóa
    const decryptedToken = this.securityManager.decryptToken(token);
    
    const client = new Client({
      // Use minimal options for data gathering
      ws: {
        properties: {
          $browser: "Discord Android"
        }
      }
    });
    
    // Create a Promise with timeout
    const loginWithTimeout = async (timeout = 15000) => {
      return new Promise<void>((resolve, reject) => {
        // Set up timeout
        const timeoutId = setTimeout(() => {
          client.destroy();
          reject(new Error("Đăng nhập timed out sau 15 giây, vui lòng kiểm tra lại token"));
        }, timeout);
        
        // Try to login với token đã giải mã
        client.login(decryptedToken)
          .then(() => {
            clearTimeout(timeoutId);
            resolve();
          })
          .catch((err) => {
            clearTimeout(timeoutId);
            reject(err);
          });
      });
    };

    try {
      // Simple regex to check if token is valid
      // Discord tokens typically have format: *.*.* or are around 59-72 characters long
      const tokenRegex =
        /(mfa\.[a-z0-9_-]{20,})|([a-z0-9_-]{23,28}\.[a-z0-9_-]{6,7}\.[a-z0-9_-]{27})/i;
      if (!tokenRegex.test(token)) {
        throw new Error("Token có định dạng không hợp lệ");
      }

      // Check API status before connecting
      const apiStatus = await this.checkDiscordAPIStatus();
      if (!apiStatus) {
        throw new Error("Discord API đang gặp sự cố. Vui lòng thử lại sau.");
      }

      // Login with timeout
      await loginWithTimeout();

      this.ui.showInfo(`Đã đăng nhập với tên ${client.user!.tag}`);

      // Get server list
      const servers = client.guilds.cache.map((guild) => ({
        name: guild.name,
        id: guild.id,
      }));

      // Sort by server name
      servers.sort((a, b) => a.name.localeCompare(b.name));

      // Function to get voice channels from a server
      const getVoiceChannels = (guildId: string) => {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
          return [];
        }

        // Get voice channel list
        const voiceChannels = guild.channels.cache
          .filter((channel) => channel instanceof VoiceChannel)
          .map((channel) => ({
            name: channel.name,
            id: channel.id,
          }));

        // Sort by channel name
        voiceChannels.sort((a, b) => a.name.localeCompare(b.name));

        return voiceChannels;
      };

      return {
        client,
        servers,
        getVoiceChannels,
      };
    } catch (error) {
      if (client) {
        client.destroy();
      }
      this.ui.showError("Lỗi khi đăng nhập: " + error);
      throw error; // Re-throw to handle at a higher level
    }
  }

  // Close Discord client when done
  closeDiscordClient(discordData: DiscordData): void {
    if (discordData.client) {
      discordData.client.destroy();
      this.ui.showInfo("Đã đóng kết nối Discord");
    }
  }

  /**
   * Enable auto-reconnect for an account
   */
  private setupAutoReconnect(client: Client, account: Account): void {
    client.on("voiceStateUpdate", (oldState, newState) => {
      // Check if this is our bot and it was disconnected from a voice channel
      if (
        oldState.member?.user.id === client.user?.id &&
        oldState.channelId &&
        !newState.channelId
      ) {
        this.ui.showWarning(
          `Tài khoản ${account.name} bị ngắt kết nối, đang thử kết nối lại...`
        );

        // Get current attempts for this account
        const attempts = this.connectionAttempts.get(account.token) || 0;
        if (attempts >= this.MAX_RECONNECT_ATTEMPTS) {
          this.ui.showError(
            `Đã thử kết nối lại ${attempts} lần không thành công. Đang dừng tự động kết nối lại.`
          );
          return;
        }

        this.connectionAttempts.set(account.token, attempts + 1);

        // Wait a moment before attempting to reconnect
        setTimeout(async () => {
          try {
            // Check if Discord API is available
            const apiStatus = await this.checkDiscordAPIStatus();
            if (!apiStatus) {
              this.ui.showError(
                "Discord API đang gặp sự cố. Không thể kết nối lại."
              );
              return;
            }

            const guild = client.guilds.cache.get(account.guildId);
            const channel = guild?.channels.cache.get(account.channelId);

            if (guild && channel && channel instanceof VoiceChannel) {
              await client.voice?.joinChannel(account.channelId, {
                selfDeaf: account.selfDeaf,
                selfMute: account.selfMute,
                selfVideo: account.selfVideo,
              });

              this.ui.showSuccess(`Đã kết nối lại ${account.name} thành công!`);
              // Reset connection attempts on success
              this.connectionAttempts.set(account.token, 0);
            }
          } catch (error) {
            this.ui.showError(
              `Không thể kết nối lại ${account.name}: ${error}`
            );
          }
        }, this.RECONNECT_TIMEOUT);
      }
    });
  }

  /**
   * Get timelapse between reconnects based on attempts
   * Exponential backoff strategy
   */
  private getReconnectDelay(attempts: number): number {
    // Base delay is 5 seconds
    // With each attempt, double the delay up to a maximum of 5 minutes
    const baseDelay = this.RECONNECT_TIMEOUT;
    const maxDelay = 5 * 60 * 1000; // 5 minutes

    // Calculate exponential backoff: 5s, 10s, 20s, 40s, ...
    const delay = baseDelay * Math.pow(2, attempts);

    // Cap at maximum delay
    return Math.min(delay, maxDelay);
  }

  /**
   * Cleanup resources when application is closing
   */
  cleanup(): void {
    // Stop memory monitor
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = null;
    }

    // Disconnect all clients
    this.disconnectAll();

    // Clear connection attempts
    this.connectionAttempts.clear();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }
}

// Create singleton instance and export functions for backward compatibility
export const discordManager = new DiscordManager();
export const connectAccount =
  discordManager.connectAccount.bind(discordManager);
export const disconnectAllAccounts =
  discordManager.disconnectAll.bind(discordManager);
export const getDiscordData =
  discordManager.getDiscordData.bind(discordManager);
export const closeDiscordClient =
  discordManager.closeDiscordClient.bind(discordManager);
export const runningClients = discordManager.getRunningClients();
