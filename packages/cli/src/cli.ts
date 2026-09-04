#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { Command } from "commander";
import { codecs, getCodec, guessFormat, isFormatId } from "@openlocale/formats";
import { CONFIG_FILE, loadConfig } from "./config.js";
import * as api from "./api.js";
import pkg from "../package.json";

const program = new Command("openlocale")
  .description("Push and pull translation files to/from an openlocale server")
  .version(pkg.version);

const globalOpts = (cmd: Command) =>
  cmd
    .option("--endpoint <url>", "openlocale server URL")
    .option("--project <slug>", "project slug")
    .option("--token <token>", "API token (or OPENLOCALE_TOKEN env)");

program
  .command("init")
  .description(`write ${CONFIG_FILE} in the current directory`)
  .requiredOption("--endpoint <url>", "openlocale server URL")
  .requiredOption("--project <slug>", "project slug")
  .option("--token <token>", "API token (or OPENLOCALE_TOKEN env)")
  .action(async (opts: { endpoint: string; project: string; token?: string }) => {
  const config = {
    endpoint: opts.endpoint.replace(/\/$/, ""),
    project: opts.project,
    ...(opts.token ? { token: opts.token } : {})
  };
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n");
  console.log(`wrote ${CONFIG_FILE}`);
  if (!opts.token) {
    console.log("tip: set OPENLOCALE_TOKEN in your environment instead of storing it in the file");
  }
});

globalOpts(
  program
    .command("pull")
    .description("download translation files")
    .option("--locale <locale>", "locale to pull, or 'all'", "all")
    .option("--format <format>", "file format", "json-nested")
    .option("--namespace <ns>", "namespace", "default")
    .option("--out <dir>", "output directory", "./locales")
).action(
  async (opts: {
    endpoint?: string;
    project?: string;
    token?: string;
    locale: string;
    format: string;
    namespace: string;
    out: string;
  }) => {
    const config = await loadConfig(opts);
    if (!isFormatId(opts.format)) {
      throw new Error(`unknown format "${opts.format}" (${codecs.map((c) => c.id).join(", ")})`);
    }
    const locales = opts.locale === "all" ? await api.listLocales(config) : [opts.locale];
    await mkdir(resolve(opts.out), { recursive: true });
    const ext = getCodec(opts.format).extensions[0]!;
    for (const locale of locales) {
      const content = await api.exportLocale(config, locale, opts.format, opts.namespace);
      const file = join(opts.out, `${locale}${ext}`);
      await writeFile(file, content);
      console.log(`pulled ${file}`);
    }
  }
);

globalOpts(
  program
    .command("push <file>")
    .description("upload a translation file (analyze + commit)")
    .requiredOption("--locale <locale>", "locale the file contains")
    .option("--format <format>", "file format (guessed from filename if omitted)")
    .option("--namespace <ns>", "namespace", "default")
    .option("--dry-run", "analyze only; print the report and exit non-zero if duplicates found")
).action(
  async (
    file: string,
    opts: {
      endpoint?: string;
      project?: string;
      token?: string;
      locale: string;
      format?: string;
      namespace: string;
      dryRun?: boolean;
    }
  ) => {
    const config = await loadConfig(opts);
    const format = opts.format ?? guessFormat(file);
    if (!format || !isFormatId(format)) {
      throw new Error(`cannot determine format for ${file}; pass --format`);
    }
    const content = await readFile(resolve(file), "utf8");
    const job = await api.importFile(config, {
      content,
      filename: basename(file),
      format,
      locale: opts.locale,
      namespace: opts.namespace
    });

    const { stats } = job;
    console.log(
      `analyzed ${stats.total} entries: ${stats.create} new, ${stats.update} changed, ${stats.unchanged} unchanged`
    );
    for (const warning of job.warnings ?? []) console.warn(`warning: ${warning}`);

    const suggestions = await api.getSuggestions(config, job.id);
    if (suggestions.length > 0) {
      console.log(`\n${suggestions.length} possible duplicate(s):`);
      for (const s of suggestions as {
        incomingKey: string;
        incomingValue: string;
        matchType: string;
        score: number;
      }[]) {
        console.log(`  ${s.incomingKey} (${s.matchType} ${s.score}%): "${s.incomingValue}"`);
      }
      console.log("review them in the web UI before committing, or push without --dry-run to create anyway");
    }

    if (opts.dryRun) {
      if (suggestions.length > 0) process.exit(2);
      console.log("dry run: nothing committed");
      return;
    }

    const result = await api.commitJob(config, job.id);
    console.log(
      `committed: ${result.stats.created ?? 0} created, ${result.stats.updated ?? 0} updated, ${result.stats.skipped ?? 0} skipped`
    );
  }
);

program.parseAsync().catch((err: Error) => {
  console.error(`error: ${err.message}`);
  process.exit(1);
});
