import {
  SITE_STYLE_PALETTES,
  TypographySchema,
  hasPreservedAccentBorderWarning,
  validateAppearanceContrast,
  type Appearance,
  type Typography,
} from "@/lib/site-settings";
import type { VisualStyle } from "@/lib/generation";

const COLOR_FIELDS = [
  ["primary", "Primary color", "Main text and call-to-action fill"],
  ["background", "Background color", "Website background"],
  ["accent", "Accent color", "Decorative details and borders"],
] as const;

export function AppearanceEditor({ style, appearance, onChange }: {
  style: VisualStyle;
  appearance: Appearance;
  onChange: (appearance: Appearance) => void;
}) {
  const palette = SITE_STYLE_PALETTES[style];
  const contrast = validateAppearanceContrast(style, appearance);
  const showPresetAccentWarning = hasPreservedAccentBorderWarning(style, appearance);

  function setColor(key: keyof Appearance["colors"], color: string | null) {
    onChange({ ...appearance, colors: { ...appearance.colors, [key]: color } });
  }

  function setTypography(value: string) {
    const typography = TypographySchema.parse(value) as Typography;
    onChange({ ...appearance, typography });
  }

  return (
    <details className="copy-editor appearance-editor" open>
      <summary>Customize appearance <span>Updates the preview immediately</span></summary>
      <div className="appearance-color-grid">
        {COLOR_FIELDS.map(([key, label, description]) => {
          const value = appearance.colors[key] ?? palette[key];
          return <div className="appearance-color" key={key}>
            <label htmlFor={`appearance-${key}`}>{label}</label>
            <span>{description}</span>
            <div className="appearance-color-controls">
              <input id={`appearance-${key}`} type="color" value={value} onChange={(event) => setColor(key, event.target.value)} aria-label={label} />
              <code>{value.toUpperCase()}</code>
              <button type="button" onClick={() => setColor(key, null)} disabled={appearance.colors[key] === null}>Use style default</button>
            </div>
          </div>;
        })}
      </div>
      <div className="appearance-typography">
        <label htmlFor="appearance-typography">Typography</label>
        <select id="appearance-typography" value={appearance.typography} onChange={(event) => setTypography(event.target.value)}>
          <option value="preset">Style default</option>
          <option value="system-sans">System sans</option>
          <option value="editorial-serif">Editorial serif</option>
          <option value="humanist-sans">Humanist sans</option>
        </select>
      </div>
      <div className={`appearance-contrast ${contrast.valid ? "valid" : "invalid"}`} aria-live="polite">
        <strong>{contrast.valid ? "Text contrast meets the required levels." : "Improve contrast before saving or exporting."}</strong>
        <span>Normal text: {contrast.normalText.toFixed(2)}:1 (4.5:1 required) · CTA text: {contrast.ctaText.toFixed(2)}:1 (4.5:1 required)</span>
        {(appearance.colors.primary !== null || appearance.colors.accent !== null) && <span>Accent border: {contrast.accentControl.toFixed(2)}:1 (3:1 required when customized)</span>}
        {showPresetAccentWarning && <span>Style default accent border is {contrast.accentControl.toFixed(2)}:1. This existing preset is preserved; adjust the accent or primary color to meet 3:1.</span>}
        {contrast.issues.map((issue) => <span role="alert" key={issue}>{issue}</span>)}
      </div>
      <button className="appearance-reset-all" type="button" onClick={() => onChange({ colors: { primary: null, background: null, accent: null }, typography: "preset" })}>Reset all appearance to style defaults</button>
    </details>
  );
}
