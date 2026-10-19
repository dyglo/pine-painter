import { createElement, type CSSProperties, type ReactNode } from "react";
import type { SourceNodeData } from "./layout";
export function SourceNode({
  node,
  style,
  children,
  markup,
}: {
  node: SourceNodeData;
  style: CSSProperties;
  children?: ReactNode;
  markup?: string;
}) {
  const attrs = { ...node.attrs } as Record<string, string>;
  if (attrs["viewbox"]) {
    attrs["viewBox"] = attrs["viewbox"];
    delete attrs["viewbox"];
  }
  // SVG geometry/text from the user's local source, never remote/user input.
  return createElement(
    node.tag,
    {
      ...attrs,
      className: node.className,
      style,
      "data-source-node": node.key,
      ...(children !== undefined
        ? {}
        : { dangerouslySetInnerHTML: { __html: markup ?? node.html } }),
    },
    children,
  );
}
export function HitTarget({
  x,
  y,
  width,
  height,
  label,
  onClick,
  onContextMenu,
  disabled = false,
  pressed,
  children,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  onClick: () => void;
  onContextMenu?: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      className="a source-hit h"
      style={{ left: x, top: y, width, height }}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onContextMenu={
        onContextMenu
          ? (e) => {
              e.preventDefault();
              onContextMenu();
            }
          : undefined
      }
    >
      {children}
    </button>
  );
}
