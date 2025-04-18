import { v4 as uuidv4 } from 'uuid';
import { Account, IAccountManager, IConfigManager, Group } from "../types";
import { ConfigManager } from "./ConfigManager";

/**
 * AccountManager class that implements IAccountManager interface
 * Responsible for managing account operations: adding, editing, deleting, and retrieving accounts
 */
export class AccountManager implements IAccountManager {
  private configManager: IConfigManager;
  private schedules: Map<number, {
    accountIndex: number,
    connectTime?: string, // HH:MM format
    disconnectTime?: string, // HH:MM format
    scheduledConnectJob?: NodeJS.Timeout,
    scheduledDisconnectJob?: NodeJS.Timeout,
    daysOfWeek?: number[] // 0 = Sunday, 1 = Monday, etc.
  }> = new Map();

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

      // Remove any schedules for this account
      this.removeSchedule(index);
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

  /**
   * Get all groups from config
   */
  getGroups(): Group[] {
    return this.configManager.readConfig().groups || [];
  }

  /**
   * Add a new group
   */
  addGroup(group: Omit<Group, 'id'>): Group {
    const config = this.configManager.readConfig();
    const newGroup: Group = {
      id: uuidv4(),
      ...group
    };
    
    if (!config.groups) {
      config.groups = [];
    }
    
    config.groups.push(newGroup);
    this.configManager.saveConfig(config);
    
    return newGroup;
  }

  /**
   * Update an existing group
   */
  updateGroup(groupId: string, groupData: Partial<Omit<Group, 'id'>>): Group | null {
    const config = this.configManager.readConfig();
    if (!config.groups) {
      config.groups = [];
      return null;
    }
    
    const groupIndex = config.groups.findIndex(g => g.id === groupId);
    if (groupIndex === -1) {
      return null;
    }
    
    const updatedGroup: Group = {
      ...config.groups[groupIndex],
      ...groupData
    };
    
    config.groups[groupIndex] = updatedGroup;
    this.configManager.saveConfig(config);
    
    return updatedGroup;
  }

  /**
   * Delete a group
   */
  deleteGroup(groupId: string): boolean {
    const config = this.configManager.readConfig();
    if (!config.groups) {
      return false;
    }
    
    const groupIndex = config.groups.findIndex(g => g.id === groupId);
    if (groupIndex === -1) {
      return false;
    }
    
    // Remove group from config
    config.groups.splice(groupIndex, 1);
    
    // Also remove group assignment from all accounts
    for (let i = 0; i < config.accounts.length; i++) {
      if (config.accounts[i].group === groupId) {
        config.accounts[i].group = undefined;
      }
    }
    
    this.configManager.saveConfig(config);
    return true;
  }

  /**
   * Assign an account to a group
   */
  assignAccountToGroup(accountIndex: number, groupId: string | undefined): boolean {
    const config = this.configManager.readConfig();
    
    if (accountIndex < 0 || accountIndex >= config.accounts.length) {
      return false;
    }
    
    // If groupId is undefined, we're removing the account from any group
    if (groupId !== undefined) {
      // Verify group exists if we're assigning to a group
      if (!config.groups?.some(g => g.id === groupId)) {
        return false;
      }
    }
    
    config.accounts[accountIndex].group = groupId;
    this.configManager.saveConfig(config);
    
    return true;
  }

  /**
   * Get all accounts in a specific group
   */
  getAccountsByGroup(groupId: string): Account[] {
    const accounts = this.getAccounts();
    return accounts.filter(account => account.group === groupId);
  }

  /**
   * Get all accounts without a group
   */
  getUngroupedAccounts(): Account[] {
    const accounts = this.getAccounts();
    return accounts.filter(account => !account.group);
  }

  /**
   * Schedule an account to connect at a specific time
   */
  scheduleConnect(accountIndex: number, connectTime: string, daysOfWeek?: number[]): boolean {
    const accounts = this.getAccounts();

    if (accountIndex < 0 || accountIndex >= accounts.length) {
      return false;
    }

    // Cancel existing scheduled job if any
    this.clearConnectSchedule(accountIndex);

    // Parse time HH:MM
    const timeParts = connectTime.split(':');
    if (timeParts.length !== 2) {
      return false;
    }

    const hour = parseInt(timeParts[0]);
    const minute = parseInt(timeParts[1]);

    if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return false;
    }

    // Update or create schedule record
    const scheduleData = this.schedules.get(accountIndex) || { 
      accountIndex, 
      daysOfWeek: daysOfWeek || [0, 1, 2, 3, 4, 5, 6] // Default to all days
    };

    scheduleData.connectTime = connectTime;
    this.schedules.set(accountIndex, scheduleData);

    return true;
  }

  /**
   * Schedule an account to disconnect at a specific time
   */
  scheduleDisconnect(accountIndex: number, disconnectTime: string, daysOfWeek?: number[]): boolean {
    const accounts = this.getAccounts();

    if (accountIndex < 0 || accountIndex >= accounts.length) {
      return false;
    }

    // Cancel existing scheduled job if any
    this.clearDisconnectSchedule(accountIndex);

    // Parse time HH:MM
    const timeParts = disconnectTime.split(':');
    if (timeParts.length !== 2) {
      return false;
    }

    const hour = parseInt(timeParts[0]);
    const minute = parseInt(timeParts[1]);

    if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return false;
    }

    // Update or create schedule record
    const scheduleData = this.schedules.get(accountIndex) || { 
      accountIndex,
      daysOfWeek: daysOfWeek || [0, 1, 2, 3, 4, 5, 6] // Default to all days
    };

    scheduleData.disconnectTime = disconnectTime;
    this.schedules.set(accountIndex, scheduleData);

    return true;
  }

  /**
   * Activate the scheduling system
   */
  activateScheduler(connectCallback: (account: Account) => Promise<void>, disconnectCallback: (account: Account) => void): void {
    // Clear any existing schedules first
    this.clearAllSchedules();

    // Set up schedules for all accounts
    for (const [accountIndex, schedule] of this.schedules.entries()) {
      try {
        const account = this.getAccount(accountIndex);

        // Schedule connect job if time is set
        if (schedule.connectTime) {
          this.setupConnectJob(accountIndex, schedule.connectTime, schedule.daysOfWeek || [0, 1, 2, 3, 4, 5, 6], connectCallback);
        }

        // Schedule disconnect job if time is set
        if (schedule.disconnectTime) {
          this.setupDisconnectJob(accountIndex, schedule.disconnectTime, schedule.daysOfWeek || [0, 1, 2, 3, 4, 5, 6], disconnectCallback);
        }
      } catch (error) {
        console.error(`Error setting up schedule for account ${accountIndex}:`, error);
      }
    }
  }

  /**
   * Remove all schedules for an account
   */
  removeSchedule(accountIndex: number): void {
    this.clearConnectSchedule(accountIndex);
    this.clearDisconnectSchedule(accountIndex);
    this.schedules.delete(accountIndex);
  }

  /**
   * Get all schedules
   */
  getSchedules(): Array<{
    accountIndex: number,
    accountName: string,
    connectTime?: string,
    disconnectTime?: string,
    daysOfWeek?: number[]
  }> {
    const accounts = this.getAccounts();
    const result = [];

    for (const [accountIndex, schedule] of this.schedules.entries()) {
      if (accountIndex < accounts.length) {
        result.push({
          accountIndex,
          accountName: accounts[accountIndex].name || `Account ${accountIndex + 1}`,
          connectTime: schedule.connectTime,
          disconnectTime: schedule.disconnectTime,
          daysOfWeek: schedule.daysOfWeek
        });
      }
    }

    return result;
  }

  // Private helper methods

  /**
   * Set up job to connect account at specified time
   */
  private setupConnectJob(
    accountIndex: number, 
    connectTime: string, 
    daysOfWeek: number[],
    callback: (account: Account) => Promise<void>
  ): void {
    const schedule = this.schedules.get(accountIndex);
    if (!schedule) return;

    const checkAndExecute = () => {
      const now = new Date();
      const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

      // Check if today is a scheduled day
      if (!daysOfWeek.includes(day)) {
        return;
      }

      const [hours, minutes] = connectTime.split(':').map(Number);
      const targetTime = new Date();
      targetTime.setHours(hours, minutes, 0, 0);

      const currentTime = new Date();

      // If it's within a minute of the target time, connect
      if (Math.abs(currentTime.getTime() - targetTime.getTime()) < 60000) {
        try {
          const account = this.getAccount(accountIndex);
          callback(account);
        } catch (error) {
          console.error(`Error connecting account ${accountIndex}:`, error);
        }
      }
    };

    // Check every minute
    const job = setInterval(checkAndExecute, 60000);
    schedule.scheduledConnectJob = job;

    // Also check immediately in case we're starting close to the scheduled time
    checkAndExecute();
  }

  /**
   * Set up job to disconnect account at specified time
   */
  private setupDisconnectJob(
    accountIndex: number, 
    disconnectTime: string, 
    daysOfWeek: number[],
    callback: (account: Account) => void
  ): void {
    const schedule = this.schedules.get(accountIndex);
    if (!schedule) return;

    const checkAndExecute = () => {
      const now = new Date();
      const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

      // Check if today is a scheduled day
      if (!daysOfWeek.includes(day)) {
        return;
      }

      const [hours, minutes] = disconnectTime.split(':').map(Number);
      const targetTime = new Date();
      targetTime.setHours(hours, minutes, 0, 0);

      const currentTime = new Date();

      // If it's within a minute of the target time, disconnect
      if (Math.abs(currentTime.getTime() - targetTime.getTime()) < 60000) {
        try {
          const account = this.getAccount(accountIndex);
          callback(account);
        } catch (error) {
          console.error(`Error disconnecting account ${accountIndex}:`, error);
        }
      }
    };

    // Check every minute
    const job = setInterval(checkAndExecute, 60000);
    schedule.scheduledDisconnectJob = job;

    // Also check immediately in case we're starting close to the scheduled time
    checkAndExecute();
  }

  /**
   * Clear connect schedule for an account
   */
  private clearConnectSchedule(accountIndex: number): void {
    const schedule = this.schedules.get(accountIndex);
    if (schedule?.scheduledConnectJob) {
      clearInterval(schedule.scheduledConnectJob);
      schedule.scheduledConnectJob = undefined;
    }
  }

  /**
   * Clear disconnect schedule for an account
   */
  private clearDisconnectSchedule(accountIndex: number): void {
    const schedule = this.schedules.get(accountIndex);
    if (schedule?.scheduledDisconnectJob) {
      clearInterval(schedule.scheduledDisconnectJob);
      schedule.scheduledDisconnectJob = undefined;
    }
  }

  /**
   * Clear all schedules
   */
  private clearAllSchedules(): void {
    for (const [accountIndex, schedule] of this.schedules.entries()) {
      if (schedule.scheduledConnectJob) {
        clearInterval(schedule.scheduledConnectJob);
      }
      if (schedule.scheduledDisconnectJob) {
        clearInterval(schedule.scheduledDisconnectJob);
      }
    }
  }
}