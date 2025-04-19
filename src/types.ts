import { Client } from "discord.js-selfbot-v13";

// Memory Usage interface
export interface MemoryUsage {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
  rssMB: number;
  heapTotalMB: number;
  heapUsedMB: number;
}

// Security interfaces
export interface TokenEncryptionOptions {
  algorithm: string;
  secretKey: string;
  iv?: Buffer;
}

export interface SecurityOptions {
  autoLogoutOnSuspicious: boolean;
  maxConnectionsPerIP: number;
  proxyEnabled: boolean;
  proxyAddress?: string;
  tokenEncryption: boolean;
  encryptionOptions?: TokenEncryptionOptions;
}

// Base interfaces
export interface Account {
  token: string;
  guildId: string;
  channelId: string;
  selfMute: boolean;
  selfDeaf: boolean;
  selfVideo: boolean;
  name: string;
  group?: string; // Thêm thuộc tính group để nhóm các tài khoản
  useTwoFactor?: boolean; // Hỗ trợ 2FA
  backupCodes?: string[]; // Các mã dự phòng cho 2FA
  lastLoginAt?: number; // Thời gian đăng nhập cuối
  lastLoginIp?: string; // IP cuối cùng sử dụng tài khoản
  suspiciousActivity?: boolean; // Cờ đánh dấu hoạt động đáng ngờ
}

export interface Group {
  id: string;
  name: string;
  description?: string;
}

export interface Config {
  accounts: Account[];
  groups: Group[];
  security?: SecurityOptions;
}

export interface RunningClient {
  client: Client;
  account: Account;
}

// DiscordData interface
export interface DiscordData {
  client: Client;
  servers: { name: string; id: string }[];
  getVoiceChannels: (guildId: string) => { name: string; id: string }[];
}

// UI Interfaces
export interface MainMenuAnswer {
  action:
    | "connectAll"
    | "connectOne"
    | "addAccount"
    | "editAccount"
    | "deleteAccount"
    | "disconnectAll"
    | "statusMonitor"
    | "scheduleAccounts"
    | "manageGroups"
    | "securitySettings"
    | "exit";
}

// Security event types
export enum SecurityEventType {
  SUSPICIOUS_LOGIN = 'suspicious_login',
  MULTIPLE_CONNECTIONS = 'multiple_connections',
  API_THROTTLING = 'api_throttling',
  TOKEN_COMPROMISED = 'token_compromised',
  IP_CHANGE = 'ip_change'
}

export interface SecurityEvent {
  type: SecurityEventType;
  accountName?: string;
  accountToken?: string;
  timestamp: number;
  details: string;
  ipAddress?: string;
}

export interface AccountSelection {
  accountIndex: number;
  account?: number;
}

export interface TokenInput {
  name: string;
  token: string;
}

export interface ServerSelection {
  guildId: string;
}

export interface ChannelSelection {
  channelId: string;
}

export interface VoiceSettings {
  selfMute: boolean;
  selfDeaf: boolean;
  selfVideo: boolean;
}

export interface BasicInfo {
  name: string;
  token: string;
  updateServerAndChannel: boolean;
}

export interface ConfirmDelete {
  confirm: boolean;
}

export interface ConfirmContinue {
  continue: boolean;
}

// Class interfaces for OOP refactoring
export interface IConfigManager {
  readConfig(): Config;
  saveConfig(config: Config): void;
}

export interface IAccountManager {
  getAccounts(): Account[];
  addAccount(account: Account): void;
  updateAccount(index: number, account: Account): void;
  deleteAccount(index: number): void;
  getAccount(index: number): Account;
  
  // Group management methods
  getGroups(): Group[];
  addGroup(group: Omit<Group, 'id'>): Group;
  updateGroup(groupId: string, groupData: Partial<Omit<Group, 'id'>>): Group | null;
  deleteGroup(groupId: string): boolean;
  assignAccountToGroup(accountIndex: number, groupId: string | undefined): boolean;
  getAccountsByGroup(groupId: string): Account[];
  getUngroupedAccounts(): Account[];
}

export interface IDiscordManager {
  connectAccount(account: Account): Promise<Client | null>;
  disconnectAll(): void;
  getRunningClients(): RunningClient[];
  getDiscordData(token: string): Promise<DiscordData>;
  closeDiscordClient(data: DiscordData): void;
  getMemoryUsage(): MemoryUsage;
  cleanup(): void;
}

export interface IUserInterface {
  showMainMenu(): Promise<MainMenuAnswer>;
  showAccountSelection(accounts: Account[]): Promise<AccountSelection>;
  showAccountCreationForm(accountCount: number): Promise<Account>;
  showAccountEditForm(account: Account): Promise<Account>;
  showConfirmDelete(accountName: string): Promise<boolean>;
  prompt<T>(questions: any[]): Promise<T>;
  formatAccountName(name: string, token: string): string;
  showSuccess(message: string): void;
  showError(message: string): void;
  showWarning(message: string): void;
  showInfo(message: string): void;
  createSpinner(message: string): any;
  showBanner(): void;
}

export interface ISecurityManager {
  encryptToken(token: string): string;
  decryptToken(encryptedToken: string): string;
  checkSuspiciousActivity(account: Account, ip?: string): boolean;
  recordLoginAttempt(account: Account, ip?: string, success?: boolean): void;
  logSecurityEvent(event: SecurityEvent): void;
  getSecurityEvents(): SecurityEvent[];
  getSecurityOptions(): SecurityOptions;
  updateSecurityOptions(options: Partial<SecurityOptions>): void;
}