import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initSettings } from "./lib/settings";
import { AppProvider } from "./lib/store";
import "./styles.css";

initSettings();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>,
);
