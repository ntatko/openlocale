import { describe, expect, it } from "vitest";
import { getCodec, guessFormat, parseIcuPlural } from "../src/index.js";

describe("json-nested", () => {
  it("flattens nested objects to dot keys", () => {
    const { entries } = getCodec("json-nested").parse(
      JSON.stringify({ checkout: { title: "Checkout", cta: { buy: "Buy" } } })
    );
    expect(entries).toEqual([
      { key: "checkout.title", value: "Checkout" },
      { key: "checkout.cta.buy", value: "Buy" }
    ]);
  });

  it("re-nests on serialize", () => {
    const out = getCodec("json-nested").serialize([
      { key: "a.b", value: "1" },
      { key: "a.c", value: "2" }
    ]);
    expect(JSON.parse(out)).toEqual({ a: { b: "1", c: "2" } });
  });
});

describe("yaml", () => {
  it("parses rails-style nested yaml", () => {
    const { entries } = getCodec("yaml").parse("checkout:\n  title: Kasse\n  buy: Jetzt kaufen\n");
    expect(entries).toContainEqual({ key: "checkout.title", value: "Kasse" });
  });
});

describe("po", () => {
  it("parses a real PO file and warns on plurals", () => {
    const input = `msgid ""
msgstr ""
"Content-Type: text/plain; charset=utf-8\\n"
"Language: de\\n"

#. Button label
msgid "cta.buy"
msgstr "Jetzt kaufen"

msgid "cart.items"
msgid_plural "cart.items.plural"
msgstr[0] "Ein Artikel"
msgstr[1] "%d Artikel"
`;
    const { entries, warnings } = getCodec("po").parse(input);
    expect(entries).toContainEqual({
      key: "cta.buy",
      value: "Jetzt kaufen",
      context: "Button label"
    });
    expect(warnings.some((w) => w.includes("plural"))).toBe(true);
  });
});

describe("xliff12", () => {
  it("parses trans-units and falls back to source without target", () => {
    const input = `<?xml version="1.0"?>
<xliff version="1.2"><file source-language="en" target-language="de"><body>
  <trans-unit id="a"><source>Hello</source><target>Hallo</target></trans-unit>
  <trans-unit id="b"><source>Untranslated</source></trans-unit>
</body></file></xliff>`;
    const { entries, warnings } = getCodec("xliff12").parse(input);
    expect(entries).toContainEqual({ key: "a", value: "Hallo" });
    expect(entries).toContainEqual({ key: "b", value: "Untranslated" });
    expect(warnings.some((w) => w.includes('"b"'))).toBe(true);
  });
});

describe("apple-strings", () => {
  it("parses comments, escapes and semicolons", () => {
    const input = `/* Login screen title */
"login.title" = "Anmelden";

// inline comment
"login.hint" = "Sag \\"hallo\\"\\nZeile 2";`;
    const { entries } = getCodec("apple-strings").parse(input);
    expect(entries[0]).toEqual({
      key: "login.title",
      value: "Anmelden",
      context: "Login screen title"
    });
    expect(entries[1]!.value).toBe('Sag "hallo"\nZeile 2');
  });
});

describe("properties", () => {
  it("handles separators, unicode escapes and continuations", () => {
    const input = `# greeting message
welcome=Willkommen
title: Der Titel
unicode=Gr\\u00fc\\u00dfe
multi=line one \\
    line two`;
    const { entries } = getCodec("properties").parse(input);
    const byKey = Object.fromEntries(entries.map((e) => [e.key, e.value]));
    expect(byKey["welcome"]).toBe("Willkommen");
    expect(byKey["title"]).toBe("Der Titel");
    expect(byKey["unicode"]).toBe("Grüße");
    expect(byKey["multi"]).toBe("line one line two");
    expect(entries[0]!.context).toBe("greeting message");
  });
});

describe("android-xml", () => {
  it("maps plurals to ICU and back", () => {
    const input = `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="app_name">Meine App</string>
  <plurals name="cart_items">
    <item quantity="one">%d Artikel</item>
    <item quantity="other">%d Artikel</item>
  </plurals>
</resources>`;
    const codec = getCodec("android-xml");
    const { entries } = codec.parse(input);
    const plural = entries.find((e) => e.key === "cart_items")!;
    expect(parseIcuPlural(plural.value)).toEqual({
      variable: "count",
      forms: { one: "# Artikel", other: "# Artikel" }
    });

    const out = codec.serialize(entries);
    expect(out).toContain('<plurals name="cart_items">');
    expect(out).toContain('<item quantity="one">%d Artikel</item>');
    expect(out).toContain('<string name="app_name">Meine App</string>');
  });

  it("escapes android-special characters", () => {
    const out = getCodec("android-xml").serialize([{ key: "a", value: "it's <b> & @home" }]);
    expect(out).toContain("it\\'s &lt;b&gt; &amp; @home");
  });
});

describe("arb", () => {
  it("parses metadata descriptions as context", () => {
    const input = JSON.stringify({
      "@@locale": "de",
      pageTitle: "Startseite",
      "@pageTitle": { description: "Browser tab title" }
    });
    const { entries } = getCodec("arb").parse(input);
    expect(entries).toEqual([
      { key: "pageTitle", value: "Startseite", context: "Browser tab title" }
    ]);
  });
});

describe("guessFormat", () => {
  it("guesses from filenames", () => {
    expect(guessFormat("de.json")).toBe("json-nested");
    expect(guessFormat("Localizable.strings")).toBe("apple-strings");
    expect(guessFormat("strings.xml")).toBe("android-xml");
    expect(guessFormat("app_de.arb")).toBe("arb");
    expect(guessFormat("messages.po")).toBe("po");
    expect(guessFormat("translations.xlf")).toBe("xliff12");
    expect(guessFormat("readme.txt")).toBeNull();
  });
});
