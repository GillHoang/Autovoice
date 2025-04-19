import chalk from 'chalk';
import figlet from 'figlet';
import boxen from 'boxen';
import ora from 'ora';
import inquirer from 'inquirer';
import gradient from 'gradient-string';
import { 
  IUserInterface, 
  Account, 
  MainMenuAnswer, 
  AccountSelection,
  ConfirmDelete,
  Group
} from '../types';

export class UserInterface implements IUserInterface {
  constructor() {}

  // Display the banner
  showBanner(): void {
    console.clear();
    console.log('\n');
    
    // Create gradient banner
    const title = figlet.textSync('Discord AutoVoice', {
      font: 'Standard',
      horizontalLayout: 'default',
      verticalLayout: 'default'
    });
    
    console.log(gradient.pastel.multiline(title));
    
    console.log(
      boxen(chalk.blue('Phiên bản:') + ' ' + chalk.green('1.1.0') + '\n' +
            chalk.blue('Tác giả:  ') + ' ' + chalk.green('Hanh') + '\n' +
            chalk.yellow('✨ Kết nối đồng thời nhiều tài khoản Discord vào voice ✨'), 
            { 
              padding: 1, 
              margin: { top: 1, bottom: 1 },
              borderStyle: 'round',
              borderColor: 'cyan',
              backgroundColor: '#222222'
            })
    );
  }

  // Generic prompt method for any type of inquirer questions
  async prompt<T>(questions: any[]): Promise<T> {
    return inquirer.prompt(questions) as unknown as T;
  }

  // Show the main menu
  async showMainMenu(): Promise<MainMenuAnswer> {
    return this.prompt<MainMenuAnswer>([
      {
        type: 'list',
        name: 'action',
        message: chalk.cyan('✨ Chọn hành động:'),
        choices: [
          { name: '📞 Kết nối tất cả tài khoản', value: 'connectAll' },
          { name: '📱 Kết nối một tài khoản cụ thể', value: 'connectOne' },
          { name: '👥 Quản lý nhóm tài khoản', value: 'manageGroups' },
          { name: '🆕 Thêm tài khoản mới', value: 'addAccount' },
          { name: '✏️ Chỉnh sửa tài khoản', value: 'editAccount' },
          { name: '🗑️ Xóa tài khoản', value: 'deleteAccount' },
          { name: '🔌 Ngắt kết nối tất cả', value: 'disconnectAll' },
          { name: '📊 Bảng theo dõi trạng thái kết nối', value: 'statusMonitor' },
          { name: '⏰ Quản lý lịch kết nối tự động', value: 'scheduleAccounts' },
          { name: '🔒 Cài đặt bảo mật', value: 'securitySettings' },
          { name: '🚪 Thoát', value: 'exit' }
        ],
        pageSize: 12
      }
    ]);
  }

  // Show group management menu
  async showGroupManagementMenu(): Promise<{ action: string }> {
    return this.prompt<{ action: string }>([
      {
        type: 'list',
        name: 'action',
        message: chalk.cyan('👥 Quản lý nhóm tài khoản:'),
        choices: [
          { name: '👀 Xem danh sách nhóm', value: 'viewGroups' },
          { name: '➕ Tạo nhóm mới', value: 'createGroup' },
          { name: '✏️ Chỉnh sửa nhóm', value: 'editGroup' },
          { name: '🗑️ Xóa nhóm', value: 'deleteGroup' },
          { name: '📥 Thêm tài khoản vào nhóm', value: 'addAccountToGroup' },
          { name: '📤 Xóa tài khoản khỏi nhóm', value: 'removeAccountFromGroup' },
          { name: '📞 Kết nối tài khoản theo nhóm', value: 'connectByGroup' },
          { name: '🔙 Quay lại', value: 'back' }
        ],
        pageSize: 10
      }
    ]);
  }

  // Show group selection menu
  async showGroupSelection(groups: Group[]): Promise<{ groupId: string }> {
    if (groups.length === 0) {
      throw new Error("Không có nhóm nào");
    }
    
    return this.prompt<{ groupId: string }>([
      {
        type: 'list',
        name: 'groupId',
        message: chalk.cyan('📁 Chọn nhóm:'),
        choices: groups.map(group => ({
          name: `${chalk.yellow(group.name)}${group.description ? chalk.dim(` - ${group.description}`) : ''}`,
          value: group.id
        }))
      }
    ]);
  }

  // Show account selection with group info
  async showAccountSelectionWithGroups(accounts: Account[], groups: Group[]): Promise<AccountSelection> {
    // Create a mapping of group IDs to group names
    const groupMap = new Map<string, string>();
    for (const group of groups) {
      groupMap.set(group.id, group.name);
    }
    
    return this.prompt<AccountSelection>([
      {
        type: 'list',
        name: 'accountIndex',
        message: chalk.cyan('👤 Chọn tài khoản:'),
        choices: accounts.map((acc, index) => {
          const groupName = acc.group ? groupMap.get(acc.group) : undefined;
          const label = this.formatAccountName(acc.name, acc.token);
          const groupInfo = groupName ? chalk.magenta(` [${groupName}]`) : '';
          
          return {
            name: `${label}${groupInfo}`,
            value: index,
          };
        }),
        pageSize: 15
      }
    ]);
  }

  // Show account selection menu
  async showAccountSelection(accounts: Account[]): Promise<AccountSelection> {
    return this.prompt<AccountSelection>([
      {
        type: 'list',
        name: 'accountIndex',
        message: chalk.cyan('👤 Chọn tài khoản:'),
        choices: accounts.map((acc, index) => ({
          name: this.formatAccountName(acc.name, acc.token),
          value: index,
        })),
        pageSize: 15
      }
    ]);
  }

  // Show account creation form
  async showAccountCreationForm(accountCount: number): Promise<Account> {
    // This would be implemented with inquirer forms for account creation
    // For now it's a placeholder - implement based on your requirements
    throw new Error("Method not implemented yet");
  }

  // Show account edit form
  async showAccountEditForm(account: Account): Promise<Account> {
    // This would be implemented with inquirer forms for account editing
    // For now it's a placeholder - implement based on your requirements
    throw new Error("Method not implemented yet");
  }

  // Show delete confirmation
  async showConfirmDelete(accountName: string): Promise<boolean> {
    const { confirm } = await this.prompt<ConfirmDelete>([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.yellow(`⚠️ Bạn có chắc chắn muốn xóa tài khoản "${accountName || 'Không tên'}"?`),
        default: false,
      }
    ]);
    return confirm;
  }

  // Format account name for display
  formatAccountName(name: string, token: string): string {
    if (!name || name.trim() === '') {
      return chalk.grey('Tài khoản không tên') + chalk.dim(` (${token.substring(0, 10)}...)`);
    }
    return chalk.green(name) + chalk.dim(` (${token.substring(0, 10)}...)`);
  }

  // Display success message
  showSuccess(message: string): void {
    console.log(chalk.green('✅ ') + message);
  }

  // Display error message
  showError(message: string): void {
    console.log(chalk.red('❌ ') + message);
  }

  // Display warning message
  showWarning(message: string): void {
    console.log(chalk.yellow('⚠️  ') + message);
  }

  // Display info message
  showInfo(message: string): void {
    console.log(chalk.blue('ℹ️  ') + message);
  }

  // Create a spinner for loading states
  createSpinner(message: string): any {
    return ora({
      text: message,
      color: 'cyan',
      spinner: 'dots'
    });
  }

  // Create status box for accounts
  accountStatusBox(connected: number, total: number): string {
    let statusText = chalk.blue(`Tài khoản đang kết nối: `) + 
                   chalk.green(`${connected}`) + 
                   chalk.blue(`/${total}`);
                   
    return boxen(statusText, {
      padding: 0.5,
      margin: { bottom: 1 },
      borderStyle: 'round',
      borderColor: 'blue',
      backgroundColor: '#222222'
    });
  }

  // Create menu group header
  menuGroupBox(title: string): string {
    return chalk.cyan('┌─ ' + chalk.bold(title) + ' ');
  }

  // Create separator line
  separator(): string {
    return chalk.cyan('─'.repeat(70));
  }

  // Create status header with stats
  createStatusHeader(connected: number, total: number): string {
    const progressBar = this.createProgressBar(connected, total, 40);
    
    return boxen(
      chalk.bold.cyan('Thống kê kết nối') + '\n\n' +
      chalk.blue(`Tài khoản đang kết nối: `) + chalk.green(`${connected}`) + chalk.white(`/${total}`) + '\n' +
      progressBar + '\n' +
      chalk.dim(`Thời gian cập nhật: ${new Date().toLocaleTimeString()}`),
      {
        padding: 1,
        margin: { top: 0, bottom: 1 },
        borderStyle: 'round',
        borderColor: 'cyan',
        backgroundColor: '#222222',
        width: 60
      }
    );
  }

  // Create progress bar
  createProgressBar(current: number, total: number, width: number): string {
    const percentage = Math.round((current / total) * 100);
    const filledWidth = Math.round((current / total) * width);
    const emptyWidth = width - filledWidth;
    
    const filled = '█'.repeat(filledWidth);
    const empty = '░'.repeat(emptyWidth);
    
    return `${chalk.cyan(filled)}${chalk.grey(empty)} ${chalk.yellow(percentage + '%')}`;
  }

  // Create group header for status display
  createGroupHeader(groupName: string, accountCount: number): string {
    return boxen(
      chalk.bold.yellow(`${groupName}`) + chalk.cyan(` (${accountCount} tài khoản)`),
      {
        padding: { top: 0, bottom: 0, left: 1, right: 1 },
        margin: { top: 1, bottom: 0 },
        borderStyle: 'round',
        borderColor: 'yellow',
        backgroundColor: '#222222',
      }
    );
  }

  // Create account status card for connected accounts
  createAccountStatusCard(
    index: number,
    name: string,
    tag: string,
    serverName: string,
    channelName: string,
    isConnected: boolean,
    uptime: string,
    selfMute: boolean,
    selfDeaf: boolean,
    selfVideo: boolean
  ): string {
    // Status indicators
    const connectionStatus = isConnected 
      ? chalk.green('●') + ' Đã kết nối'
      : chalk.red('●') + ' Mất kết nối';
      
    const muteStatus = selfMute 
      ? chalk.red('🔇 Tắt mic')
      : chalk.green('🎤 Mic bật');
      
    const deafStatus = selfDeaf
      ? chalk.red('🔈 Tắt loa')
      : chalk.green('🔊 Loa bật');
      
    const videoStatus = selfVideo
      ? chalk.green('📹 Cam bật')
      : chalk.dim('📷 Cam tắt');
      
    return boxen(
      chalk.bold.white(`#${index}. ${name}`) + '\n' +
      chalk.dim(`Tag: ${tag}`) + '\n\n' +
      chalk.blue(`Server: `) + chalk.white(serverName) + '\n' +
      chalk.blue(`Kênh: `) + chalk.white(channelName) + '\n' +
      chalk.blue(`Kết nối: `) + connectionStatus + `  ${chalk.blue('Hoạt động:')} ${chalk.green(uptime)}` + '\n' +
      muteStatus + '  ' + deafStatus + '  ' + videoStatus,
      {
        padding: 1,
        margin: { top: 0, bottom: 1, left: 0, right: 0 },
        borderStyle: 'round',
        borderColor: isConnected ? 'green' : 'red',
        float: 'left',
        backgroundColor: '#222222',
        width: 60
      }
    );
  }

  // Create footer for status display
  createStatusFooter(): string {
    return boxen(
      chalk.cyan('Trợ giúp: ') + 
      chalk.white('Nhấn ') + chalk.yellow('Ctrl+C') + chalk.white(' để trở về menu chính\n') +
      chalk.cyan('Cập nhật: ') + chalk.white('Giao diện tự động làm mới mỗi 5 giây'),
      {
        padding: 1,
        margin: { top: 1, bottom: 1 },
        borderStyle: 'round',
        borderColor: 'blue',
        backgroundColor: '#222222',
        width: 60
      }
    );
  }
}

// Export utility functions to maintain backward compatibility
export const ui = new UserInterface();
export const showBanner = ui.showBanner.bind(ui);
export const showSuccess = ui.showSuccess.bind(ui);
export const showError = ui.showError.bind(ui);
export const showWarning = ui.showWarning.bind(ui);
export const showInfo = ui.showInfo.bind(ui);
export const createSpinner = ui.createSpinner.bind(ui);
export const formatAccountName = ui.formatAccountName.bind(ui);
export const accountStatusBox = ui.accountStatusBox.bind(ui);
export const menuGroupBox = ui.menuGroupBox.bind(ui);
export const separator = ui.separator.bind(ui);