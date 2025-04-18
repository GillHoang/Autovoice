import { Client } from "discord.js-selfbot-v13";

// Base interfaces
export interface Account {
  token: string;
  guildId: string;
  channelId: string;
  selfMute: boolean;
  selfDeaf: boolean;
  selfVideo: boolean;
  name: string;
}

export interface Config {
  accounts: Account[];
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
    | "exit";
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
}

export interface IDiscordManager {
  connectAccount(account: Account): Promise<Client | null>;
  disconnectAll(): void;
  getRunningClients(): RunningClient[];
  getDiscordData(token: string): Promise<DiscordData>;
  closeDiscordClient(data: DiscordData): void;
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