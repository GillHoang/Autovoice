import { Account } from "../../types";
import { AccountManager } from "../../manager/AccountManager";
import { DiscordManager } from "../../manager/DiscordManager";
import { UserInterface } from "../UserInterface";

export class ScheduleModule {
  private accountManager: AccountManager;
  private discordManager: DiscordManager;
  private ui: UserInterface;

  constructor(
    accountManager: AccountManager,
    discordManager: DiscordManager,
    ui: UserInterface
  ) {
    this.accountManager = accountManager;
    this.discordManager = discordManager;
    this.ui = ui;
  }

  /**
   * Manage account schedules
   */
  public async manageSchedules(): Promise<void> {
    const accounts = this.accountManager.getAccounts();

    if (accounts.length === 0) {
      this.ui.showWarning(
        "Không có tài khoản nào để lên lịch. Vui lòng thêm tài khoản trước."
      );
      return;
    }

    // Show schedule management menu
    const { action } = await this.ui.prompt<{ action: string }>([
      {
        type: "list",
        name: "action",
        message: "Quản lý lịch kết nối tự động:",
        choices: [
          { name: "Xem danh sách lịch kết nối", value: "viewSchedules" },
          { name: "Thêm lịch kết nối mới", value: "addSchedule" },
          { name: "Xóa lịch kết nối", value: "removeSchedule" },
          { name: "Kích hoạt tất cả lịch kết nối", value: "activateSchedules" },
          { name: "Lên lịch theo nhóm", value: "scheduleByGroup" },
          { name: "Quay lại", value: "back" },
        ],
      },
    ]);

    switch (action) {
      case "viewSchedules":
        this.viewSchedules();
        break;
      case "addSchedule":
        await this.addSchedule();
        break;
      case "removeSchedule":
        await this.removeSchedule();
        break;
      case "activateSchedules":
        this.activateSchedules();
        break;
      case "scheduleByGroup":
        await this.scheduleByGroup();
        break;
      case "back":
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
    const groupMap = new Map<string, any>();
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
      "Tên tài khoản": string;
      Nhóm: string;
      "Giờ kết nối": string;
      "Giờ ngắt kết nối": string;
      "Ngày trong tuần": string;
    }[] = [];

    // Day mapping for better readability
    const daysMap = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

    schedules.forEach((schedule, index) => {
      // Get account to find group
      const account = this.accountManager.getAccount(schedule.accountIndex);
      let groupName = "Không có";
      if (account.group && groupMap.has(account.group)) {
        groupName = groupMap.get(account.group)!.name;
      }

      table.push({
        STT: index + 1,
        "Tên tài khoản": schedule.accountName,
        Nhóm: groupName,
        "Giờ kết nối": schedule.connectTime || "Chưa đặt",
        "Giờ ngắt kết nối": schedule.disconnectTime || "Chưa đặt",
        "Ngày trong tuần": schedule.daysOfWeek
          ? schedule.daysOfWeek.map((day) => daysMap[day]).join(", ")
          : "Mỗi ngày",
      });
    });

    console.table(table);
  }

  /**
   * Add a new schedule
   */
  public async addSchedule(): Promise<void> {
    const accounts = this.accountManager.getAccounts();
    const groups = this.accountManager.getGroups();

    // Show account selection with group info if available
    const { accountIndex } =
      groups.length > 0
        ? await this.ui.showAccountSelectionWithGroups(accounts, groups)
        : await this.ui.showAccountSelection(accounts);

    const account = accounts[accountIndex];

    this.ui.showInfo(
      `Thiết lập lịch trình cho tài khoản: ${account.name || "Không tên"}`
    );

    const { scheduleType } = await this.ui.prompt<{ scheduleType: string }>([
      {
        type: "list",
        name: "scheduleType",
        message: "Chọn loại lịch:",
        choices: [
          { name: "Lịch kết nối", value: "connect" },
          { name: "Lịch ngắt kết nối", value: "disconnect" },
          { name: "Cả hai", value: "both" },
        ],
      },
    ]);

    // Get days of week
    const { selectedDays } = await this.ui.prompt<{ selectedDays: number[] }>([
      {
        type: "checkbox",
        name: "selectedDays",
        message: "Chọn ngày trong tuần:",
        choices: [
          { name: "Chủ nhật", value: 0 },
          { name: "Thứ 2", value: 1 },
          { name: "Thứ 3", value: 2 },
          { name: "Thứ 4", value: 3 },
          { name: "Thứ 5", value: 4 },
          { name: "Thứ 6", value: 5 },
          { name: "Thứ 7", value: 6 },
        ],
        default: [0, 1, 2, 3, 4, 5, 6],
      },
    ]);

    let connectTime: string | undefined;
    let disconnectTime: string | undefined;

    if (scheduleType === "connect" || scheduleType === "both") {
      const { time } = await this.ui.prompt<{ time: string }>([
        {
          type: "input",
          name: "time",
          message: "Thời gian kết nối (HH:MM):",
          validate: (input: string) => {
            // Simple validation for HH:MM format
            const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
            if (!regex.test(input)) {
              return "Vui lòng nhập đúng định dạng HH:MM (ví dụ: 08:30)";
            }
            return true;
          },
        },
      ]);
      connectTime = time;
    }

    if (scheduleType === "disconnect" || scheduleType === "both") {
      const { time } = await this.ui.prompt<{ time: string }>([
        {
          type: "input",
          name: "time",
          message: "Thời gian ngắt kết nối (HH:MM):",
          validate: (input: string) => {
            // Simple validation for HH:MM format
            const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
            if (!regex.test(input)) {
              return "Vui lòng nhập đúng định dạng HH:MM (ví dụ: 17:30)";
            }
            return true;
          },
        },
      ]);
      disconnectTime = time;
    }

    let result = false;

    // Set up schedules as requested
    if (connectTime) {
      result = this.accountManager.scheduleConnect(
        accountIndex,
        connectTime,
        selectedDays
      );
      if (result) {
        this.ui.showSuccess(
          `Đã thiết lập lịch kết nối cho tài khoản ${
            account.name || "Không tên"
          } vào lúc ${connectTime}`
        );
      } else {
        this.ui.showError(
          `Không thể thiết lập lịch kết nối. Vui lòng kiểm tra lại thời gian.`
        );
      }
    }

    if (disconnectTime) {
      result = this.accountManager.scheduleDisconnect(
        accountIndex,
        disconnectTime,
        selectedDays
      );
      if (result) {
        this.ui.showSuccess(
          `Đã thiết lập lịch ngắt kết nối cho tài khoản ${
            account.name || "Không tên"
          } vào lúc ${disconnectTime}`
        );
      } else {
        this.ui.showError(
          `Không thể thiết lập lịch ngắt kết nối. Vui lòng kiểm tra lại thời gian.`
        );
      }
    }

    // Confirm and activate if requested
    const { activate } = await this.ui.prompt<{ activate: boolean }>([
      {
        type: "confirm",
        name: "activate",
        message: "Bạn có muốn kích hoạt lịch này ngay bây giờ không?",
        default: true,
      },
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
    const daysMap = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

    // Show schedule selection
    const { scheduleIndex } = await this.ui.prompt<{ scheduleIndex: number }>([
      {
        type: "list",
        name: "scheduleIndex",
        message: "Chọn lịch kết nối để xóa:",
        choices: schedules.map((schedule, index) => ({
          name: `${schedule.accountName} - Kết nối: ${
            schedule.connectTime || "Chưa đặt"
          }, Ngắt: ${schedule.disconnectTime || "Chưa đặt"} - ${
            schedule.daysOfWeek
              ? schedule.daysOfWeek.map((d) => daysMap[d]).join(", ")
              : "Mỗi ngày"
          }`,
          value: index,
        })),
      },
    ]);

    // Confirm deletion
    const { confirm } = await this.ui.prompt<{ confirm: boolean }>([
      {
        type: "confirm",
        name: "confirm",
        message: `Bạn có chắc chắn muốn xóa lịch kết nối này?`,
        default: false,
      },
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
  public async scheduleByGroup(): Promise<void> {
    const groups = this.accountManager.getGroups();

    if (groups.length === 0) {
      this.ui.showWarning(
        "Không có nhóm nào để lên lịch. Vui lòng tạo nhóm trước."
      );
      return;
    }

    // Add "ungrouped accounts" option
    const groupChoices = [
      ...groups.map((group) => ({
        name: `${group.name}${
          group.description ? ` - ${group.description}` : ""
        } (${
          this.accountManager.getAccountsByGroup(group.id).length
        } tài khoản)`,
        value: group.id,
      })),
      {
        name: `Tài khoản chưa phân nhóm (${
          this.accountManager.getUngroupedAccounts().length
        } tài khoản)`,
        value: "ungrouped",
      },
    ];

    try {
      // Show group selection
      const { selectedGroup } = await this.ui.prompt<{ selectedGroup: string }>(
        [
          {
            type: "list",
            name: "selectedGroup",
            message: "Chọn nhóm để lên lịch:",
            choices: groupChoices,
          },
        ]
      );

      // Get accounts in selected group
      let accountsToSchedule: Account[];
      let groupName: string;

      if (selectedGroup === "ungrouped") {
        accountsToSchedule = this.accountManager.getUngroupedAccounts();
        groupName = "Chưa phân nhóm";
      } else {
        accountsToSchedule =
          this.accountManager.getAccountsByGroup(selectedGroup);
        groupName =
          groups.find((g) => g.id === selectedGroup)?.name ||
          "Nhóm không xác định";
      }

      if (accountsToSchedule.length === 0) {
        this.ui.showWarning(
          `Không có tài khoản nào trong nhóm "${groupName}".`
        );
        return;
      }

      this.ui.showInfo(
        `Thiết lập lịch trình cho nhóm: ${groupName} (${accountsToSchedule.length} tài khoản)`
      );

      const { scheduleType } = await this.ui.prompt<{ scheduleType: string }>([
        {
          type: "list",
          name: "scheduleType",
          message: "Chọn loại lịch:",
          choices: [
            { name: "Lịch kết nối", value: "connect" },
            { name: "Lịch ngắt kết nối", value: "disconnect" },
            { name: "Cả hai", value: "both" },
          ],
        },
      ]);

      // Get days of week
      const { selectedDays } = await this.ui.prompt<{ selectedDays: number[] }>(
        [
          {
            type: "checkbox",
            name: "selectedDays",
            message: "Chọn ngày trong tuần:",
            choices: [
              { name: "Chủ nhật", value: 0 },
              { name: "Thứ 2", value: 1 },
              { name: "Thứ 3", value: 2 },
              { name: "Thứ 4", value: 3 },
              { name: "Thứ 5", value: 4 },
              { name: "Thứ 6", value: 5 },
              { name: "Thứ 7", value: 6 },
            ],
            default: [0, 1, 2, 3, 4, 5, 6],
          },
        ]
      );

      let connectTime: string | undefined;
      let disconnectTime: string | undefined;

      if (scheduleType === "connect" || scheduleType === "both") {
        const { time } = await this.ui.prompt<{ time: string }>([
          {
            type: "input",
            name: "time",
            message: "Thời gian kết nối (HH:MM):",
            validate: (input: string) => {
              // Simple validation for HH:MM format
              const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
              if (!regex.test(input)) {
                return "Vui lòng nhập đúng định dạng HH:MM (ví dụ: 08:30)";
              }
              return true;
            },
          },
        ]);
        connectTime = time;
      }

      if (scheduleType === "disconnect" || scheduleType === "both") {
        const { time } = await this.ui.prompt<{ time: string }>([
          {
            type: "input",
            name: "time",
            message: "Thời gian ngắt kết nối (HH:MM):",
            validate: (input: string) => {
              // Simple validation for HH:MM format
              const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
              if (!regex.test(input)) {
                return "Vui lòng nhập đúng định dạng HH:MM (ví dụ: 17:30)";
              }
              return true;
            },
          },
        ]);
        disconnectTime = time;
      }

      // Confirm action
      const { confirm } = await this.ui.prompt<{ confirm: boolean }>([
        {
          type: "confirm",
          name: "confirm",
          message: `Thiết lập lịch cho ${accountsToSchedule.length} tài khoản trong nhóm "${groupName}"?`,
          default: true,
        },
      ]);

      if (!confirm) {
        this.ui.showInfo("Đã hủy thiết lập lịch.");
        return;
      }

      // Apply schedule to all accounts in group
      let connectSuccess = 0;
      let disconnectSuccess = 0;

      const spinner = this.ui.createSpinner(
        `Đang thiết lập lịch cho ${accountsToSchedule.length} tài khoản...`
      );
      spinner.start();

      for (const account of accountsToSchedule) {
        const accountIndex = this.accountManager
          .getAccounts()
          .findIndex((a) => a.token === account.token);
        if (accountIndex === -1) continue;

        if (
          connectTime &&
          this.accountManager.scheduleConnect(
            accountIndex,
            connectTime,
            selectedDays
          )
        ) {
          connectSuccess++;
        }

        if (
          disconnectTime &&
          this.accountManager.scheduleDisconnect(
            accountIndex,
            disconnectTime,
            selectedDays
          )
        ) {
          disconnectSuccess++;
        }
      }

      spinner.succeed(`Đã hoàn tất thiết lập lịch!`);

      if (connectTime) {
        this.ui.showSuccess(
          `Đã thiết lập lịch kết nối cho ${connectSuccess}/${accountsToSchedule.length} tài khoản vào lúc ${connectTime}`
        );
      }

      if (disconnectTime) {
        this.ui.showSuccess(
          `Đã thiết lập lịch ngắt kết nối cho ${disconnectSuccess}/${accountsToSchedule.length} tài khoản vào lúc ${disconnectTime}`
        );
      }

      // Confirm and activate if requested
      const { activate } = await this.ui.prompt<{ activate: boolean }>([
        {
          type: "confirm",
          name: "activate",
          message: "Bạn có muốn kích hoạt các lịch này ngay bây giờ không?",
          default: true,
        },
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
  public activateSchedules(): void {
    // Connect account callback
    const connectCallback = async (account: Account) => {
      this.ui.showInfo(
        `Đang tự động kết nối tài khoản ${
          account.name || "Không tên"
        } theo lịch...`
      );
      await this.discordManager.connectAccount(account);
    };

    // Disconnect account callback
    const disconnectCallback = (account: Account) => {
      this.ui.showInfo(
        `Đang tự động ngắt kết nối tài khoản ${
          account.name || "Không tên"
        } theo lịch...`
      );

      // Find the running client for this account
      const runningClients = this.discordManager.getRunningClients();
      const clientToDisconnect = runningClients.find(
        (rc) => rc.account.token === account.token
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

        this.ui.showSuccess(
          `Đã ngắt kết nối tài khoản ${account.name || "Không tên"}`
        );
      }
    };

    // Activate the scheduler
    this.accountManager.activateScheduler(connectCallback, disconnectCallback);
    this.ui.showSuccess("Đã kích hoạt lịch kết nối tự động!");
  }
}