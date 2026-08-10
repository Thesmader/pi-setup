import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Provider } from "@earendil-works/pi-ai";
import { builtinProviders } from "@earendil-works/pi-ai/providers/all";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const accountsPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "openai-codex-accounts.json",
);

function loadAccounts() {
  if (!existsSync(accountsPath)) return [];

  const accounts: unknown = JSON.parse(readFileSync(accountsPath, "utf8"));
  if (!Array.isArray(accounts))
    throw new Error(`${accountsPath} must contain an array`);

  return accounts.map((account, index) => {
    if (
      typeof account !== "object" ||
      account === null ||
      !("id" in account) ||
      typeof account.id !== "string" ||
      !("label" in account) ||
      typeof account.label !== "string"
    ) {
      throw new Error(
        `${accountsPath} account ${index + 1} must have string id and label fields`,
      );
    }
    return { id: account.id, label: account.label };
  });
}

function createAccountProvider(id: string, label: string): Provider {
  const base = builtinProviders().find(
    (provider) => provider.id === "openai-codex",
  );
  if (!base) throw new Error("Built-in OpenAI Codex provider unavailable");

  return {
    ...base,
    id,
    name: `OpenAI Codex (${label})`,
    auth: {
      ...base.auth,
      oauth: base.auth.oauth
        ? {
            ...base.auth.oauth,
            name: `OpenAI ChatGPT Plus/Pro (${label})`,
          }
        : undefined,
    },
    getModels: () =>
      base.getModels().map((model) => ({
        ...model,
        provider: id,
        name: `${model.name} (${label})`,
      })),
  };
}

export default function (pi: ExtensionAPI) {
  for (const account of loadAccounts()) {
    pi.registerProvider(createAccountProvider(account.id, account.label));
  }
}
