import { ipcMain } from "electron";
import {
  PROVIDER_PRESETS,
  testConnectivity,
  fetchModels,
  testModel,
} from "../provider";

export function setupProviderIpc() {
  ipcMain.handle("provider:presets", () => PROVIDER_PRESETS);

  ipcMain.handle("provider:test", async (_event, config: any) => {
    return testConnectivity(config);
  });

  ipcMain.handle("provider:models", async (_event, config: any) => {
    try {
      const models = await fetchModels(config);
      return { success: true, models };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("model:test", async (_event, config: any, modelId: string) => {
    return testModel(config, modelId);
  });
}
