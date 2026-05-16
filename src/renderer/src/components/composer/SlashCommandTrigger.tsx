import React from "react";
import {
  unstable_useMentionAdapter,
  ComposerPrimitive,
} from "@assistant-ui/react";
import { SLASH_COMMANDS, AGENTS } from "../../lib/shared";

const SlashCommandTrigger: React.FC = () => {
  const slash = unstable_useMentionAdapter({
    items: SLASH_COMMANDS.map((cmd) => ({
      id: cmd.command,
      label: cmd.command,
      description: cmd.description,
      type: "command",
    })),
    formatter: {
      serialize: (item) => `${item.label} `,
      parse: (text) => [{ kind: "text", text }],
    },
  });

  return (
    <ComposerPrimitive.Unstable_TriggerPopover char="/" adapter={slash.adapter}>
      <ComposerPrimitive.Unstable_TriggerPopover.Directive
        formatter={slash.directive.formatter}
      />
      <ComposerPrimitive.Unstable_TriggerPopoverItems>
        {(items) => (
          <div className="glass-popover absolute bottom-full mb-2 left-0 w-64 flex flex-col py-1 z-50">
            {items.map((item, i) => (
              <ComposerPrimitive.Unstable_TriggerPopoverItem
                key={item.id}
                item={item}
                index={i}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-norma-textMuted hover:bg-white/[0.06] data-[highlighted]:bg-white/[0.08] data-[highlighted]:text-norma-text transition-colors text-left"
              >
                <span className="font-mono text-norma-accent">
                  {item.label}
                </span>
                <span className="flex-1 text-norma-textDim">
                  {item.description}
                </span>
              </ComposerPrimitive.Unstable_TriggerPopoverItem>
            ))}
          </div>
        )}
      </ComposerPrimitive.Unstable_TriggerPopoverItems>
    </ComposerPrimitive.Unstable_TriggerPopover>
  );
};

const MentionTrigger: React.FC = () => {
  const mention = unstable_useMentionAdapter({
    items: AGENTS,
    formatter: {
      serialize: (item) => `@${item.label} `,
      parse: (text) => [{ kind: "text", text }],
    },
  });

  return (
    <ComposerPrimitive.Unstable_TriggerPopover
      char="@"
      adapter={mention.adapter}
    >
      <ComposerPrimitive.Unstable_TriggerPopover.Directive
        formatter={mention.directive.formatter}
      />
      <ComposerPrimitive.Unstable_TriggerPopoverItems>
        {(items) => (
          <div className="glass-popover absolute bottom-full mb-2 left-0 w-64 flex flex-col py-1 z-50">
            {items.map((item, i) => (
              <ComposerPrimitive.Unstable_TriggerPopoverItem
                key={item.id}
                item={item}
                index={i}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-norma-textMuted hover:bg-white/[0.06] data-[highlighted]:bg-white/[0.08] data-[highlighted]:text-norma-text transition-colors text-left"
              >
                <span className="w-4 h-4 rounded-full bg-norma-accentMuted flex items-center justify-center text-[8px] text-norma-accent font-bold">
                  {(item.label as string)[0]}
                </span>
                <span className="font-medium text-norma-text">
                  {item.label}
                </span>
                <span className="flex-1 text-norma-textDim">
                  {item.description}
                </span>
              </ComposerPrimitive.Unstable_TriggerPopoverItem>
            ))}
          </div>
        )}
      </ComposerPrimitive.Unstable_TriggerPopoverItems>
    </ComposerPrimitive.Unstable_TriggerPopover>
  );
};

export { SlashCommandTrigger, MentionTrigger };
