const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const staticSource = fs.readFileSync(
  path.resolve(__dirname, "../src/components/forms/SearchableSelect.tsx"),
  "utf8",
);
const asyncSource = fs.readFileSync(
  path.resolve(__dirname, "../src/components/forms/AsyncSearchableSelect.tsx"),
  "utf8",
);
const placementSource = fs.readFileSync(
  path.resolve(__dirname, "../src/components/forms/useAdaptiveDropdownPlacement.ts"),
  "utf8",
);

test("searchable dropdown chooses the side with usable viewport space", () => {
  assert.match(placementSource, /availableBelow/);
  assert.match(placementSource, /availableAbove/);
  assert.match(placementSource, /availableBelow < PREFERRED_MENU_HEIGHT_PX/);
  assert.match(placementSource, /availableAbove > availableBelow/);
});

test("static and API-backed dropdowns both support above and below placement", () => {
  for (const source of [staticSource, asyncSource]) {
    assert.match(source, /useAdaptiveDropdownPlacement\(open, wrapperRef\)/);
    assert.match(source, /bottom-full mb-1/);
    assert.match(source, /top-full mt-1/);
    assert.match(source, /menuPlacement === "above"/);
  }
});

test("open dropdown recalculates on viewport movement and bounds its option list", () => {
  assert.match(placementSource, /addEventListener\("resize", updateMenuPlacement\)/);
  assert.match(placementSource, /addEventListener\("scroll", updateMenuPlacement, true\)/);
  assert.match(staticSource, /style=\{\{ maxHeight: menuListMaxHeight \}\}/);
  assert.match(asyncSource, /style=\{\{ maxHeight: menuListMaxHeight \}\}/);
});
