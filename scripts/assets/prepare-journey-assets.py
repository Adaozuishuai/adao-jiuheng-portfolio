"""Matte imagegen's RGB cutouts after explicit approval for local postprocessing.

Requires Pillow, NumPy, OpenCV (authoring tools only; no website dependency).
Usage: python scripts/assets/prepare-journey-assets.py /path/to/generated_images/session
The RGB checkerboard is not alpha. Body segmentation is bounded and color seeded;
shadow geometry is traced from the generated cutout and converted to soft alpha.
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(sys.argv[1])
DEST = ROOT / 'public/images/home/journey'
QA = ROOT / 'docs/about-growth'
DEST.mkdir(parents=True, exist_ok=True)
QA.mkdir(parents=True, exist_ok=True)
SIZE = (2172, 724)
# Coordinates measured on each generated canvas; shadow polygons are in source space.
SPECS = {
    'child': dict(file='exec-451817f0-dc3a-4e1e-8040-7fa586fb4724.png',
                  rect=(548, 438, 635, 572), foot=(603, 571), target=(604, 568), scale=.98,
                  torso=[(593,473),(610,480),(612,492),(601,516),(578,510),(578,483)],
                  shadow=[(603,568),(554,583),(505,601),(465,624),(382,654),(365,664),(404,658),(477,638),(540,611),(583,588),(607,572)], shadow_x=.65, shadow_y=.6, strength=.38),
    'teen': dict(file='exec-d4d4b203-6d69-4b94-b7ac-c278712b94a2.png',
                 rect=(978, 278, 1078, 518), foot=(1052, 514), target=(809, 536), scale=.708,
                 torso=[(1038,320),(1060,325),(1063,370),(1054,420),(1015,420),(991,370),(1008,339)],
                 shadow=[(1040,513),(970,531),(880,556),(808,586),(726,613),(712,620),(744,616),(790,602),(901,567),(1006,528),(1060,513),(973,551),(898,574),(824,603),(753,629),(737,643),(761,638),(838,608),(943,566),(1049,520)], shadow_x=.6, shadow_y=.65, strength=.42),
    'adult': dict(file='exec-df360d7d-325c-48c4-9fbe-990cfcf1a6cd.png',
                  rect=(1077, 177, 1225, 566), foot=(1174, 562), target=(1026, 510), scale=.553,
                  torso=[(1140,239),(1176,239),(1196,256),(1203,290),(1207,330),(1210,350),(1194,361),(1194,391),(1119,391),(1115,301),(1122,254)],
                  shadow=[(1096,557),(1026,580),(958,602),(899,624),(831,644),(810,659),(839,654),(920,632),(1000,609),(1070,584),(1189,563),(1164,565),(1071,597),(983,625),(912,649),(879,656),(913,651),(1000,625),(1114,586)], shadow_x=.68, shadow_y=.65, strength=.42),
}

stats = {}
for name, spec in SPECS.items():
    rgb = np.array(Image.open(SOURCE / spec['file']).convert('RGB'))
    h, w = rgb.shape[:2]
    x0,y0,x1,y1 = spec['rect']
    crop = rgb[y0:y1,x0:x1].copy()
    chroma = np.ptp(crop.astype(float), axis=2)
    dark = crop.max(axis=2) < 80
    mask = np.full(crop.shape[:2], cv2.GC_PR_BGD, dtype=np.uint8)
    mask[(chroma > 10) | dark] = cv2.GC_PR_FGD
    mask[(chroma > 23) | (crop.max(axis=2) < 55)] = cv2.GC_FGD
    mask[(chroma < 4) & (crop.min(axis=2) > 175)] = cv2.GC_BGD
    # Neutral gray fabric is real foreground too; color-only seeding would punch
    # holes through sleeves and hood. Measured interior torso seeds preserve it.
    cv2.fillPoly(mask, [np.array([(x-x0,y-y0) for x,y in spec['torso']], np.int32)], cv2.GC_FGD)
    mask[[0,-1],:] = cv2.GC_BGD
    mask[:,[0,-1]] = cv2.GC_BGD
    cv2.grabCut(crop, mask, None, np.zeros((1,65)), np.zeros((1,65)), 7, cv2.GC_INIT_WITH_MASK)
    body = ((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD)).astype(np.uint8)
    # Keep main silhouette plus its connected narrow backpack straps, remove speckles.
    count, labels, components, _ = cv2.connectedComponentsWithStats(body, 8)
    body[:] = 0
    for label in range(1,count):
        if components[label, cv2.CC_STAT_AREA] >= 6:
            body[labels == label] = 255
    # Subpixel antialias only at the contour; no opaque rectangular backing.
    alpha = cv2.GaussianBlur(body.astype(float), (3,3), .42)
    # Decontaminate contour colors from the painted gray background using nearest
    # interior color. This avoids a white/gray fringe on both light and dark backdrops.
    interior = cv2.erode(body, np.ones((3,3),np.uint8)) > 0
    _, nearest = cv2.distanceTransformWithLabels((~interior).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    colors = crop[interior]
    edge = (alpha > 0) & ~interior
    crop[edge] = colors[np.clip(nearest[edge]-1, 0, len(colors)-1)]
    rgba = np.zeros((h,w,4), np.uint8)
    rgba[y0:y1,x0:x1,:3] = crop
    rgba[y0:y1,x0:x1,3] = np.clip(alpha,0,255).astype(np.uint8)
    subject = Image.fromarray(rgba)
    # Rebuild the generated shadow as an alpha matte rather than retaining checker pixels.
    shadow_mask = Image.new('L',(w,h))
    draw = ImageDraw.Draw(shadow_mask)
    fx,fy = spec['foot']
    points = [(fx+(x-fx)*spec['shadow_x'],fy+(y-fy)*spec['shadow_y']) for x,y in spec['shadow']]
    draw.polygon(points, fill=round(255*spec['strength']))
    shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(1.1))
    shadow = Image.new('RGBA',(w,h),(62,69,68,0))
    shadow.putalpha(shadow_mask)
    combined = Image.alpha_composite(shadow,subject)
    scale=spec['scale']; tx,ty=spec['target']
    aligned = combined.transform(SIZE, Image.Transform.AFFINE,
        (1/scale,0,fx-tx/scale,0,1/scale,fy-ty/scale), Image.Resampling.BICUBIC)
    aligned.save(DEST / f'{name}.png', optimize=True)
    a = np.array(aligned.getchannel('A'))
    stats[name] = dict(canvas=SIZE, foot=spec['target'], alpha_range=[int(a.min()),int(a.max())],
                       transparent_pixels=int((a==0).sum()), translucent_pixels=int(((a>0)&(a<255)).sum()),
                       bounds=aligned.getbbox())

background = Image.open(DEST/'background.png').convert('RGBA')
composite=background.copy()
for name in SPECS:
    composite=Image.alpha_composite(composite,Image.open(DEST/f'{name}.png'))
composite.convert('RGB').save(QA/'final-composite.png')
# Raw high resolution edge QA: three rows, ivory and dark columns.
sheet=Image.new('RGB',(900,900),'white')
for row,name in enumerate(SPECS):
    sprite=Image.open(DEST/f'{name}.png')
    bbox=sprite.getbbox()
    cut=sprite.crop((bbox[0]-8,bbox[1]-8,bbox[2]+8,bbox[3]+8))
    cut.thumbnail((420,285))
    for col,color in enumerate(('#f3f0e8','#25303a')):
        cell=Image.new('RGBA',(450,300),color)
        cell.alpha_composite(cut,((450-cut.width)//2,(300-cut.height)//2))
        sheet.paste(cell.convert('RGB'),(col*450,row*300))
sheet.save(QA/'alpha-edge-check.png')
(QA/'asset-metrics.json').write_text(json.dumps(stats,indent=2)+'\n')
print(json.dumps(stats,indent=2))
