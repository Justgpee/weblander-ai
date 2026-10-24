import { useState } from "react";
import {
  SITE_STYLE_PALETTES,
  TypographySchema,
  hasPreservedAccentBorderWarning,
  validateAppearanceContrast,
  type Appearance,
  type Typography,
} from "@/lib/site-settings";
import type { VisualStyle } from "@/lib/generation";
import { appearanceColorControlKey, clearHexColorOverride, HEX_COLOR_DRAFT_ERROR_MESSAGE, selectHexColor, shouldShowHexColorDraftError, updateHexColorDraft } from "@/lib/appearance-color-draft";

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
  const [draftResetRevision, setDraftResetRevision] = useState(0);
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
          return <AppearanceColorControl
            key={appearanceColorControlKey(key, draftResetRevision)}
            colorKey={key}
            label={label}
            description={description}
            value={value}
            override={appearance.colors[key]}
            onPickerChange={(color) => setColor(key, color)}
            onHexChange={(color) => setColor(key, color)}
            onClear={() => setColor(key, null)}
          />;
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
      <button className="appearance-reset-all" type="button" onClick={() => {
        setDraftResetRevision((revision) => revision + 1);
        onChange({ colors: { primary: null, background: null, accent: null }, typography: "preset" });
      }}>Reset all appearance to style defaults</button>
    </details>
  );
}

function AppearanceColorControl({ colorKey, label, description, value, override, onPickerChange, onHexChange, onClear }: {
  colorKey: keyof Appearance["colors"];
  label: string;
  description: string;
  value: string;
  override: string | null;
  onPickerChange: (color: string) => void;
  onHexChange: (color: string) => void;
  onClear: () => void;
}) {
  const [invalidDraft, setInvalidDraft] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const draft = invalidDraft ?? value.toUpperCase();
  const showError = invalidDraft !== null && shouldShowHexColorDraftError(invalidDraft, touched);
  const error = showError ? HEX_COLOR_DRAFT_ERROR_MESSAGE : "";
  const hexInputId = `appearance-${colorKey}-hex`;
  const helpId = `appearance-${colorKey}-hex-help`;
  const errorId = `appearance-${colorKey}-hex-error`;

  return <div className="appearance-color" key={colorKey}>
    <label htmlFor={`appearance-${colorKey}`}>{label}</label>
    <span>{description}</span>
    <div className="appearance-color-controls">
      <input
        id={`appearance-${colorKey}`}
        type="color"
        value={value.toLowerCase()}
        onChange={(event) => {
          const result = selectHexColor(event.target.value);
          setInvalidDraft(null);
          setTouched(false);
          onPickerChange(result.committedColor!);
        }}
        aria-label={`${label} color picker`}
      />
      <label className="sr-only" htmlFor={hexInputId}>{label} HEX code</label>
      <input
        id={hexInputId}
        className="appearance-hex-input"
        type="text"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        maxLength={7}
        value={draft}
        placeholder="#456B52"
        onBlur={() => {
          if (invalidDraft !== null) setTouched(true);
        }}
        onChange={(event) => {
          const result = updateHexColorDraft(override, event.target.value);
          if (result.valid && result.committedColor) {
            setInvalidDraft(null);
            setTouched(false);
            onHexChange(result.committedColor);
          } else {
            setInvalidDraft(result.draft);
            if (result.draft.length >= 7) setTouched(true);
          }
        }}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${helpId} ${errorId}` : helpId}
      />
      <code aria-hidden="true">{value.toUpperCase()}</code>
      <button type="button" onClick={() => {
        clearHexColorOverride(value);
        setInvalidDraft(null);
        setTouched(false);
        onClear();
      }} disabled={override === null}>Use style default</button>
    </div>
    <span id={helpId} className="site-settings-help">Type a six-digit HEX code or use the color picker.</span>
    {error && <span id={errorId} className="site-settings-error" role="alert">{error}</span>}
  </div>;
}
