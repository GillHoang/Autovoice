import chalk from 'chalk';
import figlet from 'figlet';
import boxen from 'boxen';
import ora from 'ora';
import inquirer from 'inquirer';
import { 
  IUserInterface, 
  Account, 
  MainMenuAnswer, 
  AccountSelection,
  ConfirmDelete
} from '../types';

export class UserInterface implements IUserInterface {
  constructor() {}

  // Display the banner
  showBanner(): void {
    console.clear();
    console.log('\n');
    console.log(
      chalk.cyan(
        figlet.textSync('Discord AutoVoice', {
          font: 'Standard',
          horizontalLayout: 'default',
          verticalLayout: 'default'
        })
      )
    );
    console.log(
      boxen(chalk.blue('Phiên bản:') + ' ' + chalk.green('1.0.0') + '\n' +
            chalk.blue('Tác giả:  ') + ' ' + chalk.green('Hanh') + '\n' +
            chalk.yellow('✨ Kết nối đồng thời nhiều tài khoản Discord vào voice ✨'), 
            { 
              padding: 1, 
              margin: { top: 1, bottom: 1 },
              borderStyle: 'round',
              borderColor: 'cyan'
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
        message: 'Chọn hành động:',
        choices: [
          { name: 'Kết nối tất cả tài khoản', value: 'connectAll' },
          { name: 'Kết nối một tài khoản cụ thể', value: 'connectOne' },
          { name: 'Thêm tài khoản mới', value: 'addAccount' },
          { name: 'Chỉnh sửa tài khoản', value: 'editAccount' },
          { name: 'Xóa tài khoản', value: 'deleteAccount' },
          { name: 'Ngắt kết nối tất cả', value: 'disconnectAll' },
          { name: 'Thoát', value: 'exit' }
        ]
      }
    ]);
  }

  // Show account selection menu
  async showAccountSelection(accounts: Account[]): Promise<AccountSelection> {
    return this.prompt<AccountSelection>([
      {
        type: 'list',
        name: 'accountIndex',
        message: 'Chọn tài khoản:',
        choices: accounts.map((acc, index) => ({
          name: this.formatAccountName(acc.name, acc.token),
          value: index,
        })),
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
        message: `Bạn có chắc chắn muốn xóa tài khoản "${accountName || 'Không tên'}"?`,
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
      borderColor: 'blue'
    });
  }

  // Create menu group header
  menuGroupBox(title: string): string {
    return chalk.cyan('┌─ ' + chalk.bold(title) + ' ');
  }

  // Create separator line
  separator(): string {
    return chalk.cyan('─'.repeat(50));
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