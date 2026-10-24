import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Fade out the themed splash once the app has mounted.
const splash = document.getElementById("splash");
if (splash) {
  window.setTimeout(() => {
    splash.classList.add("hide");
    window.setTimeout(() => splash.remove(), 450);
  }, 500);
}
