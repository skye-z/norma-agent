import { ipcMain } from "electron";
import {
  PROVIDER_PRESETS,
  testConnectivity,
  fetchModels,
  testModel,
} from "../provider";
import { appendLog } from "./diag";

export function setupProviderIpc() {
  ipcMain.handle("provider:presets", () => PROVIDER_PRESETS);

  ipcMain.handle("provider:test", async (_event, config: any) => {
    appendLog('info', 'provider', `测试连通性: ${config.name} (${config.type})`);
    const result = await testConnectivity(config);
    appendLog(result.success ? 'info' : 'warn', 'provider', `连通性${result.success ? '成功' : '失败'}: ${config.name}${result.latency ? ` ${result.latency}ms` : ''}${result.error ? ` ${result.error}` : ''}`);
    return result;
  });

  ipcMain.handle("provider:models", async (_event, config: any) => {
    appendLog('info', 'provider', `获取模型列表: ${config.name} (${config.type})`);
    try {
      const models = await fetchModels(config);
      appendLog('info', 'provider', `获取到 ${models.length} 个模型:\n${models.map((m: any) => `  ${m.id} → ${m.display_name || m.id}`).join('\n')}`);
      return { success: true, models };
    } catch (err: any) {
      appendLog('error', 'provider', `获取模型失败: ${config.name} - ${err.message}`);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("model:test", async (_event, config: any, modelId: string) => {
    appendLog('info', 'provider', `测试模型: ${modelId} (${config.name})`);
    const result = await testModel(config, modelId);
    appendLog(result.success ? 'info' : 'warn', 'provider', `模型测试${result.success ? '成功' : '失败'}: ${modelId}${result.latency ? ` ${result.latency}ms` : ''}${result.error ? ` ${result.error}` : ''}`);
    return result;
  });
}
