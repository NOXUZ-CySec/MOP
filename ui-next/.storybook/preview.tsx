import React from "react";
import type { Preview } from "@storybook/react-vite";
import theme from "./theme";
import "../src/style.css";
import "../src/reference27.css";
import "../src/branding31.css";
import "../src/records28.css";
import "../src/records33.css";
import "../src/schedule30.css";
import "../src/schedule31.css";
import "../src/schedule70.css";
import "../src/premium47.css";
import "../src/login331.css";
import "../src/login34.css";
import "../src/mop-theme1081.css";
import "../src/mop-theme1092.css";
import "../src/mop-theme1094.css";
import "../src/mop-theme1095.css";
import "../src/shadcn-mop.css";
import "../catalog/catalog.css";

if (typeof document !== "undefined") document.documentElement.lang = "pt-BR";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    controls: { expanded: true },
    docs: { theme },
    a11y: { test: "todo" },
    options: { storySort: { order: ["Fundamentos", "Componentes", "Registros", "Visão Geral"] } },
  },
  decorators: [(Story) => (
    <div className="ref-app mop-catalog-ref">
      <main className="mop-page47 mop-catalog-stage"><Story /></main>
    </div>
  )],
};
export default preview;
