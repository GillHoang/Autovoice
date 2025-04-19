import { Account, Group } from "../../types";
import { AccountManager } from "../../manager/AccountManager";
import { DiscordManager } from "../../manager/DiscordManager";
import { UserInterface } from "../UserInterface";

export class GroupModule {
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
   * Quản lý nhóm tài khoản
   */
  public async manageGroups(): Promise<void> {
    try {
      const { action } = await this.ui.showGroupManagementMenu();

      switch (action) {
        case "viewGroups":
          await this.viewGroups();
          break;
        case "createGroup":
          await this.createGroup();
          break;
        case "editGroup":
          await this.editGroup();
          break;
        case "deleteGroup":
          await this.deleteGroup();
          break;
        case "addAccountToGroup":
          await this.addAccountToGroup();
          break;
        case "removeAccountFromGroup":
          await this.removeAccountFromGroup();
          break;
        case "connectByGroup":
          await this.connectAccountsByGroup();
          break;
        case "back":
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
      this.ui.showWarning(
        "Không có nhóm nào được tạo. Vui lòng tạo nhóm trước."
      );
      return;
    }

    this.ui.showInfo("=== Danh sách nhóm ===");

    groups.forEach((group) => {
      const groupAccounts = accounts.filter((acc) => acc.group === group.id);
      console.log(
        `\n📁 ${group.name}${
          group.description ? ` - ${group.description}` : ""
        }`
      );
      console.log(`   ID: ${group.id}`);
      console.log(`   Số tài khoản: ${groupAccounts.length}`);

      if (groupAccounts.length > 0) {
        console.log(`   Danh sách tài khoản:`);
        groupAccounts.forEach((acc, idx) => {
          console.log(
            `     ${idx + 1}. ${acc.name || "Không tên"} (${acc.token.substring(
              0,
              10
            )}...)`
          );
        });
      } else {
        console.log(`   Chưa có tài khoản nào trong nhóm này.`);
      }
    });

    // Show ungrouped accounts
    const ungroupedAccounts = accounts.filter((acc) => !acc.group);
    if (ungroupedAccounts.length > 0) {
      console.log(
        `\n📁 Tài khoản chưa phân nhóm (${ungroupedAccounts.length}):`
      );
      ungroupedAccounts.forEach((acc, idx) => {
        console.log(
          `   ${idx + 1}. ${acc.name || "Không tên"} (${acc.token.substring(
            0,
            10
          )}...)`
        );
      });
    }

    // Wait for user to press enter to continue
    await this.ui.prompt([
      {
        type: "input",
        name: "continue",
        message: "Nhấn Enter để tiếp tục...",
      },
    ]);
  }

  /**
   * Tạo nhóm mới
   */
  private async createGroup(): Promise<void> {
    const { name, description } = await this.ui.prompt<{
      name: string;
      description: string;
    }>([
      {
        type: "input",
        name: "name",
        message: "Tên nhóm:",
        validate: (input: string) =>
          input.trim() !== "" ? true : "Tên nhóm không được để trống",
      },
      {
        type: "input",
        name: "description",
        message: "Mô tả (tùy chọn):",
      },
    ]);

    const newGroup = this.accountManager.addGroup({ name, description });
    this.ui.showSuccess(`Đã tạo nhóm "${name}" thành công! 🎉`);

    // Ask if user wants to add accounts to this group
    const { addAccounts } = await this.ui.prompt<{ addAccounts: boolean }>([
      {
        type: "confirm",
        name: "addAccounts",
        message: "Bạn có muốn thêm tài khoản vào nhóm này không?",
        default: true,
      },
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
      const group = groups.find((g) => g.id === groupId);

      if (!group) {
        this.ui.showError("Không tìm thấy nhóm. Vui lòng thử lại.");
        return;
      }

      // Get new group info
      const { name, description } = await this.ui.prompt<{
        name: string;
        description: string;
      }>([
        {
          type: "input",
          name: "name",
          message: "Tên nhóm mới:",
          default: group.name,
          validate: (input: string) =>
            input.trim() !== "" ? true : "Tên nhóm không được để trống",
        },
        {
          type: "input",
          name: "description",
          message: "Mô tả mới (tùy chọn):",
          default: group.description || "",
        },
      ]);

      // Update group
      const updatedGroup = this.accountManager.updateGroup(groupId, {
        name,
        description,
      });

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
      const group = groups.find((g) => g.id === groupId);

      if (!group) {
        this.ui.showError("Không tìm thấy nhóm. Vui lòng thử lại.");
        return;
      }

      // Confirm deletion
      const { confirm } = await this.ui.prompt<{ confirm: boolean }>([
        {
          type: "confirm",
          name: "confirm",
          message: `Bạn có chắc chắn muốn xóa nhóm "${group.name}"? Tài khoản sẽ không bị xóa.`,
          default: false,
        },
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
      const group = groups.find((g) => g.id === groupId);

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
  private async addAccountsToSpecificGroup(
    groupId: string,
    groupName: string
  ): Promise<void> {
    const allAccounts = this.accountManager.getAccounts();
    const unassignedAccounts = allAccounts.filter(
      (acc) => acc.group !== groupId
    );
    const groups = this.accountManager.getGroups();

    if (unassignedAccounts.length === 0) {
      this.ui.showWarning("Không có tài khoản nào để thêm vào nhóm.");
      return;
    }

    // Show multi-select for accounts
    const { selectedAccountIndices } = await this.ui.prompt<{
      selectedAccountIndices: number[];
    }>([
      {
        type: "checkbox",
        name: "selectedAccountIndices",
        message: `Chọn các tài khoản để thêm vào nhóm "${groupName}":`,
        choices: unassignedAccounts.map((acc, idx) => {
          const accountIndex = allAccounts.findIndex(
            (a) => a.token === acc.token
          );
          let displayName = `${acc.name || "Không tên"} (${acc.token.substring(
            0,
            10
          )}...)`;

          // Add current group info if account is in a different group
          if (acc.group) {
            const currentGroup = groups.find((g) => g.id === acc.group);
            if (currentGroup) {
              displayName += ` [Hiện tại: ${currentGroup.name}]`;
            }
          }

          return {
            name: displayName,
            value: accountIndex,
            checked: false,
          };
        }),
      },
    ]);

    if (selectedAccountIndices.length === 0) {
      this.ui.showInfo("Không có tài khoản nào được chọn.");
      return;
    }

    // Add accounts to group
    let successCount = 0;
    for (const accountIndex of selectedAccountIndices) {
      const result = this.accountManager.assignAccountToGroup(
        accountIndex,
        groupId
      );
      if (result) successCount++;
    }

    this.ui.showSuccess(
      `Đã thêm ${successCount} tài khoản vào nhóm "${groupName}"! 🔄`
    );
  }

  /**
   * Xóa tài khoản khỏi nhóm
   */
  private async removeAccountFromGroup(): Promise<void> {
    const groups = this.accountManager.getGroups();
    const accounts = this.accountManager.getAccounts();
    const groupedAccounts = accounts.filter((acc) => acc.group !== undefined);

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
      const { accountIndices } = await this.ui.prompt<{
        accountIndices: number[];
      }>([
        {
          type: "checkbox",
          name: "accountIndices",
          message: "Chọn tài khoản để xóa khỏi nhóm:",
          choices: groupedAccounts.map((acc, idx) => {
            const accountIndex = accounts.findIndex(
              (a) => a.token === acc.token
            );
            const group = acc.group ? groupMap.get(acc.group) : undefined;

            return {
              name: `${acc.name || "Không tên"} (${acc.token.substring(
                0,
                10
              )}...) [Nhóm: ${group?.name || "Không xác định"}]`,
              value: accountIndex,
              checked: false,
            };
          }),
        },
      ]);

      if (accountIndices.length === 0) {
        this.ui.showInfo("Không có tài khoản nào được chọn.");
        return;
      }

      // Remove accounts from groups
      let successCount = 0;
      for (const accountIndex of accountIndices) {
        const result = this.accountManager.assignAccountToGroup(
          accountIndex,
          undefined
        );
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
  public async connectAccountsByGroup(): Promise<void> {
    const groups = this.accountManager.getGroups();

    if (groups.length === 0) {
      this.ui.showWarning("Không có nhóm nào. Vui lòng tạo nhóm trước.");
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
            message: "Chọn nhóm để kết nối:",
            choices: groupChoices,
          },
        ]
      );

      // Get accounts in selected group
      let accountsToConnect: Account[];
      let groupName: string;

      if (selectedGroup === "ungrouped") {
        accountsToConnect = this.accountManager.getUngroupedAccounts();
        groupName = "Chưa phân nhóm";
      } else {
        accountsToConnect =
          this.accountManager.getAccountsByGroup(selectedGroup);
        groupName =
          groups.find((g) => g.id === selectedGroup)?.name ||
          "Nhóm không xác định";
      }

      if (accountsToConnect.length === 0) {
        this.ui.showWarning(
          `Không có tài khoản nào trong nhóm "${groupName}".`
        );
        return;
      }

      // Confirm connection
      const { confirm } = await this.ui.prompt<{ confirm: boolean }>([
        {
          type: "confirm",
          name: "confirm",
          message: `Kết nối ${accountsToConnect.length} tài khoản trong nhóm "${groupName}"?`,
          default: true,
        },
      ]);

      if (!confirm) {
        this.ui.showInfo("Đã hủy kết nối tài khoản.");
        return;
      }

      // Connect accounts
      this.ui.showInfo(
        `Đang kết nối ${accountsToConnect.length} tài khoản trong nhóm "${groupName}"...`
      );

      for (const account of accountsToConnect) {
        const spinner = this.ui.createSpinner(
          `Đang kết nối ${account.name || "Tài khoản không tên"}...`
        );
        spinner.start();

        try {
          await this.discordManager.connectAccount(account);
          spinner.succeed(
            `Đã kết nối ${account.name || "Tài khoản không tên"}`
          );
        } catch (error) {
          spinner.fail(
            `Không thể kết nối ${account.name || "Tài khoản không tên"}`
          );
        }

        // Wait between connections to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      this.ui.showSuccess(
        `Hoàn tất kết nối tài khoản trong nhóm "${groupName}"! 🎉`
      );
    } catch (error) {
      this.ui.showError(`Lỗi khi kết nối tài khoản theo nhóm: ${error}`);
    }
  }
}