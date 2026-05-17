import React from "react";
import { createRoot } from "react-dom/client";
import { IpcRuntime, NormaRuntime } from "./components/runtime";
import { ChatAreaInner } from "./components/ChatArea";
import { CommandBarInner } from "./components/CommandBar";
import "./index.css";

const App = () => {
  const [route, setRoute] = React.useState(window.location.hash);

  React.useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash);
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  if (route === "#/command") {
    return (
      <IpcRuntime>
        <div className="command-bar-bg w-full h-full overflow-hidden">
          <CommandBarInner />
        </div>
      </IpcRuntime>
    );
  }

  return (
    <NormaRuntime>
      <ChatAreaInner />
    </NormaRuntime>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);

requestAnimationFrame(() => {
  const splash = document.getElementById("splash");
  if (splash) {
    splash.classList.add("hide");
    setTimeout(() => splash.remove(), 400);
  }
});
