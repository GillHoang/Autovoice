import * as process from 'process';
import { Account } from '../types';
import { AccountManager } from '../manager/AccountManager';
import { DiscordManager } from '../manager/DiscordManager';
import { UserInterface } from './UserInterface';
import { ConfigManager } from '../manager/ConfigManager';

/**
 * Classe principale de l'application
 */
export class Application {
  private accountManager: AccountManager;
  private discordManager: DiscordManager;
  private ui: UserInterface;
  private isShuttingDown: boolean = false;

  constructor() {
    const configManager = new ConfigManager();
    this.ui = new UserInterface();
    this.accountManager = new AccountManager(configManager);
    this.discordManager = new DiscordManager(this.ui);

    // Use the newer signal handling for Node.js compatibility
    this.setupSignalHandlers();
  }

  /**
   * Set up signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    // Using AbortSignal.addEventListener - more compatible with newer Node.js versions
    const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;
    
    for (const signal of signals) {
      try {
        // Use AbortSignal for event handling to avoid direct process.on issues
        const abortController = new AbortController();
        const { signal: abortSignal } = abortController;
        
        process.on(signal, () => {
          if (!this.isShuttingDown) {
            this.isShuttingDown = true;
            this.ui.showInfo('\nĐang thoát chương trình...');
            this.discordManager.disconnectAll();
            process.exit(0);
          }
        });
      } catch (error) {
        // Fallback for older Node versions if needed
        console.warn(`Could not set up "${signal}" handler using AbortController. Using fallback.`);
      }
    }
  }

  /**
   * Démarrer l'application
   */
  async start(): Promise<void> {
    this.ui.showBanner();
    this.ui.showInfo('=== Discord Autovoice Tool Nâng Cao ===');
    await this.showMainMenu();
  }

  /**
   * Afficher le menu principal
   */
  private async showMainMenu(): Promise<void> {
    try {
      const { action } = await this.ui.showMainMenu();

      switch (action) {
        case 'connectAll':
          await this.connectAllAccounts();
          break;
        case 'connectOne':
          await this.connectOneAccount();
          break;
        case 'addAccount':
          await this.addAccount();
          break;
        case 'editAccount':
          await this.editAccount();
          break;
        case 'deleteAccount':
          await this.deleteAccount();
          break;
        case 'disconnectAll':
          this.discordManager.disconnectAll();
          break;
        case 'exit':
          this.ui.showInfo('Tạm biệt!');
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

  /**
   * Connect all accounts
   */
  private async connectAllAccounts(): Promise<void> {
    const accounts = this.accountManager.getAccounts();

    if (accounts.length === 0) {
      this.ui.showWarning("Không có tài khoản nào được cấu hình. Vui lòng thêm tài khoản trước.");
      return;
    }

    this.ui.showInfo(`Đang kết nối ${accounts.length} tài khoản...`);

    for (const account of accounts) {
      const spinner = this.ui.createSpinner(`Đang kết nối ${account.name || "Tài khoản không tên"}...`);
      spinner.start();
      
      try {
        await this.discordManager.connectAccount(account);
        spinner.succeed(`Đã kết nối ${account.name || "Tài khoản không tên"}`);
      } catch (error) {
        spinner.fail(`Không thể kết nối ${account.name || "Tài khoản không tên"}`);
      }
      
      // Wait between connections to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    this.ui.showSuccess("Hoàn tất kết nối tài khoản!");
  }

  /**
   * Connect one specific account
   */
  private async connectOneAccount(): Promise<void> {
    const accounts = this.accountManager.getAccounts();

    if (accounts.length === 0) {
      this.ui.showWarning("Không có tài khoản nào được cấu hình. Vui lòng thêm tài khoản trước.");
      return;
    }

    // Show account selection
    const { accountIndex } = await this.ui.showAccountSelection(accounts);
    const account = accounts[accountIndex];

    const spinner = this.ui.createSpinner(`Đang kết nối ${account.name || "Tài khoản không tên"}...`);
    spinner.start();
    
    try {
      await this.discordManager.connectAccount(account);
      spinner.succeed(`Đã kết nối ${account.name || "Tài khoản không tên"}`);
    } catch (error) {
      spinner.fail(`Không thể kết nối ${account.name || "Tài khoản không tên"}`);
    }
  }

  /**
   * Add a new account
   */
  private async addAccount(): Promise<void> {
    const accounts = this.accountManager.getAccounts();

    // Get account name and token
    const { name, token } = await this.ui.prompt<{name: string, token: string}>([
      {
        type: "input",
        name: "name",
        message: "Tên tài khoản (để nhận diện):",
        default: `Account ${accounts.length + 1}`,
      },
      {
        type: "input",
        name: "token",
        message: "Token Discord:",
        validate: (input: string) => input.trim() !== "" ? true : "Token không được để trống",
      }
    ]);

    // Check for duplicate tokens
    const existingAccount = accounts.find(acc => acc.token === token);
    if (existingAccount) {
      this.ui.showWarning(`Token này đã tồn tại trong danh sách với tên "${existingAccount.name || 'Không tên'}"`);
      
      const shouldContinue = await this.ui.prompt<{continue: boolean}>([
        {
          type: "confirm",
          name: "continue",
          message: "Bạn vẫn muốn thêm tài khoản này?",
          default: false,
        }
      ]);
      
      if (!shouldContinue.continue) {
        this.ui.showInfo("Đã hủy thêm tài khoản.");
        return;
      }
    }

    // Create spinner before trying to login
    const spinner = this.ui.createSpinner("Đang đăng nhập để lấy thông tin Discord...");
    spinner.start();
    
    try {
      // Get Discord data
      const discordData = await this.discordManager.getDiscordData(token);
      spinner.succeed("Đã đăng nhập thành công!");
      
      if (discordData.servers.length === 0) {
        this.ui.showWarning("Tài khoản này không có quyền truy cập vào bất kỳ server Discord nào.");
        this.discordManager.closeDiscordClient(discordData);
        return;
      }

      // Show server list for selection
      const { guildId } = await this.ui.prompt<{guildId: string}>([
        {
          type: "list",
          name: "guildId",
          message: "Chọn server Discord:",
          choices: discordData.servers.map(server => ({
            name: `${server.name} (${server.id})`,
            value: server.id
          }))
        }
      ]);

      // Get voice channel list from selected server
      const voiceChannels = discordData.getVoiceChannels(guildId);
      
      if (voiceChannels.length === 0) {
        this.ui.showWarning("Server này không có kênh voice nào.");
        this.discordManager.closeDiscordClient(discordData);
        return;
      }

      // Show voice channel list for selection
      const { channelId } = await this.ui.prompt<{channelId: string}>([
        {
          type: "list",
          name: "channelId",
          message: "Chọn kênh voice:",
          choices: voiceChannels.map(channel => ({
            name: `${channel.name} (${channel.id})`,
            value: channel.id
          }))
        }
      ]);

      // Get audio and video settings
      const voiceSettings = await this.ui.prompt<{selfMute: boolean, selfDeaf: boolean, selfVideo: boolean}>([
        {
          type: "confirm",
          name: "selfMute",
          message: "Tự động tắt mic?",
          default: true,
        },
        {
          type: "confirm",
          name: "selfDeaf",
          message: "Tự động tắt loa?",
          default: true,
        },
        {
          type: "confirm",
          name: "selfVideo",
          message: "Bật camera?",
          default: false,
        }
      ]);

      // Create new account and save to config
      const newAccount: Account = {
        name,
        token,
        guildId,
        channelId,
        ...voiceSettings
      };

      this.accountManager.addAccount(newAccount);
      this.ui.showSuccess("Đã thêm tài khoản mới thành công! 🎉");
      this.discordManager.closeDiscordClient(discordData);

    } catch (error: any) {
      // Make sure spinner stops with error state
      spinner.fail(`Không thể đăng nhập: ${error?.message || 'Lỗi không xác định'}`);
      this.ui.showError(`Không thể thêm tài khoản. Vui lòng kiểm tra lại token và thử lại.`);
    }
  }

  /**
   * Edit an existing account
   */
  private async editAccount(): Promise<void> {
    const accounts = this.accountManager.getAccounts();

    if (accounts.length === 0) {
      this.ui.showWarning("Không có tài khoản nào để chỉnh sửa.");
      return;
    }

    // Show account selection
    const { accountIndex } = await this.ui.showAccountSelection(accounts);
    const account = accounts[accountIndex];

    // Get basic info
    const { name, token, updateServerAndChannel } = await this.ui.prompt<{
      name: string, 
      token: string, 
      updateServerAndChannel: boolean
    }>([
      {
        type: "input",
        name: "name",
        message: "Tên tài khoản:",
        default: account.name,
      },
      {
        type: "input",
        name: "token",
        message: "Token Discord:",
        default: account.token,
        validate: (input: string) => {
          if (input.trim() === "") return "Token không được để trống";
          
          // Check for duplicate tokens
          const duplicateAccount = accounts.find(
            (acc, idx) => acc.token === input && idx !== accountIndex
          );
          
          if (duplicateAccount) {
            return `Token này đã tồn tại trong danh sách với tên "${duplicateAccount.name || 'Không tên'}"`;
          }
          
          return true;
        },
      },
      {
        type: "confirm",
        name: "updateServerAndChannel",
        message: "Bạn có muốn cập nhật server và kênh voice không?",
        default: false,
      }
    ]);

    let guildId = account.guildId;
    let channelId = account.channelId;

    // If user wants to update server and channel
    if (updateServerAndChannel) {
      try {
        // Get Discord data
        const spinner = this.ui.createSpinner("Đang đăng nhập để lấy thông tin Discord...");
        spinner.start();
        
        const discordData = await this.discordManager.getDiscordData(token);
        spinner.succeed("Đã đăng nhập thành công!");
        
        if (discordData.servers.length === 0) {
          this.ui.showWarning("Tài khoản này không có quyền truy cập vào bất kỳ server Discord nào.");
          this.discordManager.closeDiscordClient(discordData);
          return;
        }

        // Show server list for selection
        const serverSelection = await this.ui.prompt<{guildId: string}>([
          {
            type: "list",
            name: "guildId",
            message: "Chọn server Discord:",
            choices: discordData.servers.map(server => ({
              name: `${server.name} (${server.id})`,
              value: server.id
            })),
            default: discordData.servers.findIndex(s => s.id === account.guildId)
          }
        ]);

        guildId = serverSelection.guildId;

        // Get voice channel list from selected server
        const voiceChannels = discordData.getVoiceChannels(guildId);
        
        if (voiceChannels.length === 0) {
          this.ui.showWarning("Server này không có kênh voice nào.");
          this.discordManager.closeDiscordClient(discordData);
          return;
        }

        // Show voice channel list for selection
        const channelSelection = await this.ui.prompt<{channelId: string}>([
          {
            type: "list",
            name: "channelId",
            message: "Chọn kênh voice:",
            choices: voiceChannels.map(channel => ({
              name: `${channel.name} (${channel.id})`,
              value: channel.id
            })),
            default: voiceChannels.findIndex(c => c.id === account.channelId)
          }
        ]);

        channelId = channelSelection.channelId;
        this.discordManager.closeDiscordClient(discordData);
      } catch (error) {
        this.ui.showError(`Lỗi khi cập nhật server và kênh: ${error}`);
        return;
      }
    }

    // Get audio and video settings
    const voiceSettings = await this.ui.prompt<{selfMute: boolean, selfDeaf: boolean, selfVideo: boolean}>([
      {
        type: "confirm",
        name: "selfMute",
        message: "Tự động tắt mic?",
        default: account.selfMute,
      },
      {
        type: "confirm",
        name: "selfDeaf",
        message: "Tự động tắt loa?",
        default: account.selfDeaf,
      },
      {
        type: "confirm",
        name: "selfVideo",
        message: "Bật camera?",
        default: account.selfVideo,
      }
    ]);

    // Update account and save to config
    const updatedAccount: Account = {
      name,
      token,
      guildId,
      channelId,
      ...voiceSettings
    };

    this.accountManager.updateAccount(accountIndex, updatedAccount);
    this.ui.showSuccess("Đã cập nhật tài khoản thành công! 🔄");
  }

  /**
   * Delete an account
   */
  private async deleteAccount(): Promise<void> {
    const accounts = this.accountManager.getAccounts();

    if (accounts.length === 0) {
      this.ui.showWarning("Không có tài khoản nào để xóa.");
      return;
    }

    // Show account selection
    const { accountIndex } = await this.ui.showAccountSelection(accounts);

    // Confirm deletion
    const confirm = await this.ui.showConfirmDelete(accounts[accountIndex].name);
    
    if (confirm) {
      this.accountManager.deleteAccount(accountIndex);
      this.ui.showSuccess("Đã xóa tài khoản thành công! 🗑️");
    } else {
      this.ui.showInfo("Đã hủy xóa tài khoản.");
    }
  }
}