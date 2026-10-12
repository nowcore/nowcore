/**
 * Bans raw colour and easing values outside `libs/ui` (T-023).
 *
 * The brand is a system: a hex typed into an app is a colour the next drop's
 * accent cannot re-tint and the next palette change will miss. Tokens live in
 * `libs/ui`; everything else refers to them by name — `var(--paper)`,
 * `text-paper`, `--drop-accent`.
 *
 * What it catches, in any string or template literal:
 *   - hex colours            '#D7FF3E', 'bg-[#fff]'
 *   - functional colours     'rgb(0 0 0)', 'rgba(…)', 'hsl(…)', 'oklch(…)'
 *   - hand-written easings   'cubic-bezier(…)'
 *
 * What it deliberately does not: CSS files (ESLint does not read them — app
 * stylesheets only `@import` the token sheet), and font stacks, which are owned
 * by `next/font` in each app's root layout.
 */
const HEX = /(^|[^&\w])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
const FUNC = /\b(?:rgba?|hsla?|oklch|oklab)\(/;
const EASE = /\bcubic-bezier\(/;

function offending(text) {
  if (HEX.test(text)) return 'hex colour';
  if (FUNC.test(text)) return 'colour function';
  if (EASE.test(text)) return 'easing curve';
  return null;
}

export default {
  rules: {
    'no-raw-design-values': {
      meta: {
        type: 'problem',
        docs: { description: 'Design values come from libs/ui tokens.' },
        messages: {
          raw: 'Raw {{kind}} outside libs/ui. Use a token from @nowcore/ui instead (docs/10-design-system.md).',
        },
        schema: [],
      },
      create(context) {
        const check = (node, text) => {
          const kind = offending(text);
          if (kind) context.report({ node, messageId: 'raw', data: { kind } });
        };
        return {
          Literal(node) {
            if (typeof node.value === 'string') check(node, node.value);
          },
          TemplateElement(node) {
            check(node, node.value.raw);
          },
          JSXText(node) {
            // Visible copy like "#1 drop" must not trip the rule; only a
            // colour-shaped token on its own is suspicious, and JSX text that
            // is a bare colour is a bug anyway.
            if (/^\s*#[0-9a-fA-F]{3,8}\s*$/.test(node.value))
              check(node, node.value);
          },
        };
      },
    },
  },
};
