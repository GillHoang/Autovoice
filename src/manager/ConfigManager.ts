import * as fs from "fs";
import * as path from "path";
import { Config, IConfigManager } from "../types";

export class ConfigManager implements IConfigManager {
  private configPath: string;

  constructor(configPath: string = path.join(__dirname, "..", "config.json")) {
    this.configPath = configPath;
  }

  readConfig(): Config {
    try {
      if (!fs.existsSync(this.configPath)) {
        return { accounts: [] };
      }
      return JSON.parse(fs.readFileSync(this.configPath, "utf8")) as Config;
    } catch (error) {
      console.error("Lỗi khi đọc file cấu hình:", error);
      return { accounts: [] };
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