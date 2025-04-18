import * as process from 'process';
import chalk from 'chalk';
import { Account, Group } from '../types';
import { AccountManager } from '../manager/AccountManager';
import { DiscordManager } from '../manager/DiscordManager';
import { UserInterface } from './UserInterface';
import { ConfigManager } from '../manager/ConfigManager';
import { v4 as uuidv4 } from 'uuid';

/**
 * Classe principale de l'application
 */
export class Application {
  private accountManager: AccountManager;
  private discordManager: DiscordManager;
  private ui: UserInterface;
  private isShuttingDown: boolean = false;
  private statusMonitorInterval: NodeJS.Timeout | null = null;

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
        case 'manageGroups':
          await this.manageGroups();
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
        case 'statusMonitor':
          await this.showStatusMonitor();
          break;
        case 'scheduleAccounts':
          await this.manageSchedules();
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
   * Quản lý nhóm tài khoản
   */
  private async manageGroups(): Promise<void> {
    try {
      const { action } = await this.ui.showGroupManagementMenu();

      switch (action) {
        case 'viewGroups':
          await this.viewGroups();
          break;
        case 'createGroup':
          await this.createGroup();
          break;
        case 'editGroup':
          await this.editGroup();
          break;
        case 'deleteGroup':
          await this.deleteGroup();
          break;
        case 'addAccountToGroup':
          await this.addAccountToGroup();
          break;
        case 'removeAccountFromGroup':
          await this.removeAccountFromGroup();
          break;
        case 'connectByGroup':
          await this.connectAccountsByGroup();
          break;
        case 'back':
          return;
      }

      // Return to group management menu after action
      await this.manageGroups();
    } catch (error) {
      this.ui.showError(`Lỗi khi quản lý nhóm: ${error}`);
    }
  }

  /**
   * Xem danh sách nhóm và các tài khoản trong mỗi nhóm
   */
  private async viewGroups(): Promise<void> {
    const groups = this.accountManager.getGroups();
    const accounts = this.accountManager.getAccounts();

    if (groups.length === 0) {
      this.ui.showWarning("Không có nhóm nào được tạo. Vui lòng tạo nhóm trước.");
      return;
    }

    this.ui.showInfo("=== Danh sách nhóm ===");
    
    groups.forEach(group => {
      const groupAccounts = accounts.filter(acc => acc.group === group.id);
      console.log(`\n📁 ${group.name}${group.description ? ` - ${group.description}` : ''}`);
      console.log(`   ID: ${group.id}`);
      console.log(`   Số tài khoản: ${groupAccounts.length}`);
      
      if (groupAccounts.length > 0) {
        console.log(`   Danh sách tài khoản:`);
        groupAccounts.forEach((acc, idx) => {
          console.log(`     ${idx + 1}. ${acc.name || 'Không tên'} (${acc.token.substring(0, 10)}...)`);
        });
      } else {
        console.log(`   Chưa có tài khoản nào trong nhóm này.`);
      }
    });

    // Show ungrouped accounts
    const ungroupedAccounts = accounts.filter(acc => !acc.group);
    if (ungroupedAccounts.length > 0) {
      console.log(`\n📁 Tài khoản chưa phân nhóm (${ungroupedAccounts.length}):`);
      ungroupedAccounts.forEach((acc, idx) => {
        console.log(`   ${idx + 1}. ${acc.name || 'Không tên'} (${acc.token.substring(0, 10)}...)`);
      });
    }

    // Wait for user to press enter to continue
    await this.ui.prompt([
      {
        type: 'input',
        name: 'continue',
        message: 'Nhấn Enter để tiếp tục...'
      }
    ]);
  }

  /**
   * Tạo nhóm mới
   */
  private async createGroup(): Promise<void> {
    const { name, description } = await this.ui.prompt<{ name: string, description: string }>([
      {
        type: 'input',
        name: 'name',
        message: 'Tên nhóm:',
        validate: (input: string) => input.trim() !== '' ? true : 'Tên nhóm không được để trống'
      },
      {
        type: 'input',
        name: 'description',
        message: 'Mô tả (tùy chọn):',
      }
    ]);

    const newGroup = this.accountManager.addGroup({ name, description });
    this.ui.showSuccess(`Đã tạo nhóm "${name}" thành công! 🎉`);
    
    // Ask if user wants to add accounts to this group
    const { addAccounts } = await this.ui.prompt<{ addAccounts: boolean }>([
      {
        type: 'confirm',
        name: 'addAccounts',
        message: 'Bạn có muốn thêm tài khoản vào nhóm này không?',
        default: true
      }
    ]);

    if (addAccounts) {
      await this.addAccountsToSpecificGroup(newGroup.id, newGroup.name);
    }
  }

  /**
   * Chỉnh sửa nhóm
   */
  private async editGroup(): Promise<void> {
    const groups = this.accountManager.getGroups();
    
    if (groups.length === 0) {
      this.ui.showWarning("Không có nhóm nào để chỉnh sửa.");
      return;
    }

    try {
      // Show group selection
      const { groupId } = await this.ui.showGroupSelection(groups);
      const group = groups.find(g => g.id === groupId);
      
      if (!group) {
        this.ui.showError("Không tìm thấy nhóm. Vui lòng thử lại.");
        return;
      }

      // Get new group info
      const { name, description } = await this.ui.prompt<{ name: string, description: string }>([
        {
          type: 'input',
          name: 'name',
          message: 'Tên nhóm mới:',
          default: group.name,
          validate: (input: string) => input.trim() !== '' ? true : 'Tên nhóm không được để trống'
        },
        {
          type: 'input',
          name: 'description',
          message: 'Mô tả mới (tùy chọn):',
          default: group.description || ''
        }
      ]);

      // Update group
      const updatedGroup = this.accountManager.updateGroup(groupId, { name, description });
      
      if (updatedGroup) {
        this.ui.showSuccess(`Đã cập nhật nhóm thành công! 🔄`);
      } else {
        this.ui.showError("Không thể cập nhật nhóm. Vui lòng thử lại.");
      }
    } catch (error) {
      this.ui.showError(`Lỗi khi chỉnh sửa nhóm: ${error}`);
    }
  }

  /**
   * Xóa nhóm
   */
  private async deleteGroup(): Promise<void> {
    const groups = this.accountManager.getGroups();
    
    if (groups.length === 0) {
      this.ui.showWarning("Không có nhóm nào để xóa.");
      return;
    }

    try {
      // Show group selection
      const { groupId } = await this.ui.showGroupSelection(groups);
      const group = groups.find(g => g.id === groupId);
      
      if (!group) {
        this.ui.showError("Không tìm thấy nhóm. Vui lòng thử lại.");
        return;
      }

      // Confirm deletion
      const { confirm } = await this.ui.prompt<{ confirm: boolean }>([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Bạn có chắc chắn muốn xóa nhóm "${group.name}"? Tài khoản sẽ không bị xóa.`,
          default: false
        }
      ]);

      if (!confirm) {
        this.ui.showInfo("Đã hủy xóa nhóm.");
        return;
      }

      // Delete group
      const success = this.accountManager.deleteGroup(groupId);
      
      if (success) {
        this.ui.showSuccess(`Đã xóa nhóm "${group.name}" thành công! 🗑️`);
      } else {
        this.ui.showError("Không thể xóa nhóm. Vui lòng thử lại.");
      }
    } catch (error) {
      this.ui.showError(`Lỗi khi xóa nhóm: ${error}`);
    }
  }

  /**
   * Thêm tài khoản vào nhóm
   */
  private async addAccountToGroup(): Promise<void> {
    const groups = this.accountManager.getGroups();
    
    if (groups.length === 0) {
      this.ui.showWarning("Không có nhóm nào. Vui lòng tạo nhóm trước.");
      return;
    }

    try {
      // Show group selection
      const { groupId } = await this.ui.showGroupSelection(groups);
      const group = groups.find(g => g.id === groupId);
      
      if (!group) {
        this.ui.showError("Không tìm thấy nhóm. Vui lòng thử lại.");
        return;
      }

      await this.addAccountsToSpecificGroup(groupId, group.name);
    } catch (error) {
      this.ui.showError(`Lỗi khi thêm tài khoản vào nhóm: ${error}`);
    }
  }

  /**
   * Thêm tài khoản vào một nhóm cụ thể
   */
  private async addAccountsToSpecificGroup(groupId: string, groupName: string): Promise<void> {
    const allAccounts = this.accountManager.getAccounts();
    const unassignedAccounts = allAccounts.filter(acc => acc.group !== groupId);
    const groups = this.accountManager.getGroups();
    
    if (unassignedAccounts.length === 0) {
      this.ui.showWarning("Không có tài khoản nào để thêm vào nhóm.");
      return;
    }

    // Show multi-select for accounts
    const { selectedAccountIndices } = await this.ui.prompt<{ selectedAccountIndices: number[] }>([
      {
        type: 'checkbox',
        name: 'selectedAccountIndices',
        message: `Chọn các tài khoản để thêm vào nhóm "${groupName}":`,
        choices: unassignedAccounts.map((acc, idx) => {
          const accountIndex = allAccounts.findIndex(a => a.token === acc.token);
          let displayName = `${acc.name || 'Không tên'} (${acc.token.substring(0, 10)}...)`;
          
          // Add current group info if account is in a different group
          if (acc.group) {
            const currentGroup = groups.find(g => g.id === acc.group);
            if (currentGroup) {
              displayName += ` [Hiện tại: ${currentGroup.name}]`;
            }
          }
          
          return {
            name: displayName,
            value: accountIndex,
            checked: false
          };
        })
      }
    ]);

    if (selectedAccountIndices.length === 0) {
      this.ui.showInfo("Không có tài khoản nào được chọn.");
      return;
    }

    // Add accounts to group
    let successCount = 0;
    for (const accountIndex of selectedAccountIndices) {
      const result = this.accountManager.assignAccountToGroup(accountIndex, groupId);
      if (result) successCount++;
    }

    this.ui.showSuccess(`Đã thêm ${successCount} tài khoản vào nhóm "${groupName}"! 🔄`);
  }

  /**
   * Xóa tài khoản khỏi nhóm
   */
  private async removeAccountFromGroup(): Promise<void> {
    const groups = this.accountManager.getGroups();
    const accounts = this.accountManager.getAccounts();
    const groupedAccounts = accounts.filter(acc => acc.group !== undefined);
    
    if (groupedAccounts.length === 0) {
      this.ui.showWarning("Không có tài khoản nào trong nhóm.");
      return;
    }

    try {
      // Create a map for faster group lookup
      const groupMap = new Map<string, Group>();
      for (const group of groups) {
        groupMap.set(group.id, group);
      }

      // Show account selection
      const { accountIndices } = await this.ui.prompt<{ accountIndices: number[] }>([
        {
          type: 'checkbox',
          name: 'accountIndices',
          message: 'Chọn tài khoản để xóa khỏi nhóm:',
          choices: groupedAccounts.map((acc, idx) => {
            const accountIndex = accounts.findIndex(a => a.token === acc.token);
            const group = acc.group ? groupMap.get(acc.group) : undefined;
            
            return {
              name: `${acc.name || 'Không tên'} (${acc.token.substring(0, 10)}...) [Nhóm: ${group?.name || 'Không xác định'}]`,
              value: accountIndex,
              checked: false
            };
          })
        }
      ]);

      if (accountIndices.length === 0) {
        this.ui.showInfo("Không có tài khoản nào được chọn.");
        return;
      }

      // Remove accounts from groups
      let successCount = 0;
      for (const accountIndex of accountIndices) {
        const result = this.accountManager.assignAccountToGroup(accountIndex, undefined);
        if (result) successCount++;
      }

      this.ui.showSuccess(`Đã xóa ${successCount} tài khoản khỏi nhóm! 🔄`);
    } catch (error) {
      this.ui.showError(`Lỗi khi xóa tài khoản khỏi nhóm: ${error}`);
    }
  }

  /**
   * Kết nối tài khoản theo nhóm
   */
  private async connectAccountsByGroup(): Promise<void> {
    const groups = this.accountManager.getGroups();
    
    if (groups.length === 0) {
      this.ui.showWarning("Không có nhóm nào. Vui lòng tạo nhóm trước.");
      return;
    }

    // Add "ungrouped accounts" option
    const groupChoices = [
      ...groups.map(group => ({
        name: `${group.name}${group.description ? ` - ${group.description}` : ''} (${this.accountManager.getAccountsByGroup(group.id).length} tài khoản)`,
        value: group.id
      })),
      {
        name: `Tài khoản chưa phân nhóm (${this.accountManager.getUngroupedAccounts().length} tài khoản)`,
        value: 'ungrouped'
      }
    ];

    try {
      // Show group selection
      const { selectedGroup } = await this.ui.prompt<{ selectedGroup: string }>([
        {
          type: 'list',
          name: 'selectedGroup',
          message: 'Chọn nhóm để kết nối:',
          choices: groupChoices
        }
      ]);

      // Get accounts in selected group
      let accountsToConnect: Account[];
      let groupName: string;
      
      if (selectedGroup === 'ungrouped') {
        accountsToConnect = this.accountManager.getUngroupedAccounts();
        groupName = "Chưa phân nhóm";
      } else {
        accountsToConnect = this.accountManager.getAccountsByGroup(selectedGroup);
        groupName = groups.find(g => g.id === selectedGroup)?.name || "Nhóm không xác định";
      }

      if (accountsToConnect.length === 0) {
        this.ui.showWarning(`Không có tài khoản nào trong nhóm "${groupName}".`);
        return;
      }

      // Confirm connection
      const { confirm } = await this.ui.prompt<{ confirm: boolean }>([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Kết nối ${accountsToConnect.length} tài khoản trong nhóm "${groupName}"?`,
          default: true
        }
      ]);

      if (!confirm) {
        this.ui.showInfo("Đã hủy kết nối tài khoản.");
        return;
      }

      // Connect accounts
      this.ui.showInfo(`Đang kết nối ${accountsToConnect.length} tài khoản trong nhóm "${groupName}"...`);

      for (const account of accountsToConnect) {
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
      
      this.ui.showSuccess(`Hoàn tất kết nối tài khoản trong nhóm "${groupName}"! 🎉`);
    } catch (error) {
      this.ui.showError(`Lỗi khi kết nối tài khoản theo nhóm: ${error}`);
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

      // Ask if user wants to add this account to a group
      const groups = this.accountManager.getGroups();
      let groupId: string | undefined = undefined;

      if (groups.length > 0) {
        const { addToGroup } = await this.ui.prompt<{ addToGroup: boolean }>([
          {
            type: "confirm",
            name: "addToGroup",
            message: "Thêm tài khoản này vào một nhóm?",
            default: false,
          }
        ]);

        if (addToGroup) {
          const { selectedGroup } = await this.ui.prompt<{ selectedGroup: string }>([
            {
              type: "list",
              name: "selectedGroup",
              message: "Chọn nhóm:",
              choices: [
                ...groups.map(group => ({
                  name: `${group.name}${group.description ? ` - ${group.description}` : ''}`,
                  value: group.id
                })),
                { name: "Không thêm vào nhóm nào", value: "none" }
              ]
            }
          ]);

          if (selectedGroup !== "none") {
            groupId = selectedGroup;
          }
        }
      }

      // Create new account and save to config
      const newAccount: Account = {
        name,
        token,
        guildId,
        channelId,
        ...voiceSettings,
        group: groupId
      };

      this.accountManager.addAccount(newAccount);
      this.ui.showSuccess("Đã thêm tài khoản mới thành công! 🎉");
      
      if (groupId) {
        const groupName = groups.find(g => g.id === groupId)?.name || "Không tên";
        this.ui.showSuccess(`Tài khoản đã được thêm vào nhóm "${groupName}" 📁`);
      }
      
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
    const groups = this.accountManager.getGroups();

    if (accounts.length === 0) {
      this.ui.showWarning("Không có tài khoản nào để chỉnh sửa.");
      return;
    }

    // Show account selection with group info if available
    const { accountIndex } = groups.length > 0 
      ? await this.ui.showAccountSelectionWithGroups(accounts, groups)
      : await this.ui.showAccountSelection(accounts);
      
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

    // Ask if user wants to change group
    let groupId = account.group;
    
    if (groups.length > 0) {
      const { updateGroup } = await this.ui.prompt<{ updateGroup: boolean }>([
        {
          type: "confirm",
          name: "updateGroup",
          message: "Bạn có muốn thay đổi nhóm cho tài khoản này?",
          default: false,
        }
      ]);

      if (updateGroup) {
        // Get current group name if assigned
        let currentGroupName = "Chưa phân nhóm";
        if (account.group) {
          const currentGroup = groups.find(g => g.id === account.group);
          if (currentGroup) {
            currentGroupName = currentGroup.name;
          }
        }

        const { selectedGroup } = await this.ui.prompt<{ selectedGroup: string }>([
          {
            type: "list",
            name: "selectedGroup",
            message: `Chọn nhóm (hiện tại: ${currentGroupName}):`,
            choices: [
              ...groups.map(group => ({
                name: `${group.name}${group.description ? ` - ${group.description}` : ''}`,
                value: group.id
              })),
              { name: "Không thuộc nhóm nào", value: "none" }
            ],
            default: groups.findIndex(g => g.id === account.group)
          }
        ]);

        if (selectedGroup === "none") {
          groupId = undefined;
        } else {
          groupId = selectedGroup;
        }
      }
    }

    // Update account and save to config
    const updatedAccount: Account = {
      name,
      token,
      guildId,
      channelId,
      ...voiceSettings,
      group: groupId
    };

    this.accountManager.updateAccount(accountIndex, updatedAccount);
    this.ui.showSuccess("Đã cập nhật tài khoản thành công! 🔄");
    
    if (groupId !== account.group) {
      if (!groupId) {
        this.ui.showInfo("Tài khoản đã được xóa khỏi nhóm.");
      } else {
        const groupName = groups.find(g => g.id === groupId)?.name || "Không tên";
        this.ui.showInfo(`Tài khoản đã được thêm vào nhóm "${groupName}".`);
      }
    }
  }

  /**
   * Delete an account
   */
  private async deleteAccount(): Promise<void> {
    const accounts = this.accountManager.getAccounts();
    const groups = this.accountManager.getGroups();

    if (accounts.length === 0) {
      this.ui.showWarning("Không có tài khoản nào để xóa.");
      return;
    }

    // Show account selection
    const { accountIndex } = groups.length > 0 
      ? await this.ui.showAccountSelectionWithGroups(accounts, groups)
      : await this.ui.showAccountSelection(accounts);

    // Confirm deletion
    const confirm = await this.ui.showConfirmDelete(accounts[accountIndex].name);
    
    if (confirm) {
      this.accountManager.deleteAccount(accountIndex);
      this.ui.showSuccess("Đã xóa tài khoản thành công! 🗑️");
    } else {
      this.ui.showInfo("Đã hủy xóa tài khoản.");
    }
  }

  /**
   * Show status monitor to track all connected accounts
   */
  private async showStatusMonitor(): Promise<void> {
    const runningClients = this.discordManager.getRunningClients();
    
    if (runningClients.length === 0) {
      this.ui.showWarning("Không có tài khoản nào đang kết nối. Vui lòng kết nối trước khi theo dõi trạng thái.");
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
      process.stdin.on('data', () => {
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
    const groups = this.accountManager.getGroups();
    const totalAccounts = this.accountManager.getAccounts().length;
    
    // Create a map for faster group lookup
    const groupMap = new Map<string, Group>();
    for (const group of groups) {
      groupMap.set(group.id, group);
    }
    
    // Show header with stats
    console.log('\n');
    console.log(this.ui.createStatusHeader(runningClients.length, totalAccounts));
    
    // Group clients by their group
    const groupedClients = new Map<string, typeof runningClients>();
    
    // Add "Ungrouped" category
    groupedClients.set('ungrouped', []);
    
    // Initialize groups
    groups.forEach(group => {
      groupedClients.set(group.id, []);
    });
    
    // Categorize clients by group
    runningClients.forEach(client => {
      const groupId = client.account.group;
      if (groupId && groupedClients.has(groupId)) {
        groupedClients.get(groupId)!.push(client);
      } else {
        groupedClients.get('ungrouped')!.push(client);
      }
    });
    
    // Display clients by group
    groupedClients.forEach((clients, groupId) => {
      if (clients.length === 0) return; // Skip empty groups
      
      // Get group name
      let groupName = "Chưa phân nhóm";
      if (groupId !== 'ungrouped') {
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
        const isConnected = (discordClient.voice?.connection && discordClient.voice.connection.channel.id === account.channelId) || false;
        
        // Calculate uptime
        const uptime = discordClient.readyTimestamp 
          ? this.formatUptime(Date.now() - discordClient.readyTimestamp) 
          : 'N/A';
        
        // Display account status card
        console.log(this.ui.createAccountStatusCard(
          index + 1,
          account.name || 'Không tên',
          discordClient.user?.tag || 'Unknown',
          guild?.name || 'Không tìm thấy',
          channel?.name || 'Không tìm thấy',
          isConnected,
          uptime,
          account.selfMute,
          account.selfDeaf,
          account.selfVideo
        ));
      });
      
      // Add separator between groups
      console.log(this.ui.separator());
    });
    
    // Show footer with help text
    console.log(this.ui.createStatusFooter());
  }

  /**
   * Manage account schedules
   */
  private async manageSchedules(): Promise<void> {
    const accounts = this.accountManager.getAccounts();
    
    if (accounts.length === 0) {
      this.ui.showWarning("Không có tài khoản nào để lên lịch. Vui lòng thêm tài khoản trước.");
      return;
    }
    
    // Show schedule management menu
    const { action } = await this.ui.prompt<{ action: string }>([
      {
        type: 'list',
        name: 'action',
        message: 'Quản lý lịch kết nối tự động:',
        choices: [
          { name: 'Xem danh sách lịch kết nối', value: 'viewSchedules' },
          { name: 'Thêm lịch kết nối mới', value: 'addSchedule' },
          { name: 'Xóa lịch kết nối', value: 'removeSchedule' },
          { name: 'Kích hoạt tất cả lịch kết nối', value: 'activateSchedules' },
          { name: 'Lên lịch theo nhóm', value: 'scheduleByGroup' },
          { name: 'Quay lại', value: 'back' }
        ]
      }
    ]);
    
    switch (action) {
      case 'viewSchedules':
        this.viewSchedules();
        break;
      case 'addSchedule':
        await this.addSchedule();
        break;
      case 'removeSchedule':
        await this.removeSchedule();
        break;
      case 'activateSchedules':
        this.activateSchedules();
        break;
      case 'scheduleByGroup':
        await this.scheduleByGroup();
        break;
      case 'back':
        return;
    }

    // Return to schedule management menu after action
    await this.manageSchedules();
  }
  
  /**
   * View all scheduled accounts
   */
  private viewSchedules(): void {
    const schedules = this.accountManager.getSchedules();
    const groups = this.accountManager.getGroups();
    
    // Create a map for faster group lookup
    const groupMap = new Map<string, Group>();
    for (const group of groups) {
      groupMap.set(group.id, group);
    }
    
    if (schedules.length === 0) {
      this.ui.showWarning("Không có lịch kết nối nào được thiết lập.");
      return;
    }
    
    this.ui.showInfo("=== Danh sách lịch kết nối tự động ===");
    
    // Create readable table for display
    const table: {
      STT: number;
      'Tên tài khoản': string;
      'Nhóm': string;
      'Giờ kết nối': string;
      'Giờ ngắt kết nối': string;
      'Ngày trong tuần': string;
    }[] = [];
    
    // Day mapping for better readability
    const daysMap = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    
    schedules.forEach((schedule, index) => {
      // Get account to find group
      const account = this.accountManager.getAccount(schedule.accountIndex);
      let groupName = "Không có";
      if (account.group && groupMap.has(account.group)) {
        groupName = groupMap.get(account.group)!.name;
      }
      
      table.push({
        STT: index + 1,
        'Tên tài khoản': schedule.accountName,
        'Nhóm': groupName,
        'Giờ kết nối': schedule.connectTime || 'Chưa đặt',
        'Giờ ngắt kết nối': schedule.disconnectTime || 'Chưa đặt',
        'Ngày trong tuần': schedule.daysOfWeek ? 
          schedule.daysOfWeek.map(day => daysMap[day]).join(', ') : 
          'Mỗi ngày'
      });
    });
    
    console.table(table);
  }
  
  /**
   * Add a new schedule
   */
  private async addSchedule(): Promise<void> {
    const accounts = this.accountManager.getAccounts();
    const groups = this.accountManager.getGroups();
    
    // Show account selection with group info if available
    const { accountIndex } = groups.length > 0 
      ? await this.ui.showAccountSelectionWithGroups(accounts, groups)
      : await this.ui.showAccountSelection(accounts);
      
    const account = accounts[accountIndex];
    
    this.ui.showInfo(`Thiết lập lịch trình cho tài khoản: ${account.name || "Không tên"}`);
    
    const { scheduleType } = await this.ui.prompt<{ scheduleType: string }>([
      {
        type: 'list',
        name: 'scheduleType',
        message: 'Chọn loại lịch:',
        choices: [
          { name: 'Lịch kết nối', value: 'connect' },
          { name: 'Lịch ngắt kết nối', value: 'disconnect' },
          { name: 'Cả hai', value: 'both' }
        ]
      }
    ]);
    
    // Get days of week
    const { selectedDays } = await this.ui.prompt<{ selectedDays: number[] }>([
      {
        type: 'checkbox',
        name: 'selectedDays',
        message: 'Chọn ngày trong tuần:',
        choices: [
          { name: 'Chủ nhật', value: 0 },
          { name: 'Thứ 2', value: 1 },
          { name: 'Thứ 3', value: 2 },
          { name: 'Thứ 4', value: 3 },
          { name: 'Thứ 5', value: 4 },
          { name: 'Thứ 6', value: 5 },
          { name: 'Thứ 7', value: 6 }
        ],
        default: [0, 1, 2, 3, 4, 5, 6]
      }
    ]);
    
    let connectTime: string | undefined;
    let disconnectTime: string | undefined;
    
    if (scheduleType === 'connect' || scheduleType === 'both') {
      const { time } = await this.ui.prompt<{ time: string }>([
        {
          type: 'input',
          name: 'time',
          message: 'Thời gian kết nối (HH:MM):',
          validate: (input: string) => {
            // Simple validation for HH:MM format
            const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
            if (!regex.test(input)) {
              return 'Vui lòng nhập đúng định dạng HH:MM (ví dụ: 08:30)';
            }
            return true;
          }
        }
      ]);
      connectTime = time;
    }
    
    if (scheduleType === 'disconnect' || scheduleType === 'both') {
      const { time } = await this.ui.prompt<{ time: string }>([
        {
          type: 'input',
          name: 'time',
          message: 'Thời gian ngắt kết nối (HH:MM):',
          validate: (input: string) => {
            // Simple validation for HH:MM format
            const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
            if (!regex.test(input)) {
              return 'Vui lòng nhập đúng định dạng HH:MM (ví dụ: 17:30)';
            }
            return true;
          }
        }
      ]);
      disconnectTime = time;
    }
    
    let result = false;
    
    // Set up schedules as requested
    if (connectTime) {
      result = this.accountManager.scheduleConnect(accountIndex, connectTime, selectedDays);
      if (result) {
        this.ui.showSuccess(`Đã thiết lập lịch kết nối cho tài khoản ${account.name || "Không tên"} vào lúc ${connectTime}`);
      } else {
        this.ui.showError(`Không thể thiết lập lịch kết nối. Vui lòng kiểm tra lại thời gian.`);
      }
    }
    
    if (disconnectTime) {
      result = this.accountManager.scheduleDisconnect(accountIndex, disconnectTime, selectedDays);
      if (result) {
        this.ui.showSuccess(`Đã thiết lập lịch ngắt kết nối cho tài khoản ${account.name || "Không tên"} vào lúc ${disconnectTime}`);
      } else {
        this.ui.showError(`Không thể thiết lập lịch ngắt kết nối. Vui lòng kiểm tra lại thời gian.`);
      }
    }
    
    // Confirm and activate if requested
    const { activate } = await this.ui.prompt<{ activate: boolean }>([
      {
        type: 'confirm',
        name: 'activate',
        message: 'Bạn có muốn kích hoạt lịch này ngay bây giờ không?',
        default: true
      }
    ]);
    
    if (activate) {
      this.activateSchedules();
    }
  }
  
  /**
   * Remove a schedule
   */
  private async removeSchedule(): Promise<void> {
    const schedules = this.accountManager.getSchedules();
    
    if (schedules.length === 0) {
      this.ui.showWarning("Không có lịch kết nối nào để xóa.");
      return;
    }
    
    // Day mapping for better readability
    const daysMap = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    
    // Show schedule selection
    const { scheduleIndex } = await this.ui.prompt<{ scheduleIndex: number }>([
      {
        type: 'list',
        name: 'scheduleIndex',
        message: 'Chọn lịch kết nối để xóa:',
        choices: schedules.map((schedule, index) => ({
          name: `${schedule.accountName} - Kết nối: ${schedule.connectTime || 'Chưa đặt'}, Ngắt: ${schedule.disconnectTime || 'Chưa đặt'} - ${schedule.daysOfWeek ? schedule.daysOfWeek.map(d => daysMap[d]).join(', ') : 'Mỗi ngày'}`,
          value: index
        }))
      }
    ]);
    
    // Confirm deletion
    const { confirm } = await this.ui.prompt<{ confirm: boolean }>([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Bạn có chắc chắn muốn xóa lịch kết nối này?`,
        default: false
      }
    ]);
    
    if (confirm) {
      this.accountManager.removeSchedule(schedules[scheduleIndex].accountIndex);
      this.ui.showSuccess("Đã xóa lịch kết nối thành công!");
    } else {
      this.ui.showInfo("Đã hủy xóa lịch kết nối.");
    }
  }

  /**
   * Schedule connections by group
   */
  private async scheduleByGroup(): Promise<void> {
    const groups = this.accountManager.getGroups();
    
    if (groups.length === 0) {
      this.ui.showWarning("Không có nhóm nào để lên lịch. Vui lòng tạo nhóm trước.");
      return;
    }

    // Add "ungrouped accounts" option
    const groupChoices = [
      ...groups.map(group => ({
        name: `${group.name}${group.description ? ` - ${group.description}` : ''} (${this.accountManager.getAccountsByGroup(group.id).length} tài khoản)`,
        value: group.id
      })),
      {
        name: `Tài khoản chưa phân nhóm (${this.accountManager.getUngroupedAccounts().length} tài khoản)`,
        value: 'ungrouped'
      }
    ];

    try {
      // Show group selection
      const { selectedGroup } = await this.ui.prompt<{ selectedGroup: string }>([
        {
          type: 'list',
          name: 'selectedGroup',
          message: 'Chọn nhóm để lên lịch:',
          choices: groupChoices
        }
      ]);

      // Get accounts in selected group
      let accountsToSchedule: Account[];
      let groupName: string;
      
      if (selectedGroup === 'ungrouped') {
        accountsToSchedule = this.accountManager.getUngroupedAccounts();
        groupName = "Chưa phân nhóm";
      } else {
        accountsToSchedule = this.accountManager.getAccountsByGroup(selectedGroup);
        groupName = groups.find(g => g.id === selectedGroup)?.name || "Nhóm không xác định";
      }

      if (accountsToSchedule.length === 0) {
        this.ui.showWarning(`Không có tài khoản nào trong nhóm "${groupName}".`);
        return;
      }

      this.ui.showInfo(`Thiết lập lịch trình cho nhóm: ${groupName} (${accountsToSchedule.length} tài khoản)`);
      
      const { scheduleType } = await this.ui.prompt<{ scheduleType: string }>([
        {
          type: 'list',
          name: 'scheduleType',
          message: 'Chọn loại lịch:',
          choices: [
            { name: 'Lịch kết nối', value: 'connect' },
            { name: 'Lịch ngắt kết nối', value: 'disconnect' },
            { name: 'Cả hai', value: 'both' }
          ]
        }
      ]);
      
      // Get days of week
      const { selectedDays } = await this.ui.prompt<{ selectedDays: number[] }>([
        {
          type: 'checkbox',
          name: 'selectedDays',
          message: 'Chọn ngày trong tuần:',
          choices: [
            { name: 'Chủ nhật', value: 0 },
            { name: 'Thứ 2', value: 1 },
            { name: 'Thứ 3', value: 2 },
            { name: 'Thứ 4', value: 3 },
            { name: 'Thứ 5', value: 4 },
            { name: 'Thứ 6', value: 5 },
            { name: 'Thứ 7', value: 6 }
          ],
          default: [0, 1, 2, 3, 4, 5, 6]
        }
      ]);
      
      let connectTime: string | undefined;
      let disconnectTime: string | undefined;
      
      if (scheduleType === 'connect' || scheduleType === 'both') {
        const { time } = await this.ui.prompt<{ time: string }>([
          {
            type: 'input',
            name: 'time',
            message: 'Thời gian kết nối (HH:MM):',
          validate: (input: string) => {
              // Simple validation for HH:MM format
              const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
              if (!regex.test(input)) {
                return 'Vui lòng nhập đúng định dạng HH:MM (ví dụ: 08:30)';
              }
              return true;
            }
          }
        ]);
        connectTime = time;
      }
      
      if (scheduleType === 'disconnect' || scheduleType === 'both') {
        const { time } = await this.ui.prompt<{ time: string }>([
          {
            type: 'input',
            name: 'time',
            message: 'Thời gian ngắt kết nối (HH:MM):',
            validate: (input: string) => {
              // Simple validation for HH:MM format
              const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
              if (!regex.test(input)) {
                return 'Vui lòng nhập đúng định dạng HH:MM (ví dụ: 17:30)';
              }
              return true;
            }
          }
        ]);
        disconnectTime = time;
      }
      
      // Confirm action
      const { confirm } = await this.ui.prompt<{ confirm: boolean }>([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Thiết lập lịch cho ${accountsToSchedule.length} tài khoản trong nhóm "${groupName}"?`,
          default: true
        }
      ]);

      if (!confirm) {
        this.ui.showInfo("Đã hủy thiết lập lịch.");
        return;
      }
      
      // Apply schedule to all accounts in group
      let connectSuccess = 0;
      let disconnectSuccess = 0;
      
      const spinner = this.ui.createSpinner(`Đang thiết lập lịch cho ${accountsToSchedule.length} tài khoản...`);
      spinner.start();
      
      for (const account of accountsToSchedule) {
        const accountIndex = this.accountManager.getAccounts().findIndex(a => a.token === account.token);
        if (accountIndex === -1) continue;
        
        if (connectTime && this.accountManager.scheduleConnect(accountIndex, connectTime, selectedDays)) {
          connectSuccess++;
        }
        
        if (disconnectTime && this.accountManager.scheduleDisconnect(accountIndex, disconnectTime, selectedDays)) {
          disconnectSuccess++;
        }
      }
      
      spinner.succeed(`Đã hoàn tất thiết lập lịch!`);
      
      if (connectTime) {
        this.ui.showSuccess(`Đã thiết lập lịch kết nối cho ${connectSuccess}/${accountsToSchedule.length} tài khoản vào lúc ${connectTime}`);
      }
      
      if (disconnectTime) {
        this.ui.showSuccess(`Đã thiết lập lịch ngắt kết nối cho ${disconnectSuccess}/${accountsToSchedule.length} tài khoản vào lúc ${disconnectTime}`);
      }
      
      // Confirm and activate if requested
      const { activate } = await this.ui.prompt<{ activate: boolean }>([
        {
          type: 'confirm',
          name: 'activate',
          message: 'Bạn có muốn kích hoạt các lịch này ngay bây giờ không?',
          default: true
        }
      ]);
      
      if (activate) {
        this.activateSchedules();
      }
    } catch (error) {
      this.ui.showError(`Lỗi khi lên lịch theo nhóm: ${error}`);
    }
  }
  
  /**
   * Activate all schedules
   */
  private activateSchedules(): void {
    // Connect account callback
    const connectCallback = async (account: Account) => {
      this.ui.showInfo(`Đang tự động kết nối tài khoản ${account.name || "Không tên"} theo lịch...`);
      await this.discordManager.connectAccount(account);
    };
    
    // Disconnect account callback
    const disconnectCallback = (account: Account) => {
      this.ui.showInfo(`Đang tự động ngắt kết nối tài khoản ${account.name || "Không tên"} theo lịch...`);
      
      // Find the running client for this account
      const runningClients = this.discordManager.getRunningClients();
      const clientToDisconnect = runningClients.find(
        rc => rc.account.token === account.token
      );
      
      if (clientToDisconnect) {
        // Disconnect the specific client
        if (clientToDisconnect.client.voice?.connection) {
          clientToDisconnect.client.voice.connection.disconnect();
        }
        clientToDisconnect.client.destroy();
        
        // Remove from running clients
        const index = runningClients.indexOf(clientToDisconnect);
        if (index !== -1) {
          runningClients.splice(index, 1);
        }
        
        this.ui.showSuccess(`Đã ngắt kết nối tài khoản ${account.name || "Không tên"}`);
      }
    };
    
    // Activate the scheduler
    this.accountManager.activateScheduler(connectCallback, disconnectCallback);
    this.ui.showSuccess("Đã kích hoạt lịch kết nối tự động!");
  }
}