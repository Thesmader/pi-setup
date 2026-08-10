import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  Editor,
  Input,
  Key,
  matchesKey,
  visibleWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import { Type, type Static } from "typebox";
import {
  CUSTOM_ANSWER_LABEL,
  moveSelection,
  normalizeOptions,
} from "./helpers.ts";
import {
  ASK_USER_PARAMETER_DESCRIPTIONS,
  ASK_USER_PROMPT_GUIDELINES,
  ASK_USER_PROMPT_SNIPPET,
  ASK_USER_TOOL_DESCRIPTION,
} from "./prompt.ts";

const optionSchema = Type.Object({
  label: Type.String({
    description: ASK_USER_PARAMETER_DESCRIPTIONS.optionLabel,
  }),
  description: Type.Optional(
    Type.String({
      description: ASK_USER_PARAMETER_DESCRIPTIONS.optionDescription,
    }),
  ),
});

const parameters = Type.Object({
  question: Type.String({
    description: ASK_USER_PARAMETER_DESCRIPTIONS.question,
  }),
  options: Type.Array(optionSchema, { minItems: 1, maxItems: 8 }),
});

type AskUserParameters = Static<typeof parameters>;

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "ask_user",
    label: "Ask user",
    description: ASK_USER_TOOL_DESCRIPTION,
    promptSnippet: ASK_USER_PROMPT_SNIPPET,
    promptGuidelines: ASK_USER_PROMPT_GUIDELINES,
    parameters,
    prepareArguments(args) {
      if (!args || typeof args !== "object") return args as AskUserParameters;
      const input = args as AskUserParameters;
      if (!input.options?.some((option) => typeof option === "string"))
        return input;
      return {
        ...input,
        options: normalizeOptions(
          input.options as readonly (
            string | { label: string; description?: string }
          )[],
        ),
      };
    },

    async execute(_id, { question, options }, signal, _onUpdate, ctx) {
      const reply = (text: string) => ({
        content: [{ type: "text" as const, text }],
        details: {},
      });

      if (ctx.mode !== "tui") {
        return reply(
          "No interactive UI is available; ask the user in plain text instead.",
        );
      }

      if (signal?.aborted) return reply("Cancelled");

      const choices = [...options, { label: CUSTOM_ANSWER_LABEL }];

      const answer = await ctx.ui.custom<string | null>(
        (tui, theme, _keybindings, done) => {
          let selected = 0;
          let mode: "options" | "input" | "editor" = "options";
          let cachedLines: string[] | undefined;
          let settled = false;
          let focused = false;

          const input = new Input();
          const editor = new Editor(tui, {
            borderColor: (text) => theme.fg("accent", text),
            selectList: {
              selectedPrefix: (text) => theme.fg("accent", text),
              selectedText: (text) => theme.fg("accent", text),
              description: (text) => theme.fg("muted", text),
              scrollInfo: (text) => theme.fg("dim", text),
              noMatch: (text) => theme.fg("warning", text),
            },
          });

          const syncFocus = () => {
            input.focused = focused && mode === "input";
            editor.focused = focused && mode === "editor";
          };

          const refresh = () => {
            cachedLines = undefined;
            input.invalidate();
            editor.invalidate();
            tui.requestRender();
          };

          const finish = (value: string | null) => {
            if (settled) return;
            settled = true;
            signal?.removeEventListener("abort", cancel);
            done(value);
          };

          const cancel = () => finish(null);

          signal?.addEventListener("abort", cancel, { once: true });
          if (signal?.aborted) queueMicrotask(cancel);

          input.onSubmit = (value) => {
            const trimmed = value.trim();
            if (trimmed) finish(trimmed);
          };
          input.onEscape = () => {
            mode = "options";
            syncFocus();
            refresh();
          };

          editor.onSubmit = (value) => {
            const trimmed = value.trim();
            if (trimmed) finish(trimmed);
          };

          const openInput = () => {
            mode = "input";
            syncFocus();
            refresh();
          };

          const openEditor = () => {
            editor.setText(input.getValue());
            mode = "editor";
            syncFocus();
            refresh();
          };

          const choose = (index: number) => {
            selected = index;
            if (index === options.length) {
              openInput();
              return;
            }
            finish(options[index].label);
          };

          const addWrapped = (
            lines: string[],
            prefix: string,
            text: string,
          ) => {
            const prefixWidth = visibleWidth(prefix);
            const wrapped = wrapTextWithAnsi(
              text,
              Math.max(1, renderWidth - prefixWidth),
            );
            for (let i = 0; i < wrapped.length; i++) {
              lines.push(
                `${i === 0 ? prefix : " ".repeat(prefixWidth)}${wrapped[i]}`,
              );
            }
          };

          let renderWidth = 1;

          return {
            get focused() {
              return focused;
            },
            set focused(value: boolean) {
              focused = value;
              syncFocus();
            },
            handleInput(data: string) {
              if (mode === "editor") {
                if (matchesKey(data, Key.escape)) {
                  input.setValue(editor.getText());
                  mode = "input";
                  syncFocus();
                  refresh();
                  return;
                }
                editor.handleInput(data);
                refresh();
                return;
              }

              if (mode === "input") {
                if (matchesKey(data, Key.ctrl("g"))) {
                  openEditor();
                  return;
                }
                input.handleInput(data);
                refresh();
                return;
              }

              if (
                matchesKey(data, Key.up) ||
                matchesKey(data, Key.ctrl("p")) ||
                data === "k"
              ) {
                selected = moveSelection(selected, -1, choices.length);
                refresh();
                return;
              }
              if (
                matchesKey(data, Key.down) ||
                matchesKey(data, Key.ctrl("n")) ||
                data === "j"
              ) {
                selected = moveSelection(selected, 1, choices.length);
                refresh();
                return;
              }
              if (data.length === 1 && data >= "1" && data <= "9") {
                const index = Number(data) - 1;
                if (index < choices.length) choose(index);
                return;
              }
              if (matchesKey(data, Key.enter)) {
                choose(selected);
                return;
              }
              if (matchesKey(data, Key.escape)) {
                finish(null);
              }
            },
            render(width: number) {
              if (cachedLines) return cachedLines;
              renderWidth = Math.max(1, width);
              const lines: string[] = [];

              lines.push(theme.fg("accent", "─".repeat(renderWidth)));
              addWrapped(lines, " ", theme.fg("text", question));
              lines.push("");

              choices.forEach((choice, index) => {
                const prefix =
                  index === selected ? theme.fg("accent", "> ") : "  ";
                if (index === options.length && mode === "input") {
                  const label = `${index + 1}. ${CUSTOM_ANSWER_LABEL}: `;
                  const inputWidth = Math.max(
                    1,
                    renderWidth - visibleWidth(prefix) - label.length,
                  );
                  const inputLine =
                    input.render(inputWidth + 2)[0]?.slice(2) ?? "";
                  lines.push(
                    prefix +
                      theme.fg(index === selected ? "accent" : "text", label) +
                      inputLine,
                  );
                } else {
                  const label =
                    index === options.length
                      ? `${CUSTOM_ANSWER_LABEL}: ${input.getValue()}`
                      : choice.label;
                  addWrapped(
                    lines,
                    prefix,
                    theme.fg(
                      index === selected ? "accent" : "text",
                      `${index + 1}. ${label}`,
                    ),
                  );
                }
                if (choice.description)
                  addWrapped(
                    lines,
                    "     ",
                    theme.fg("muted", choice.description),
                  );
              });

              if (mode === "editor") {
                lines.push("");
                addWrapped(lines, " ", theme.fg("muted", "Your answer:"));
                for (const line of editor.render(
                  Math.max(1, renderWidth - 1),
                )) {
                  lines.push(` ${line}`);
                }
              }

              lines.push("");
              addWrapped(
                lines,
                " ",
                theme.fg(
                  "dim",
                  mode === "editor"
                    ? "Enter submit • Esc back to input • Ctrl+G keep text in input"
                    : mode === "input"
                      ? "Enter submit • Esc back to options • Ctrl+G open multiline editor"
                      : `Enter select • Esc cancel • 1-${Math.min(9, choices.length)} jump`,
                ),
              );
              lines.push(theme.fg("accent", "─".repeat(renderWidth)));

              return (cachedLines = lines);
            },
            invalidate() {
              cachedLines = undefined;
              input.invalidate();
              editor.invalidate();
            },
            dispose() {
              signal?.removeEventListener("abort", cancel);
            },
          };
        },
      );

      return answer === null
        ? reply("User cancelled the question.")
        : reply(`User answered: ${answer}`);
    },
  });
}
