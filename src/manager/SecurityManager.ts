// filepath: c:\Users\Lenovo\Documents\DiscordSelfBot\Autovoice\src\manager\SecurityManager.ts
import * as crypto from 'crypto';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { SecurityOptions, Account, SecurityEvent, SecurityEventType, TokenEncryptionOptions, ISecurityManager } from '../types';
import { UserInterface } from '../client/UserInterface';
import { ConfigManager } from './ConfigManager';

/**
 * Quản lý bảo mật cho ứng dụng Discord AutoVoice
 */
export class SecurityManager implements ISecurityManager {
  private readonly CONFIG_DIR = path.join(os.homedir(), '.discord-autovoice');
  private readonly SECURITY_LOG_FILE = path.join(this.CONFIG_DIR, 'security.log');
  private securityOptions: SecurityOptions;
  private securityEvents: SecurityEvent[] = [];
  private ui: UserInterface;
  private configManager: ConfigManager;

  constructor(userInterface?: UserInterface) {
    this.ui = userInterface || new UserInterface();
    this.configManager = new ConfigManager();
    
    // Đảm bảo thư mục cấu hình tồn tại
    if (!fs.existsSync(this.CONFIG_DIR)) {
      fs.mkdirSync(this.CONFIG_DIR, { recursive: true });
    }
    
    // Đọc tùy chọn bảo mật từ cấu hình
    const config = this.configManager.readConfig();
    
    this.securityOptions = config.security || this.getDefaultSecurityOptions();
    
    // Đọc nhật ký bảo mật nếu tồn tại
    this.loadSecurityEvents();
  }

  /**
   * Mã hóa token Discord
   */
  public encryptToken(token: string): string {
    if (!this.securityOptions.tokenEncryption) {
      return token;
    }

    try {
      const options = this.securityOptions.encryptionOptions || this.getDefaultEncryptionOptions();
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(options.algorithm, options.secretKey, iv);
      
      let encrypted = cipher.update(token, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Trả về IV + chuỗi đã mã hóa, IV cần thiết để giải mã
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      this.ui.showError(`Lỗi khi mã hóa token: ${error}`);
      return token;
    }
  }

  /**
   * Giải mã token Discord đã được mã hóa
   */
  public decryptToken(encryptedToken: string): string {
    if (!this.securityOptions.tokenEncryption || !encryptedToken.includes(':')) {
      return encryptedToken;
    }

    try {
      const options = this.securityOptions.encryptionOptions || this.getDefaultEncryptionOptions();
      const [ivHex, encrypted] = encryptedToken.split(':');
      
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv(options.algorithm, options.secretKey, iv);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      this.ui.showError(`Lỗi khi giải mã token: ${error}`);
      return encryptedToken;
    }
  }

  /**
   * Kiểm tra hoạt động đáng ngờ cho một tài khoản
   */
  public checkSuspiciousActivity(account: Account, ip?: string): boolean {
    // Nếu tài khoản đã được đánh dấu là đáng ngờ
    if (account.suspiciousActivity) {
      return true;
    }
    
    // Kiểm tra thay đổi IP
    if (account.lastLoginIp && ip && account.lastLoginIp !== ip) {
      this.logSecurityEvent({
        type: SecurityEventType.IP_CHANGE,
        accountName: account.name,
        accountToken: this.getMaskedToken(account.token),
        timestamp: Date.now(),
        details: `Phát hiện thay đổi IP: ${account.lastLoginIp} -> ${ip}`,
        ipAddress: ip
      });
      
      return true;
    }
    
    // Kiểm tra các đăng nhập gần đây (trong 5 phút)
    const recentEvents = this.securityEvents.filter(event => 
      event.accountToken === this.getMaskedToken(account.token) && 
      event.timestamp > Date.now() - 5 * 60 * 1000
    );
    
    if (recentEvents.length > 5) {
      this.logSecurityEvent({
        type: SecurityEventType.MULTIPLE_CONNECTIONS,
        accountName: account.name,
        accountToken: this.getMaskedToken(account.token),
        timestamp: Date.now(),
        details: `Phát hiện nhiều lần đăng nhập trong thời gian ngắn: ${recentEvents.length} lần trong 5 phút`,
        ipAddress: ip
      });
      
      return true;
    }
    
    return false;
  }

  /**
   * Ghi lại lần đăng nhập
   */
  public recordLoginAttempt(account: Account, ip?: string, success: boolean = true): void {
    // Cập nhật thông tin đăng nhập cho tài khoản
    account.lastLoginAt = Date.now();
    
    if (ip) {
      account.lastLoginIp = ip;
    }
    
    // Lưu vào sự kiện bảo mật
    const eventType = success ? undefined : SecurityEventType.SUSPICIOUS_LOGIN;
    
    if (eventType) {
      this.logSecurityEvent({
        type: eventType,
        accountName: account.name,
        accountToken: this.getMaskedToken(account.token),
        timestamp: Date.now(),
        details: `Đăng nhập ${success ? 'thành công' : 'thất bại'}`,
        ipAddress: ip
      });
    }
  }

  /**
   * Ghi lại sự kiện bảo mật
   */
  public logSecurityEvent(event: SecurityEvent): void {
    this.securityEvents.push(event);
    
    // Lưu sự kiện vào tệp nhật ký
    try {
      const logEntry = `[${new Date(event.timestamp).toISOString()}] ${event.type}: ${event.details} - Account: ${event.accountName || 'N/A'} - IP: ${event.ipAddress || 'N/A'}\n`;
      fs.appendFileSync(this.SECURITY_LOG_FILE, logEntry);
      
      if (this.securityOptions.autoLogoutOnSuspicious && 
          (event.type === SecurityEventType.SUSPICIOUS_LOGIN || 
           event.type === SecurityEventType.TOKEN_COMPROMISED ||
           event.type === SecurityEventType.IP_CHANGE)) {
        this.ui.showWarning(`⚠️ Sự kiện bảo mật đáng ngờ: ${event.details}`);
      }
    } catch (error) {
      this.ui.showError(`Không thể ghi nhật ký bảo mật: ${error}`);
    }
  }

  /**
   * Lấy danh sách sự kiện bảo mật
   */
  public getSecurityEvents(): SecurityEvent[] {
    return this.securityEvents;
  }

  /**
   * Lấy tùy chọn bảo mật hiện tại
   */
  public getSecurityOptions(): SecurityOptions {
    return this.securityOptions;
  }

  /**
   * Cập nhật tùy chọn bảo mật
   */
  public updateSecurityOptions(options: Partial<SecurityOptions>): void {
    this.securityOptions = {
      ...this.securityOptions,
      ...options
    };
    
    // Cập nhật cấu hình
    const config = this.configManager.readConfig();
    config.security = this.securityOptions;
    this.configManager.saveConfig(config);
    
    this.ui.showSuccess('Đã cập nhật tùy chọn bảo mật');
  }

  /**
   * Lấy địa chỉ IP hiện tại (giả lập cho CLI)
   */
  public getCurrentIp(): string | undefined {
    // Trong môi trường CLI thực tế, đây sẽ là IP gửi yêu cầu
    // Đối với ứng dụng desktop, chúng ta lấy IP của máy
    try {
      const interfaces = os.networkInterfaces();
      // Lấy IP không phải local
      for (const iface of Object.values(interfaces)) {
        for (const info of iface || []) {
          if (info.family === 'IPv4' && !info.internal) {
            return info.address;
          }
        }
      }
      return undefined;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Tạo token che giấu để lưu nhật ký (chỉ giữ vài ký tự đầu và cuối)
   */
  private getMaskedToken(token: string): string {
    if (token.length <= 10) {
      return token;
    }
    return token.substring(0, 5) + '...' + token.substring(token.length - 5);
  }

  /**
   * Đọc nhật ký bảo mật từ tệp
   */
  private loadSecurityEvents(): void {
    if (!fs.existsSync(this.SECURITY_LOG_FILE)) {
      return;
    }
    
    try {
      const content = fs.readFileSync(this.SECURITY_LOG_FILE, 'utf8');
      const lines = content.trim().split('\n');
      
      for (const line of lines) {
        try {
          // Parse log line format: [timestamp] type: details - Account: name - IP: ip
          const timestampMatch = line.match(/\[(.*?)\]/);
          const typeMatch = line.match(/\] (.*?):/);
          const detailsMatch = line.match(/: (.*?) - Account/);
          const accountMatch = line.match(/Account: (.*?) - IP/);
          const ipMatch = line.match(/IP: (.*?)$/);
          
          if (timestampMatch && typeMatch && detailsMatch) {
            const timestamp = new Date(timestampMatch[1]).getTime();
            const type = typeMatch[1] as SecurityEventType;
            const details = detailsMatch[1];
            const accountName = accountMatch ? accountMatch[1] : undefined;
            const ipAddress = ipMatch ? ipMatch[1] : undefined;
            
            this.securityEvents.push({
              type,
              accountName: accountName === 'N/A' ? undefined : accountName,
              accountToken: undefined,
              timestamp,
              details,
              ipAddress: ipAddress === 'N/A' ? undefined : ipAddress
            });
          }
        } catch (e) {
          // Skip invalid log entries
        }
      }
    } catch (error) {
      this.ui.showError(`Không thể đọc nhật ký bảo mật: ${error}`);
    }
  }

  /**
   * Lấy tùy chọn bảo mật mặc định
   */
  private getDefaultSecurityOptions(): SecurityOptions {
    return {
      autoLogoutOnSuspicious: true,
      maxConnectionsPerIP: 10,
      proxyEnabled: false,
      tokenEncryption: true,
      encryptionOptions: this.getDefaultEncryptionOptions()
    };
  }

  /**
   * Lấy tùy chọn mã hóa mặc định
   */
  private getDefaultEncryptionOptions(): TokenEncryptionOptions {
    // Tạo khóa bí mật dựa trên thông tin phần cứng để tránh
    // mất dữ liệu khi chuyển cấu hình sang máy khác
    const machineId = this.getMachineId();
    
    return {
      algorithm: 'aes-256-cbc',
      secretKey: crypto.createHash('sha256').update(machineId).digest('hex').substring(0, 32)
    };
  }

  /**
   * Lấy ID duy nhất của máy để tạo khóa mã hóa
   */
  private getMachineId(): string {
    const networkInterfaces = os.networkInterfaces();
    const username = os.userInfo().username;
    const hostname = os.hostname();
    
    // Tạo chuỗi định danh từ thông tin phần cứng
    let id = `${hostname}-${username}`;
    
    // Thêm địa chỉ MAC nếu có
    for (const [name, interfaces] of Object.entries(networkInterfaces)) {
      if (!name.includes('VMware') && !name.includes('VirtualBox')) {
        for (const iface of interfaces || []) {
          if (!iface.internal && iface.mac !== '00:00:00:00:00:00') {
            id += `-${iface.mac}`;
            break;
          }
        }
      }
    }
    
    return id;
  }
}