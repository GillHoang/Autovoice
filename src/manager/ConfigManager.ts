import * as fs from "fs";
import * as path from "path";
import { Config, Group, IConfigManager } from "../types";

export class ConfigManager implements IConfigManager {
  private configPath: string;

  constructor(configPath: string = path.join(process.cwd(), "config.json")) {
    this.configPath = configPath;
  }

  readConfig(): Config {
    try {
      if (!fs.existsSync(this.configPath)) {
        return { accounts: [], groups: [] };
      }
      const config = JSON.parse(fs.readFileSync(this.configPath, "utf8")) as Config;
      // Ensure groups array exists
      if (!config.groups) {
        config.groups = [];
      }
      return config;
    } catch (error) {
      console.error("Lỗi khi đọc file cấu hình:", error);
      return { accounts: [], groups: [] };
    }
  }

  saveConfig(config: Config): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), "utf8");
      console.log("Đã lưu cấu hình thành công!");
    } catch (error) {
      console.error("Lỗi khi lưu file cấu hình:", error);
    }
  }
}