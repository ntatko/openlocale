import { z } from "zod";

export const OrgRole = z.enum(["owner", "admin", "member"]);
export type OrgRole = z.infer<typeof OrgRole>;

export const ProjectRole = z.enum(["manager", "translator", "viewer"]);
export type ProjectRole = z.infer<typeof ProjectRole>;

export const TranslationStatus = z.enum(["draft", "reviewed"]);
export type TranslationStatus = z.infer<typeof TranslationStatus>;

export const WriteSource = z.enum(["ui", "api", "import", "ai"]);
export type WriteSource = z.infer<typeof WriteSource>;

export const slugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, {
    message: "lowercase letters, digits and hyphens only"
  });

// Loose BCP-47: language, optional script, optional region (e.g. en, pt-BR, zh-Hans-CN)
export const localeSchema = z
  .string()
  .regex(/^[a-zA-Z]{2,3}(-[A-Za-z]{4})?(-[A-Za-z]{2}|-\d{3})?$/, {
    message: "must be a BCP-47 locale like en, pt-BR or zh-Hans"
  })
  .transform((v) => {
    const [lang, ...rest] = v.split("-");
    return [
      lang!.toLowerCase(),
      ...rest.map((p) =>
        p.length === 4
          ? p[0]!.toUpperCase() + p.slice(1).toLowerCase()
          : p.toUpperCase()
      )
    ].join("-");
  });

export const orgCreateSchema = z.object({
  name: z.string().min(1).max(120),
  slug: slugSchema
});
export type OrgCreate = z.infer<typeof orgCreateSchema>;

export const projectCreateSchema = z.object({
  name: z.string().min(1).max(120),
  slug: slugSchema,
  sourceLocale: localeSchema.default("en"),
  public: z.boolean().default(false)
});
export type ProjectCreate = z.infer<typeof projectCreateSchema>;

export const projectUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  sourceLocale: localeSchema.optional(),
  public: z.boolean().optional()
});
export type ProjectUpdate = z.infer<typeof projectUpdateSchema>;

export const keyCreateSchema = z.object({
  namespace: slugSchema.default("default"),
  name: z.string().min(1).max(512),
  context: z.string().max(2000).optional()
});
export type KeyCreate = z.infer<typeof keyCreateSchema>;

export const translationUpsertSchema = z.object({
  value: z.string().max(65536),
  status: TranslationStatus.default("draft")
});
export type TranslationUpsert = z.infer<typeof translationUpsertSchema>;

export const TokenScope = z.enum(["read", "write", "admin"]);
export type TokenScope = z.infer<typeof TokenScope>;

export const LicenseFeature = z.enum(["ai"]);
export type LicenseFeature = z.infer<typeof LicenseFeature>;

export const licensePayloadSchema = z.object({
  v: z.literal(1),
  id: z.string(),
  org: z.string(),
  email: z.string(),
  plan: z.string(),
  features: z.array(LicenseFeature),
  seats: z.number().int().positive().optional(),
  iat: z.number().int(),
  exp: z.number().int()
});
export type LicensePayload = z.infer<typeof licensePayloadSchema>;
