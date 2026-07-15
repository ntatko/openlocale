/**
 * Seed a demo workspace:
 *   admin@example.com / password  ·  org "acme"  ·  public project "demo"
 *   locales en/es/de with ~50 translated keys
 *
 * Run from the repo root so the sqlite file lands next to the app:
 *   pnpm seed            (uses OPENLOCALE_DB_URL or ./apps/web/openlocale.db)
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext } from "@openlocale/api";
import { repos } from "@openlocale/db";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
process.env.OPENLOCALE_DB_URL ??= `file:${join(repoRoot, "apps", "web", "openlocale.db")}`;

const ctx = await createContext({ dbUrl: process.env.OPENLOCALE_DB_URL });
const { handle, auth, bus } = ctx;

// --- user (via better-auth so the password hash is correct)
const email = "admin@example.com";
let userId: string;
const existing = await repos.users.byIds(handle, []);
void existing;
try {
  const result = await auth.api.signUpEmail({
    body: { email, password: "password1234", name: "Admin" }
  });
  userId = result.user.id;
  console.log(`created user ${email} / password1234`);
} catch {
  const session = await auth.api.signInEmail({
    body: { email, password: "password1234" }
  });
  userId = session.user.id;
  console.log(`user ${email} already exists`);
}
const actor = { id: userId, type: "user" as const };

// --- org + project
let org = await repos.orgs.bySlug(handle, "acme");
if (!org) {
  org = await repos.orgs.create(handle, { name: "Acme", slug: "acme", ownerUserId: userId });
  console.log("created org acme");
}
let project = await repos.projects.bySlug(handle, "demo");
if (!project) {
  project = await repos.projects.create(handle, {
    orgId: org.id,
    name: "Demo",
    slug: "demo",
    sourceLocale: "en",
    public: true,
    actor
  });
  console.log("created project demo (public)");
}
for (const locale of ["es", "de"]) {
  await repos.projects.addLocale(handle, { projectId: project.id, orgId: org.id, locale, actor });
}

// --- keys + translations
const STRINGS: Record<string, { en: string; es: string; de: string; context?: string }> = {
  "nav.home": { en: "Home", es: "Inicio", de: "Startseite" },
  "nav.products": { en: "Products", es: "Productos", de: "Produkte" },
  "nav.pricing": { en: "Pricing", es: "Precios", de: "Preise" },
  "nav.about": { en: "About us", es: "Sobre nosotros", de: "Über uns" },
  "nav.contact": { en: "Contact", es: "Contacto", de: "Kontakt" },
  "nav.signin": { en: "Sign in", es: "Iniciar sesión", de: "Anmelden" },
  "nav.signout": { en: "Sign out", es: "Cerrar sesión", de: "Abmelden" },
  "hero.title": {
    en: "Ship in every language",
    es: "Lanza en todos los idiomas",
    de: "In jeder Sprache ausliefern",
    context: "Landing page headline"
  },
  "hero.subtitle": {
    en: "Translations that update live, without a redeploy.",
    es: "Traducciones que se actualizan en vivo, sin redespliegue.",
    de: "Übersetzungen, die live aktualisiert werden — ohne Redeploy."
  },
  "hero.cta": { en: "Get started free", es: "Comienza gratis", de: "Kostenlos starten" },
  "checkout.title": { en: "Checkout", es: "Pagar", de: "Kasse", context: "Checkout page header" },
  "checkout.subtotal": { en: "Subtotal", es: "Subtotal", de: "Zwischensumme" },
  "checkout.shipping": { en: "Shipping", es: "Envío", de: "Versand" },
  "checkout.tax": { en: "Tax", es: "Impuestos", de: "Steuern" },
  "checkout.total": { en: "Total", es: "Total", de: "Gesamt" },
  "checkout.pay": { en: "Pay now", es: "Pagar ahora", de: "Jetzt bezahlen" },
  "checkout.greeting": {
    en: "Welcome back, {{name}}!",
    es: "¡Bienvenido de nuevo, {{name}}!",
    de: "Willkommen zurück, {{name}}!"
  },
  "cart.empty": {
    en: "Your cart is empty",
    es: "Tu carrito está vacío",
    de: "Dein Warenkorb ist leer"
  },
  "cart.items": {
    en: "{count, plural, one {# item} other {# items}}",
    es: "{count, plural, one {# artículo} other {# artículos}}",
    de: "{count, plural, one {# Artikel} other {# Artikel}}"
  },
  "cart.remove": { en: "Remove", es: "Eliminar", de: "Entfernen" },
  "cta.save": { en: "Save changes", es: "Guardar cambios", de: "Änderungen speichern" },
  "cta.cancel": { en: "Cancel", es: "Cancelar", de: "Abbrechen" },
  "cta.delete": { en: "Delete", es: "Eliminar", de: "Löschen" },
  "cta.confirm": { en: "Confirm", es: "Confirmar", de: "Bestätigen" },
  "cta.back": { en: "Back", es: "Atrás", de: "Zurück" },
  "cta.next": { en: "Next", es: "Siguiente", de: "Weiter" },
  "form.email": { en: "Email address", es: "Correo electrónico", de: "E-Mail-Adresse" },
  "form.password": { en: "Password", es: "Contraseña", de: "Passwort" },
  "form.name": { en: "Full name", es: "Nombre completo", de: "Vollständiger Name" },
  "form.required": {
    en: "This field is required",
    es: "Este campo es obligatorio",
    de: "Dieses Feld ist erforderlich"
  },
  "form.invalid_email": {
    en: "Please enter a valid email",
    es: "Introduce un correo válido",
    de: "Bitte gib eine gültige E-Mail ein"
  },
  "error.404.title": { en: "Page not found", es: "Página no encontrada", de: "Seite nicht gefunden" },
  "error.404.body": {
    en: "The page you're looking for doesn't exist.",
    es: "La página que buscas no existe.",
    de: "Die gesuchte Seite existiert nicht."
  },
  "error.500.title": { en: "Something went wrong", es: "Algo salió mal", de: "Etwas ist schiefgelaufen" },
  "error.retry": { en: "Try again", es: "Inténtalo de nuevo", de: "Erneut versuchen" },
  "settings.title": { en: "Settings", es: "Configuración", de: "Einstellungen" },
  "settings.language": { en: "Language", es: "Idioma", de: "Sprache" },
  "settings.notifications": { en: "Notifications", es: "Notificaciones", de: "Benachrichtigungen" },
  "settings.theme": { en: "Theme", es: "Tema", de: "Design" },
  "settings.theme.dark": { en: "Dark", es: "Oscuro", de: "Dunkel" },
  "settings.theme.light": { en: "Light", es: "Claro", de: "Hell" },
  "email.welcome.subject": {
    en: "Welcome to Acme!",
    es: "¡Bienvenido a Acme!",
    de: "Willkommen bei Acme!"
  },
  "email.welcome.body": {
    en: "Thanks for signing up. Let's get you started.",
    es: "Gracias por registrarte. Empecemos.",
    de: "Danke für deine Registrierung. Los geht's."
  },
  "search.placeholder": { en: "Search products…", es: "Buscar productos…", de: "Produkte suchen…" },
  "search.no_results": {
    en: "No results for \"{{query}}\"",
    es: "Sin resultados para \"{{query}}\"",
    de: "Keine Ergebnisse für \"{{query}}\""
  },
  "footer.privacy": { en: "Privacy policy", es: "Política de privacidad", de: "Datenschutz" },
  "footer.terms": { en: "Terms of service", es: "Términos del servicio", de: "Nutzungsbedingungen" },
  "footer.copyright": {
    en: "© {{year}} Acme Inc. All rights reserved.",
    es: "© {{year}} Acme Inc. Todos los derechos reservados.",
    de: "© {{year}} Acme Inc. Alle Rechte vorbehalten."
  },
  "toast.saved": { en: "Saved!", es: "¡Guardado!", de: "Gespeichert!" },
  "toast.copied": { en: "Copied to clipboard", es: "Copiado al portapapeles", de: "In die Zwischenablage kopiert" },
  "modal.confirm_delete": {
    en: "Are you sure you want to delete this? This cannot be undone.",
    es: "¿Seguro que quieres eliminar esto? No se puede deshacer.",
    de: "Möchtest du das wirklich löschen? Das kann nicht rückgängig gemacht werden."
  }
};

let created = 0;
for (const [name, tr] of Object.entries(STRINGS)) {
  let key = await repos.keys.byName(handle, project.id, "default", name);
  if (!key) {
    key = await repos.keys.create(handle, {
      projectId: project.id,
      orgId: org.id,
      namespace: "default",
      name,
      context: tr.context ?? null,
      actor
    });
    created++;
  }
  for (const locale of ["en", "es", "de"] as const) {
    await repos.translations.upsert(
      handle,
      {
        keyId: key.id,
        projectId: project.id,
        projectSlug: project.slug,
        orgId: org.id,
        locale,
        value: tr[locale],
        status: "reviewed",
        source: "import",
        actor
      },
      bus
    );
  }
}

console.log(
  `seeded ${Object.keys(STRINGS).length} keys (${created} new) across en/es/de in project "demo"`
);
console.log("sign in at http://localhost:5199 with admin@example.com / password1234");
await handle.close();
process.exit(0);
