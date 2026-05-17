let toolMeta: Record<string, { name: string; description: string; category: string }> = {};

export function setToolMeta(meta: Record<string, any>) { toolMeta = meta; }
export function getToolLabel(id: string): string { return toolMeta[id]?.name || id; }
export function getToolMeta(id: string) { return toolMeta[id]; }
