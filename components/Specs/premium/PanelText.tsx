import * as React from "react";
import type { ViroSpecsTextRole } from "../core/manifest";
import { ViroText } from "../../ViroText";
import type { PremiumBaseProps } from "./PremiumBaseProps";
import { premiumFontSize, premiumTokens } from "./premiumTokens";

/** Props of {@linkcode PanelText}. */
export interface PanelTextProps extends PremiumBaseProps {
  readonly text: string;
  /** Type role. @default "body" */
  readonly role?: ViroSpecsTextRole;
  /** `muted` uses `color.textMuted`. @default "default" */
  readonly tone?: "default" | "muted";
  /** @default 4 for body, 2 for title and label */
  readonly maxLines?: number;
  /** Text box width in meters. Give width and height together. */
  readonly width?: number;
  readonly height?: number;
  /** A registered animation. Keep it at or under 500 ms, EaseInEaseOut (`VS3019`, `VS3020`). */
  readonly animation?: React.ComponentProps<typeof ViroText>["animation"];
}

/**
 * Text sized by role from angular type tokens. The compilers set `fontSize`
 * from the node's real distance so it is never below 1.2 degrees, and the Lens
 * host clamps again at runtime (`VS5016`).
 */
export function PanelText({ text, role = "body", tone = "default", maxLines, width, height, animation, label, viroTag, ...transform }: PanelTextProps): React.ReactElement {
  return (
    <ViroText
      viroTag={viroTag}
      accessibilityLabel={label}
      text={text}
      maxLines={maxLines ?? (role === "body" ? 4 : 2)}
      {...(width !== undefined ? { width } : {})}
      {...(height !== undefined ? { height } : {})}
      {...(animation !== undefined ? { animation } : {})}
      style={{
        fontSize: premiumFontSize(role),
        fontWeight: role === "title" ? "600" : role === "label" ? "500" : "400",
        color: tone === "muted" ? premiumTokens.color.textMuted : premiumTokens.color.text,
      }}
      {...transform}
    />
  );
}
