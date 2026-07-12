import i18next from "i18next";
import { OpenLocaleBackend } from "@openlocale/i18next-backend";

const ENDPOINT = import.meta.env.VITE_OPENLOCALE_ENDPOINT ?? "http://localhost:5199";
const PROJECT = import.meta.env.VITE_OPENLOCALE_PROJECT ?? "demo";
const TOKEN = import.meta.env.VITE_OPENLOCALE_TOKEN as string | undefined;

function render() {
  document.getElementById("title")!.textContent = i18next.t("demo.title");
  document.getElementById("body")!.textContent = i18next.t("demo.body");
  document.getElementById("cta")!.textContent = i18next.t("demo.cta");
  for (const id of ["title", "body", "cta"]) {
    const el = document.getElementById(id)!;
    el.classList.remove("flash");
    void el.offsetWidth; // restart the animation
    el.classList.add("flash");
  }
}

await i18next.use(OpenLocaleBackend).init({
  lng: "en",
  fallbackLng: false,
  ns: ["default"],
  defaultNS: "default",
  backend: {
    endpoint: ENDPOINT,
    project: PROJECT,
    apiKey: TOKEN,
    live: true,
    onUpdate: () => {
      document.getElementById("status")!.textContent = "live update received";
      render();
    }
  },
  interpolation: { escapeValue: false }
});

document.getElementById("status")!.textContent = "live";
i18next.on("loaded", render);
render();
