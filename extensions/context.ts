import {
  estimateTokens,
  sessionEntryToContextMessages,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { Box, Text } from "@earendil-works/pi-tui";

interface Category {
  name: string;
  tokens: number;
}

interface ContextWindowData {
  model: string;
  used: number;
  contextWindow: number;
  categories: Category[];
  contextFiles: Category[];
  tools: Category[];
}

const textTokens = (text: string) => Math.ceil(text.length / 4);
const formatTokens = (tokens: number) =>
  tokens >= 1000
    ? `${(tokens / 1000).toFixed(tokens >= 10000 ? 0 : 1)}k`
    : `${tokens}`;

export default function (pi: ExtensionAPI) {
  pi.registerEntryRenderer<ContextWindowData>(
    "context",
    (entry, { expanded }, theme) => {
      const data = entry.data;
      if (!data) return new Text("Context data unavailable", 0, 0);

      const percent = data.contextWindow
        ? (data.used / data.contextWindow) * 100
        : 0;
      const toolTotal =
        data.tools?.reduce((sum, tool) => sum + tool.tokens, 0) ?? 0;
      const barWidth = 28;
      const filled = Math.min(barWidth, Math.round((percent / 100) * barWidth));
      const lines = [
        `${theme.bold("Context window")}  ${theme.fg("muted", data.model)}`,
        `${theme.fg("accent", "█".repeat(filled))}${theme.fg("dim", "░".repeat(barWidth - filled))}  ${percent.toFixed(1)}%`,
        `${theme.bold(formatTokens(data.used))} used  ·  ${formatTokens(Math.max(0, data.contextWindow - data.used))} free  ·  ${formatTokens(data.contextWindow)} total`,
        "",
        ...data.categories.map((category) => {
          const share = data.used ? (category.tokens / data.used) * 100 : 0;
          const width = Math.min(12, Math.round(share / 5));
          return `${category.name.padEnd(22)} ${formatTokens(category.tokens).padStart(6)}  ${share.toFixed(1).padStart(5)}%  ${theme.fg("accent", "▰".repeat(width))}`;
        }),
        "",
        theme.fg(
          "dim",
          "Approximate allocation; total uses provider-reported usage.",
        ),
      ];

      if (expanded) {
        if (data.tools?.length) {
          lines.push("", theme.bold("Tool definitions"));
          for (const tool of data.tools) {
            const share = toolTotal ? (tool.tokens / toolTotal) * 100 : 0;
            lines.push(
              `${theme.fg("muted", tool.name.padEnd(24))} ~${formatTokens(tool.tokens).padStart(6)}  ${share.toFixed(1).padStart(5)}%`,
            );
          }
        }
        if (data.contextFiles.length) {
          lines.push("", theme.bold("Context files"));
          for (const file of data.contextFiles) {
            lines.push(
              `${theme.fg("muted", file.name)}  ~${formatTokens(file.tokens)}`,
            );
          }
        }
      }

      const box = new Box(1, 1, (text) => theme.bg("customMessageBg", text));
      box.addChild(new Text(lines.join("\n"), 0, 0));
      return box;
    },
  );

  pi.registerCommand("context", {
    description: "Show what occupies the current context window",
    handler: async (_args, ctx) => {
      if (!ctx.model) {
        ctx.ui.notify("No active model", "warning");
        return;
      }

      const options = ctx.getSystemPromptOptions();
      const contextFiles = (options.contextFiles ?? [])
        .map((file) => ({ name: file.path, tokens: textTokens(file.content) }))
        .sort((a, b) => b.tokens - a.tokens);
      const contextFileTokens = contextFiles.reduce(
        (sum, file) => sum + file.tokens,
        0,
      );
      const skillTokens = textTokens(
        (options.skills ?? [])
          .filter((skill) => !skill.disableModelInvocation)
          .map(
            (skill) => `${skill.name}\n${skill.description}\n${skill.filePath}`,
          )
          .join("\n"),
      );
      const systemTokens = textTokens(ctx.getSystemPrompt());
      const tools = pi
        .getAllTools()
        .filter((tool) => pi.getActiveTools().includes(tool.name))
        .map(({ name, description, parameters }) => ({
          name,
          tokens: textTokens(JSON.stringify({ name, description, parameters })),
        }))
        .sort((a, b) => b.tokens - a.tokens);
      const toolTokens = tools.reduce((sum, tool) => sum + tool.tokens, 0);

      const roleTokens = new Map<string, number>();
      for (const entry of ctx.sessionManager.buildContextEntries()) {
        for (const message of sessionEntryToContextMessages(entry)) {
          const name =
            message.role === "user"
              ? "User messages"
              : message.role === "assistant"
                ? "Assistant messages"
                : message.role === "toolResult"
                  ? "Tool results"
                  : message.role === "compactionSummary" ||
                      message.role === "branchSummary"
                    ? "Summaries"
                    : "Other messages";
          roleTokens.set(
            name,
            (roleTokens.get(name) ?? 0) + estimateTokens(message),
          );
        }
      }

      const rawCategories: Category[] = [
        {
          name: "Core instructions",
          tokens: Math.max(0, systemTokens - contextFileTokens - skillTokens),
        },
        { name: "AGENTS/context files", tokens: contextFileTokens },
        { name: "Skill manifest", tokens: skillTokens },
        { name: "Tool definitions", tokens: toolTokens },
        ...Array.from(roleTokens, ([name, tokens]) => ({ name, tokens })),
      ].filter((category) => category.tokens > 0);

      const rawTotal = rawCategories.reduce(
        (sum, category) => sum + category.tokens,
        0,
      );
      const usage = ctx.getContextUsage();
      const used = usage?.tokens && usage.tokens > 0 ? usage.tokens : rawTotal;
      const scale = rawTotal && used ? used / rawTotal : 1;
      const categories = rawCategories
        .map((category) => ({
          ...category,
          tokens: Math.round(category.tokens * scale),
        }))
        .sort((a, b) => b.tokens - a.tokens);

      pi.appendEntry<ContextWindowData>("context", {
        model: `${ctx.model.provider}/${ctx.model.id}`,
        used,
        contextWindow: usage?.contextWindow ?? ctx.model.contextWindow,
        categories,
        contextFiles,
        tools,
      });
    },
  });
}
