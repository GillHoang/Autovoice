import { Client, VoiceChannel } from "discord.js-selfbot-v13";
import { DiscordData, Account, RunningClient, IDiscordManager } from "../types";
import { UserInterface } from "../client/UserInterface";

export class DiscordManager implements IDiscordManager {
  private runningClients: RunningClient[] = [];
  private ui: UserInterface;

  constructor(userInterface: UserInterface = new UserInterface()) {
    this.runningClients = [];
    this.ui = userInterface;
  }

  // Get all running clients
  getRunningClients(): RunningClient[] {
    return this.runningClients;
  }

  // Connect an account to a voice channel
  async connectAccount(account: Account): Promise<Client | null> {
    const client = new Client();

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

    try {
      await client.login(account.token);
      this.runningClients.push({ client, account });
      return client;
    } catch (error) {
      this.ui.showError(`Lỗi đăng nhập: ${error}`);
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
      this.ui.showInfo(`Đã ngắt kết nối tài khoản: ${account.name || "Không tên"}`);
    });
    
    this.runningClients.length = 0;
    this.ui.showSuccess("Đã ngắt kết nối tất cả tài khoản.");
  }

  // Get Discord data (servers, channels) from a token
  async getDiscordData(token: string): Promise<DiscordData> {
    const client = new Client();
    
    // Create a Promise with timeout
    const loginWithTimeout = async (timeout = 15000) => {
      return new Promise<void>((resolve, reject) => {
        // Set up timeout
        const timeoutId = setTimeout(() => {
          client.destroy();
          reject(new Error("Đăng nhập timed out sau 15 giây, vui lòng kiểm tra lại token"));
        }, timeout);
        
        // Try to login
        client.login(token)
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
      const tokenRegex = /(mfa\.[a-z0-9_-]{20,})|([a-z0-9_-]{23,28}\.[a-z0-9_-]{6,7}\.[a-z0-9_-]{27})/i;
      if (!tokenRegex.test(token)) {
        throw new Error("Token có định dạng không hợp lệ");
      }
      
      // Login with timeout
      await loginWithTimeout();
      
      this.ui.showInfo(`Đã đăng nhập với tên ${client.user!.tag}`);
      
      // Get server list
      const servers = client.guilds.cache.map(guild => ({
        name: guild.name,
        id: guild.id
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
          .filter(channel => channel instanceof VoiceChannel)
          .map(channel => ({
            name: channel.name,
            id: channel.id
          }));
          
        // Sort by channel name
        voiceChannels.sort((a, b) => a.name.localeCompare(b.name));
        
        return voiceChannels;
      };
      
      return {
        client,
        servers,
        getVoiceChannels
      };
    } catch (error) {
      if (client) {
        client.destroy();
      }
      this.ui.showError('Lỗi khi đăng nhập: ' + error);
      throw error; // Re-throw to handle at a higher level
    }
  }

  // Close Discord client when done
  closeDiscordClient(discordData: DiscordData): void {
    if (discordData.client) {
      discordData.client.destroy();
      this.ui.showInfo('Đã đóng kết nối Discord');
    }
  }

  /**
   * Enable auto-reconnect for an account
   */
  private setupAutoReconnect(client: Client, account: Account): void {
    client.on('voiceStateUpdate', (oldState, newState) => {
      // Check if this is our bot and it was disconnected from a voice channel
      if (oldState.member?.user.id === client.user?.id && 
          oldState.channelId && !newState.channelId) {
        
        this.ui.showWarning(`Tài khoản ${account.name} bị ngắt kết nối, đang thử kết nối lại...`);
        
        // Wait a moment before attempting to reconnect
        setTimeout(async () => {
          try {
            const guild = client.guilds.cache.get(account.guildId);
            const channel = guild?.channels.cache.get(account.channelId);
            
            if (guild && channel && channel instanceof VoiceChannel) {
              await client.voice?.joinChannel(account.channelId, {
                selfDeaf: account.selfDeaf,
                selfMute: account.selfMute,
                selfVideo: account.selfVideo
              });
              
              this.ui.showSuccess(`Đã kết nối lại ${account.name} thành công!`);
            }
          } catch (error) {
            this.ui.showError(`Không thể kết nối lại ${account.name}: ${error}`);
          }
        }, 5000);
      }
    });
  }
}

// Create singleton instance and export functions for backward compatibility
export const discordManager = new DiscordManager();
export const connectAccount = discordManager.connectAccount.bind(discordManager);
export const disconnectAllAccounts = discordManager.disconnectAll.bind(discordManager);
export const getDiscordData = discordManager.getDiscordData.bind(discordManager);
export const closeDiscordClient = discordManager.closeDiscordClient.bind(discordManager);
export const runningClients = discordManager.getRunningClients();