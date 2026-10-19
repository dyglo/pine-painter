"""Compare supplied/migrated chrome at identical viewports (Pillow, test-only).
Chart data, instrument text, branding, running clock and calculated values are
necessarily different. Their explicit masks do not exempt panel/input borders,
icons, source labels, spacing or toolbar geometry. 16-channel tolerance and
0.015% changed-pixel ceiling allow browser anti-aliasing/hover differences.
"""
import json
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw
root = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/deplyze-replay-artifacts')
results = []
for state in ['live', 'order', 'replay', 'responsive']:
    original = Image.open(root / f'html-original-{state}.png').convert('RGB')
    migrated = Image.open(root / f'html-migrated-{state}.png').convert('RGB')
    assert original.size == migrated.size
    width, height = original.size
    scale = min(width / 2419, height / 1512)
    ox, oy = (width - 2419 * scale) / 2, (height - 1512 * scale) / 2
    mask = Image.new('L', original.size, 255)
    draw = ImageDraw.Draw(mask)
    rects = [(0, 0, 350, 76), (107, 80, 2330 if state in ['live', 'replay'] else 1733, 1363 if state != 'replay' else 1268), (1370, 1370, 2330, 1430), (710, 1440, 1730, 1512), (150, 1180, 500, 1365)]
    if state in ['order', 'responsive']:
        rects += [(1828, 102, 2100, 150), (1770, 310, 2297, 365), (2030, 480, 2130, 515), (2035, 528, 2290, 580), (1770, 654, 2290, 712), (1770, 760, 2290, 817), (1760, 830, 2295, 872), (2080, 935, 2300, 1030), (1770, 1065, 2295, 1160)]
    for x1, y1, x2, y2 in rects:
        draw.rectangle([ox + x1 * scale, oy + y1 * scale, ox + x2 * scale, oy + y2 * scale], fill=0)
    # The scaled stage's outermost raster row can differ under Chromium's
    # canvas compositing. Geometry is asserted separately to <0.08px; exclude
    # only that one physical-pixel perimeter, not any interior chrome.
    draw.rectangle([ox, oy, ox + 2419 * scale, oy + 1512 * scale], outline=0, width=1)
    diff = ImageChops.difference(original, migrated)
    channels = diff.split()
    max_channel = ImageChops.lighter(ImageChops.lighter(channels[0], channels[1]), channels[2])
    bad = max_channel.point(lambda value: 255 if value > 16 else 0)
    compared = mask.histogram()[255]
    changed = ImageChops.multiply(bad, mask).histogram()[255]
    fraction = changed / compared
    results.append({'state': state, 'size': original.size, 'comparedPixels': compared, 'changedPixels': changed, 'changedFraction': fraction})
    assert fraction <= .00015, f'{state}: unexplained chrome pixel changes {fraction:.5%}'
(root / 'html-pixel-comparison.json').write_text(json.dumps(results, indent=2) + '\n')
print(json.dumps({'status': 'PASS', 'comparisons': results}))
