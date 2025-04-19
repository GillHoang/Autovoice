import { Account, SecurityOptions } from "../../types";
import { SecurityManager } from "../../manager/SecurityManager";
import { UserInterface } from "../UserInterface";
import { AccountManager } from "../../manager/AccountManager";
import { ConfigManager } from "../../manager/ConfigManager";

export class SecurityModule {
  private securityManager: SecurityManager;
  private accountManager: AccountManager;
  private ui: UserInterface;

  constructor(securityManager: SecurityManager, ui: UserInterface) {
    this.securityManager = securityManager;
    this.ui = ui;
    this.accountManager = new AccountManager(new ConfigManager());
  }

  /**
   * Quản lý cài đặt bảo mật
   */
  public async manageSecuritySettings(): Promise<void> {
    try {
      const securityOptions = this.securityManager.getSecurityOptions();

      // Hiển thị menu cài đặt bảo mật
      const { action } = await this.ui.prompt<{ action: string }>([
        {
          type: "list",
          name: "action",
          message: "Quản lý cài đặt bảo mật:",
          choices: [
            { name: "Xem cài đặt bảo mật hiện tại", value: "viewSettings" },
            { name: "Thay đổi cài đặt bảo mật", value: "changeSettings" },
            { name: "Xem nhật ký bảo mật", value: "viewLogs" },
            { name: "Mã hóa lại token", value: "reencryptTokens" },
            { name: "Kiểm tra hoạt động đáng ngờ", value: "checkSuspicious" },
            { name: "Quay lại", value: "back" },
          ],
        },
      ]);

      switch (action) {
        case "viewSettings":
          this.showSecuritySettings(securityOptions);
          break;
        case "changeSettings":
          await this.updateSecuritySettings(securityOptions);
          break;
        case "viewLogs":
          await this.viewSecurityLogs();
          break;
        case "reencryptTokens":
          await this.reencryptTokens();
          break;
        case "checkSuspicious":
          await this.checkAllAccountsForSuspiciousActivity();
          break;
        case "back":
          return;
      }

      // Quay lại menu bảo mật sau khi hoàn thành
      await this.manageSecuritySettings();
    } catch (error) {
      this.ui.showError(`Lỗi khi quản lý cài đặt bảo mật: ${error}`);
    }
  }

  /**
   * Hiển thị cài đặt bảo mật hiện tại
   */
  private showSecuritySettings(options: SecurityOptions): void {
    this.ui.showInfo("=== Cài đặt bảo mật hiện tại ===");
    console.log(`
    ┌───────────────────────────────────────────┐
    │ Tự động đăng xuất khi phát hiện đáng ngờ: ${
      options.autoLogoutOnSuspicious ? "Bật" : "Tắt"
    }
    │ Giới hạn kết nối trên mỗi địa chỉ IP: ${options.maxConnectionsPerIP}
    │ Sử dụng proxy: ${options.proxyEnabled ? "Bật" : "Tắt"}
    │ ${
      options.proxyEnabled
        ? `Địa chỉ proxy: ${options.proxyAddress || "Chưa cấu hình"}`
        : ""
    }
    │ Mã hóa token: ${options.tokenEncryption ? "Bật" : "Tắt"}
    │ Thuật toán mã hóa: ${
      options.encryptionOptions?.algorithm || "Không xác định"
    }
    └───────────────────────────────────────────┘
    `);

    this.ui.showInfo(
      "Lưu ý: Thông tin này là nhạy cảm. Không chia sẻ với người khác."
    );
  }

  /**
   * Cập nhật cài đặt bảo mật
   */
  private async updateSecuritySettings(
    currentOptions: SecurityOptions
  ): Promise<void> {
    const { options } = await this.ui.prompt<{
      options: Partial<SecurityOptions>;
    }>([
      {
        type: "confirm",
        name: "options.autoLogoutOnSuspicious",
        message: "Tự động đăng xuất khi phát hiện hoạt động đáng ngờ?",
        default: currentOptions.autoLogoutOnSuspicious,
      },
      {
        type: "number",
        name: "options.maxConnectionsPerIP",
        message: "Giới hạn số kết nối trên mỗi địa chỉ IP:",
        default: currentOptions.maxConnectionsPerIP,
      },
      {
        type: "confirm",
        name: "options.proxyEnabled",
        message: "Sử dụng proxy?",
        default: currentOptions.proxyEnabled,
      },
      {
        type: "input",
        name: "options.proxyAddress",
        message: "Địa chỉ proxy (định dạng: http://host:port):",
        default: currentOptions.proxyAddress,
        when: (answers: any) => answers.options.proxyEnabled,
      },
      {
        type: "confirm",
        name: "options.tokenEncryption",
        message: "Mã hóa token khi lưu trữ?",
        default: currentOptions.tokenEncryption,
      },
    ]);

    // Cập nhật cài đặt bảo mật
    this.securityManager.updateSecurityOptions(options);
    this.ui.showSuccess("Đã cập nhật cài đặt bảo mật thành công!");
  }

  /**
   * Xem nhật ký bảo mật
   */
  private async viewSecurityLogs(): Promise<void> {
    const events = this.securityManager.getSecurityEvents();

    if (events.length === 0) {
      this.ui.showInfo("Chưa có sự kiện bảo mật nào được ghi lại.");
      return;
    }

    this.ui.showInfo(`=== Nhật ký bảo mật (${events.length} sự kiện) ===`);

    // Hiển thị 20 sự kiện gần nhất
    const recentEvents = events
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20);

    recentEvents.forEach((event, index) => {
      const date = new Date(event.timestamp).toLocaleString();
      const accountName = event.accountName || "Không xác định";
      const eventType = this.getEventTypeDisplay(event.type);

      console.log(
        `${index + 1}. [${date}] ${eventType}: ${event.details}`
      );
      console.log(
        `   Tài khoản: ${accountName} - IP: ${
          event.ipAddress || "Không xác định"
        }`
      );
    });

    // Chờ người dùng nhấn Enter để tiếp tục
    await this.ui.prompt([
      {
        type: "input",
        name: "continue",
        message: "Nhấn Enter để tiếp tục...",
      },
    ]);
  }

  /**
   * Lấy tên hiển thị cho loại sự kiện
   */
  private getEventTypeDisplay(type: string): string {
    switch (type) {
      case "suspicious_login":
        return "⚠️ Đăng nhập đáng ngờ";
      case "token_compromised":
        return "🚨 Token bị xâm phạm";
      case "multiple_connections":
        return "🔄 Nhiều kết nối";
      case "ip_change":
        return "🌐 Thay đổi IP";
      default:
        return type;
    }
  }

  /**
   * Mã hóa lại tất cả token
   */
  public async reencryptTokens(): Promise<void> {
    const accounts = this.accountManager.getAccounts();

    if (accounts.length === 0) {
      this.ui.showWarning("Không có tài khoản nào để mã hóa lại token.");
      return;
    }

    const { confirm } = await this.ui.prompt<{ confirm: boolean }>([
      {
        type: "confirm",
        name: "confirm",
        message: `Mã hóa lại token cho ${accounts.length} tài khoản? Điều này giúp bảo vệ tốt hơn nhưng có thể mất token nếu chuyển cấu hình sang máy khác.`,
        default: false,
      },
    ]);

    if (!confirm) {
      this.ui.showInfo("Đã hủy mã hóa lại token.");
      return;
    }

    const spinner = this.ui.createSpinner("Đang mã hóa lại token...");
    spinner.start();

    try {
      // Bật mã hóa token nếu chưa bật
      const securityOptions = this.securityManager.getSecurityOptions();
      if (!securityOptions.tokenEncryption) {
        this.securityManager.updateSecurityOptions({ tokenEncryption: true });
      }

      // Mã hóa lại token cho tất cả tài khoản
      let encryptedCount = 0;
      for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        const encryptedToken = this.securityManager.encryptToken(account.token);
        if (encryptedToken !== account.token) {
          account.token = encryptedToken;
          this.accountManager.updateAccount(i, account);
          encryptedCount++;
        }
      }

      spinner.succeed(
        `Đã mã hóa lại token cho ${encryptedCount} tài khoản thành công!`
      );
    } catch (error) {
      spinner.fail(`Lỗi khi mã hóa lại token: ${error}`);
    }
  }

  /**
   * Kiểm tra tất cả tài khoản xem có hoạt động đáng ngờ không
   */
  public async checkAllAccountsForSuspiciousActivity(): Promise<void> {
    const accounts = this.accountManager.getAccounts();

    if (accounts.length === 0) {
      this.ui.showWarning("Không có tài khoản nào để kiểm tra.");
      return;
    }

    const spinner = this.ui.createSpinner(
      `Đang kiểm tra ${accounts.length} tài khoản...`
    );
    spinner.start();

    try {
      // Kiểm tra từng tài khoản có hoạt động đáng ngờ không
      const suspiciousAccounts: Account[] = [];
      
      for (const account of accounts) {
        const currentIp = this.securityManager.getCurrentIp();
        if (this.securityManager.checkSuspiciousActivity(account, currentIp)) {
          suspiciousAccounts.push(account);
        }
      }
      
      if (suspiciousAccounts.length > 0) {
        spinner.warn(
          `Phát hiện ${suspiciousAccounts.length} tài khoản có hoạt động đáng ngờ!`
        );

        // Hiển thị danh sách tài khoản đáng ngờ
        console.log("\nDanh sách tài khoản đáng ngờ:");

        suspiciousAccounts.forEach((acc: Account, idx: number) => {
          console.log(
            `${idx + 1}. ${acc.name || "Không tên"} - Đăng nhập cuối: ${
              acc.lastLoginAt
                ? new Date(acc.lastLoginAt).toLocaleString()
                : "Chưa xác định"
            }`
          );
        });

        // Hỏi người dùng có muốn đánh dấu lại là an toàn không
        const { resetSuspicious } = await this.ui.prompt<{
          resetSuspicious: boolean;
        }>([
          {
            type: "confirm",
            name: "resetSuspicious",
            message:
              "Bạn có muốn đánh dấu lại tất cả tài khoản là an toàn không?",
            default: false,
          },
        ]);

        if (resetSuspicious) {
          // Đánh dấu lại tất cả tài khoản là an toàn
          for (let i = 0; i < accounts.length; i++) {
            const account = accounts[i];
            // Nếu tài khoản này nằm trong danh sách tài khoản đáng ngờ
            if (suspiciousAccounts.some(acc => acc.token === account.token)) {
              account.suspiciousActivity = false;
              this.accountManager.updateAccount(i, account);
            }
          }
          
          this.ui.showSuccess("Đã đánh dấu lại tất cả tài khoản là an toàn.");
        }
      } else {
        spinner.succeed("Không phát hiện hoạt động đáng ngờ nào!");
      }
    } catch (error) {
      spinner.fail(`Lỗi khi kiểm tra hoạt động đáng ngờ: ${error}`);
    }
  }
}