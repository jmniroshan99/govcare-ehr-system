import { useLayoutEffect, useState, type RefObject } from "react";

const PREFERRED_MENU_HEIGHT_PX = 336;
const MAX_LIST_HEIGHT_PX = 256;
const MENU_CHROME_HEIGHT_PX = 68;
const MIN_LIST_HEIGHT_PX = 48;
const VIEWPORT_GAP_PX = 8;

/**
 * Keeps a dropdown inside the visible viewport. Selectors near the bottom of
 * long clinical forms open above their field, while selectors with enough
 * room retain the expected downward placement.
 */
export function useAdaptiveDropdownPlacement(open: boolean, anchorRef: RefObject<HTMLElement | null>) {
  const [menuPlacement, setMenuPlacement] = useState<"above" | "below">("below");
  const [menuListMaxHeight, setMenuListMaxHeight] = useState(MAX_LIST_HEIGHT_PX);

  useLayoutEffect(() => {
    if (!open) return;

    function updateMenuPlacement() {
      const bounds = anchorRef.current?.getBoundingClientRect();
      if (!bounds) return;

      const availableBelow = Math.max(0, window.innerHeight - bounds.bottom - VIEWPORT_GAP_PX);
      const availableAbove = Math.max(0, bounds.top - VIEWPORT_GAP_PX);
      const nextPlacement = availableBelow < PREFERRED_MENU_HEIGHT_PX && availableAbove > availableBelow ? "above" : "below";
      const availableMenuSpace = nextPlacement === "above" ? availableAbove : availableBelow;

      setMenuPlacement(nextPlacement);
      setMenuListMaxHeight(Math.max(
        MIN_LIST_HEIGHT_PX,
        Math.min(MAX_LIST_HEIGHT_PX, Math.floor(availableMenuSpace - MENU_CHROME_HEIGHT_PX)),
      ));
    }

    updateMenuPlacement();
    window.addEventListener("resize", updateMenuPlacement);
    window.addEventListener("scroll", updateMenuPlacement, true);
    return () => {
      window.removeEventListener("resize", updateMenuPlacement);
      window.removeEventListener("scroll", updateMenuPlacement, true);
    };
  }, [anchorRef, open]);

  return { menuPlacement, menuListMaxHeight } as const;
}
