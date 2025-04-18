import { Account, IAccountManager, IConfigManager } from "../types";
import { ConfigManager } from "./ConfigManager";

/**
 * AccountManager class that implements IAccountManager interface
 * Responsible for managing account operations: adding, editing, deleting, and retrieving accounts
 */
export class AccountManager implements IAccountManager {
  private configManager: IConfigManager;
  
  constructor(configManager: IConfigManager = new ConfigManager()) {
    this.configManager = configManager;
  }
  
  /**
   * Get all accounts from config
   */
  getAccounts(): Account[] {
    return this.configManager.readConfig().accounts;
  }
  
  /**
   * Add a new account
   */
  addAccount(account: Account): void {
    const config = this.configManager.readConfig();
    config.accounts.push(account);
    this.configManager.saveConfig(config);
  }
  
  /**
   * Update an existing account
   */
  updateAccount(index: number, account: Account): void {
    const config = this.configManager.readConfig();
    if (index >= 0 && index < config.accounts.length) {
      config.accounts[index] = account;
      this.configManager.saveConfig(config);
    } else {
      throw new Error(`Invalid account index: ${index}`);
    }
  }
  
  /**
   * Delete an account
   */
  deleteAccount(index: number): void {
    const config = this.configManager.readConfig();
    if (index >= 0 && index < config.accounts.length) {
      config.accounts.splice(index, 1);
      this.configManager.saveConfig(config);
    } else {
      throw new Error(`Invalid account index: ${index}`);
    }
  }
  
  /**
   * Get a specific account by index
   */
  getAccount(index: number): Account {
    const accounts = this.getAccounts();
    if (index >= 0 && index < accounts.length) {
      return accounts[index];
    } else {
      throw new Error(`Invalid account index: ${index}`);
    }
  }
}