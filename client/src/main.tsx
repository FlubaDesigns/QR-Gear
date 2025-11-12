import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/layout.css";
import "./styles/theme.css";
import "./styles/buttons.css";
import "./styles/forms.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
