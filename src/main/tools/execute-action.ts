import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

let _robot: typeof import('@jitsi/robotjs') | null = null;
async function getRobot() {
  if (!_robot) {
    _robot = await import('@jitsi/robotjs');
    _robot.setMouseDelay(50);
    _robot.setKeyboardDelay(20);
  }
  return _robot;
}

const MouseActionSchema = z.object({
  type: z.literal('mouse'),
  action: z.enum(['move', 'click', 'double_click', 'right_click', 'scroll_up', 'scroll_down', 'drag']),
  x: z.number().optional().describe('Target X coordinate (screen pixels)'),
  y: z.number().optional().describe('Target Y coordinate (screen pixels)'),
  fromX: z.number().optional().describe('Drag start X'),
  fromY: z.number().optional().describe('Drag start Y'),
  amount: z.number().optional().describe('Scroll amount (default 3)'),
});

const KeyboardActionSchema = z.object({
  type: z.literal('keyboard'),
  action: z.enum(['type', 'key_tap', 'key_toggle', 'hotkey', 'shortcut']),
  text: z.string().optional().describe('Text to type (for "type" action)'),
  key: z.string().optional().describe('Key name (for "key_tap" / "key_toggle") e.g. "enter", "tab", "escape"'),
  down: z.boolean().optional().describe('true = key down, false = key up (for "key_toggle")'),
  modifiers: z.array(z.string()).optional().describe('Modifier keys e.g. ["control", "shift"]'),
  shortcut: z.string().optional().describe('Named shortcut: "selectAll", "copy", "paste", "cut", "undo", "save", "find", "switchApp", "closeWindow", "altTab"'),
});

const GetPositionActionSchema = z.object({
  type: z.literal('get_mouse_pos'),
});

const ActionSchema = z.discriminatedUnion('type', [
  MouseActionSchema,
  KeyboardActionSchema,
  GetPositionActionSchema,
]);

export const executeActionTool = createTool({
  id: 'execute_action',
  description: `在用户屏幕上执行鼠标和键盘操作。可用操作:
- 鼠标: move(移动), click(单击), double_click(双击), right_click(右键), scroll_up(向上滚), scroll_down(向下滚), drag(拖拽)
- 键盘: type(输入文字), key_tap(按键如enter/tab/escape), key_toggle(按下/释放), hotkey(组合键), shortcut(预设快捷键)
- 获取鼠标位置: get_mouse_pos

预设快捷键(shortcut): selectAll(Ctrl+A), copy(Ctrl+C), paste(Ctrl+V), cut(Ctrl+X), undo(Ctrl+Z), save(Ctrl+S), find(Ctrl+F), closeWindow(Alt+F4), altTab(Alt+Tab)

重要: 始终先用 read_screen 截图确认屏幕内容, 再计算坐标, 最后执行操作。屏幕坐标: 左上角为(0,0)。`,
  inputSchema: z.object({
    actions: z.array(ActionSchema).min(1).describe('按顺序执行的操作数组'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    results: z.array(z.object({
      action: z.string(),
      success: z.boolean(),
      detail: z.string().optional(),
      error: z.string().optional(),
    })),
  }),
  execute: async (input) => {
    const robot = await getRobot();
    const results: Array<{ action: string; success: boolean; detail?: string; error?: string }> = [];

    for (const act of input.actions) {
      try {
        if (act.type === 'mouse') {
          results.push(executeMouseAction(act, robot));
        } else if (act.type === 'keyboard') {
          results.push(executeKeyboardAction(act, robot));
        } else if (act.type === 'get_mouse_pos') {
          const pos = robot.getMousePos();
          results.push({
            action: 'get_mouse_pos',
            success: true,
            detail: `Mouse at (${pos.x}, ${pos.y})`,
          });
        }
      } catch (error) {
        results.push({
          action: `${act.type}/${(act as any).action || 'unknown'}`,
          success: false,
          error: String(error),
        });
      }
    }

    return {
      success: results.every((r) => r.success),
      results,
    };
  },
});

function executeMouseAction(act: z.infer<typeof MouseActionSchema>, robot: NonNullable<Awaited<ReturnType<typeof getRobot>>>) {
  const screen = robot.getScreenSize();

  switch (act.action) {
    case 'move': {
      if (act.x === undefined || act.y === undefined) {
        return { action: 'mouse/move', success: false, error: 'x and y required' };
      }
      robot.moveMouseSmooth(act.x, act.y);
      return { action: 'mouse/move', success: true, detail: `Moved to (${act.x}, ${act.y})` };
    }
    case 'click': {
      const x = act.x;
      const y = act.y;
      if (x !== undefined && y !== undefined) {
        robot.moveMouseSmooth(x, y);
      }
      robot.mouseClick('left', false);
      return { action: 'mouse/click', success: true, detail: `Clicked at (${x ?? '?'}, ${y ?? '?'})` };
    }
    case 'double_click': {
      if (act.x !== undefined && act.y !== undefined) {
        robot.moveMouseSmooth(act.x, act.y);
      }
      robot.mouseClick('left', true);
      return { action: 'mouse/double_click', success: true, detail: `Double-clicked at (${act.x ?? '?'}, ${act.y ?? '?'})` };
    }
    case 'right_click': {
      if (act.x !== undefined && act.y !== undefined) {
        robot.moveMouseSmooth(act.x, act.y);
      }
      robot.mouseClick('right', false);
      return { action: 'mouse/right_click', success: true, detail: `Right-clicked at (${act.x ?? '?'}, ${act.y ?? '?'})` };
    }
    case 'scroll_up': {
      const amt = act.amount ?? 3;
      robot.scrollMouse(0, -amt);
      return { action: 'mouse/scroll_up', success: true, detail: `Scrolled up ${amt}` };
    }
    case 'scroll_down': {
      const amt = act.amount ?? 3;
      robot.scrollMouse(0, amt);
      return { action: 'mouse/scroll_down', success: true, detail: `Scrolled down ${amt}` };
    }
    case 'drag': {
      if (act.fromX === undefined || act.fromY === undefined || act.x === undefined || act.y === undefined) {
        return { action: 'mouse/drag', success: false, error: 'fromX, fromY, x, y all required' };
      }
      robot.moveMouseSmooth(act.fromX, act.fromY);
      robot.mouseToggle('down', 'left');
      robot.moveMouseSmooth(act.x, act.y);
      robot.mouseToggle('up', 'left');
      return { action: 'mouse/drag', success: true, detail: `Dragged from (${act.fromX},${act.fromY}) to (${act.x},${act.y})` };
    }
    default:
      return { action: `mouse/${act.action}`, success: false, error: 'Unknown mouse action' };
  }
}

function executeKeyboardAction(act: z.infer<typeof KeyboardActionSchema>, robot: NonNullable<Awaited<ReturnType<typeof getRobot>>>) {
  if (act.action === 'shortcut') {
    return executeShortcut(act.shortcut || '', robot);
  }
  switch (act.action) {
    case 'type': {
      if (!act.text) return { action: 'keyboard/type', success: false, error: 'text required' };
      robot.typeString(act.text);
      return { action: 'keyboard/type', success: true, detail: `Typed "${act.text.slice(0, 50)}${act.text.length > 50 ? '...' : ''}"` };
    }
    case 'key_tap': {
      if (!act.key) return { action: 'keyboard/key_tap', success: false, error: 'key required' };
      robot.keyTap(act.key, act.modifiers as any);
      return { action: 'keyboard/key_tap', success: true, detail: `Tapped ${[...(act.modifiers || []), act.key].join('+')}` };
    }
    case 'key_toggle': {
      if (!act.key) return { action: 'keyboard/key_toggle', success: false, error: 'key required' };
      robot.keyToggle(act.key, act.down ? 'down' : 'up', act.modifiers as any);
      return { action: 'keyboard/key_toggle', success: true, detail: `${act.down ? 'Pressed' : 'Released'} ${act.key}` };
    }
    case 'hotkey': {
      if (!act.key) return { action: 'keyboard/hotkey', success: false, error: 'key required' };
      const mods = act.modifiers || [];
      for (const mod of mods) {
        robot.keyToggle(mod, 'down');
      }
      robot.keyTap(act.key);
      for (const mod of [...mods].reverse()) {
        robot.keyToggle(mod, 'up');
      }
      return { action: 'keyboard/hotkey', success: true, detail: `Hotkey ${[...mods, act.key].join('+')}` };
    }
    default:
      return { action: `keyboard/${act.action}`, success: false, error: 'Unknown keyboard action' };
  }
}

const SHORTCUTS: Record<string, { key: string; modifiers: string[] }> = {
  selectAll: { key: 'a', modifiers: ['control'] },
  copy: { key: 'c', modifiers: ['control'] },
  paste: { key: 'v', modifiers: ['control'] },
  cut: { key: 'x', modifiers: ['control'] },
  undo: { key: 'z', modifiers: ['control'] },
  save: { key: 's', modifiers: ['control'] },
  find: { key: 'f', modifiers: ['control'] },
  switchApp: { key: 'tab', modifiers: ['alt'] },
  closeWindow: { key: 'f4', modifiers: ['alt'] },
  altTab: { key: 'tab', modifiers: ['alt'] },
};

function executeShortcut(shortcut: string, robot: NonNullable<Awaited<ReturnType<typeof getRobot>>>) {
  const mapping = SHORTCUTS[shortcut];
  if (!mapping) {
    const available = Object.keys(SHORTCUTS).join(', ');
    return { action: 'keyboard/shortcut', success: false, error: `未知快捷键: "${shortcut}". 可用: ${available}` };
  }
  robot.keyTap(mapping.key, mapping.modifiers as any);
  return { action: 'keyboard/shortcut', success: true, detail: `快捷键 ${[...mapping.modifiers, mapping.key].join('+')} (${shortcut})` };
}
