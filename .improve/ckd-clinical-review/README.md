# 12ui improve kit

Input: image `C:\Users\JM PC\Desktop\GovCare_EHR_Modern_Clinical_Intelligence\verification\clinical-feature-v49\screenshots\clinical-features-1366.png`
Picked candidate: not yet picked — nothing has been converted

## Status

- capture: settled
- draft: INCOMPLETE
- pick: INCOMPLETE
- convert: INCOMPLETE
- plan: INCOMPLETE
- Target: none
- Kit: git-ignored via .gitignore.

This kit is INCOMPLETE: no LayerDoc, no assets, no target HTML, no plan.

Recovery, in order — the first resumes and replays every settled stage:

    12ui improve 'C:\Users\JM PC\Desktop\GovCare_EHR_Modern_Clinical_Intelligence\verification\clinical-feature-v49\screenshots\clinical-features-1366.png' --out-dir 'C:\Users\JM PC\Desktop\GovCare_EHR_Modern_Clinical_Intelligence\.improve\ckd-clinical-review' --from convert  # resumes; settled stages replay
    12ui convert 'C:\Users\JM PC\Desktop\GovCare_EHR_Modern_Clinical_Intelligence\.improve\ckd-clinical-review\source.png' --output html  # buys one conversion

Once the LayerDoc exists, carry its raster layers as real assets — copy the files and reference them. Do not approximate the design's layout or text in CSS from the PNG while a stage is incomplete; resume or convert first.

## Start here

Run the recovery above first: steps 2 to 4 need a target this kit does not have yet.

Bounds are % of the capture frame (1366×3726); `winner.png` is the design at its own size; place by percentage, not by pixel.

1. Open `source.png`. It is the design.
2. Copy the files the assets table below marks ship into the repository; the rest are references and alternates.
3. Apply `plan/token-patch.css` once, at the token layer, not per element.
4. Work `plan/plan-annotated.md` in its own order: raster layers, then matched changes, then added elements.
5. Before committing, screenshot the page and put it beside `source.png`.

## Assets: what each file is

- clean plate (`clean-N`): the backdrop with the foreground artwork removed. Use it as the background layer, at full strength.
- cutout (`cutout-N`): the foreground artwork as an alpha PNG. This is the imagery. Copy it into the repo and place it at its bounds; never redraw it in CSS.
- upscaled plate (`upscaled-plate-N`): a higher-resolution copy of a plate for crisp rendering; pick one resolution, do not ship both.
- upscaled region (`upscaled-region-N`): a higher-resolution copy of a region for crisp rendering; pick one resolution, do not ship both.
- source crop (`crop-N`): the layer cropped straight out of the source image. Prefer that layer's cutout when one exists.
- `source.png`: the whole design; the reference for every visual decision.
- Icons (`plan/assets/added-*.svg`): reference `<name>.svg` — it carries the design's declared colour and is safe as an `<img>`, `background-image`, or `url()`; its `<name>-inline.svg` sibling paints with `currentColor` and is for inlining in the markup or masking with a token colour.

This kit has no extracted assets yet. Resume before coding.

### Never discard

- `source.png`.
- Every cutout and plate the kit extracts once the run completes.
- All real content, data, controls, routes, and tests.

Scrims over a plate stay light (at most 35% opacity), and the plan must say why one is used.

## Guardrails

- Preserve all real content, data, and controls. Do not fabricate product features or copy.
- Do not describe emptiness or thin content as a defect: that phrasing can invite fabricated UI.
- Verify Tailwind v4 arbitrary custom-property syntax, quote CSS `url(...)` values, and update CSP before introducing data URIs.
- Never use the raw candidate PNG as a shipped asset; ship the extracted cutouts and plates.
- Never scrim imagery away. A heavy overlay is a fidelity defect, not a readability fix.
- Do not add decoration the design does not contain.

## Spend ledger

Nothing was purchased against this kit.

## Anatomy

- `improve.json` is the durable stage, purchase, price-ceiling, and replay record.
- `source.png` is the normalized source screenshot.
- `candidates/` keeps every generated option and its draft record; `winner.png` is the explicit image target.
- `target/` holds the target LayerDoc, responsive HTML when generated, and extracted assets.
- `plan/` holds the diff, implementation plan, token patch, added-element assets, `GATE.md` when anchoring was unsafe, or `STALL.md` when a stage did not settle.

## Replay

- Apply the plan in the owning repository, then verify behavior and screenshots there. This kit never applies code.
- The target HTML is a visual implementation reference. A passed selector gate proves anchor coverage, not factual content preservation or working filters, navigation, and application integrations. Keep the source application authoritative for those when applying the design.
- Re-run from `pick` with another `--pick` slot to reuse capture and candidates; settled paid stages replay.
