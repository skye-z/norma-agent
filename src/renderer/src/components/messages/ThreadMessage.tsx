import React from "react";
import { useAuiState } from "@assistant-ui/react";
import { UserMessage } from "./UserMessage";
import { AssistantMessage } from "./AssistantMessage";

export const ThreadMessage: React.FC = () => {
  const role = useAuiState((s: any) => s.message.role);
  if (role === "user") return <UserMessage />;
  return <AssistantMessage />;
};
