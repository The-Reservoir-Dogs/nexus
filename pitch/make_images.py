"""Generate on-brand illustrations for the NEXUS deck (offline, PIL)."""
import math, os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), "assets")
os.makedirs(OUT, exist_ok=True)

# palette (RGB)
PAPER = (250, 248, 244); PANEL = (255, 253, 249); INK = (26, 26, 26)
BODY = (58, 55, 51); MUTED = (115, 109, 99); LINE = (228, 224, 216)
TERRA = (194, 54, 22); AMBER = (243, 176, 58); GREEN = (21, 128, 61)
VIOLET = (124, 92, 255); WHITE = (255, 255, 255); DANGER = (200, 60, 40)

FD = "/System/Library/Fonts/Supplemental/Georgia.ttf"
FDI = "/System/Library/Fonts/Supplemental/Georgia Italic.ttf"
FS = "/System/Library/Fonts/Supplemental/Arial.ttf"
FSB = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FM = "/System/Library/Fonts/Menlo.ttc"


def F(path, sz):
    return ImageFont.truetype(path, sz)


def rrect(d, box, r, fill=None, outline=None, w=1):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=w)


def dot(d, x, y, r, fill):
    d.ellipse([x - r, y - r, x + r, y + r], fill=fill)


def text(d, xy, s, font, fill, anchor="la"):
    d.text(xy, s, font=font, fill=fill, anchor=anchor)


def draw_check(d, x, y, s, color):
    w = max(3, s // 4)
    d.line([(x - s * 0.45, y), (x - s * 0.1, y + s * 0.4)], fill=color, width=w)
    d.line([(x - s * 0.1, y + s * 0.4), (x + s * 0.5, y - s * 0.45)], fill=color, width=w)


def draw_warn(d, x, y, s, color):
    d.polygon([(x, y - s), (x - s, y + s * 0.8), (x + s, y + s * 0.8)], outline=color, width=3)
    d.line([(x, y - s * 0.3), (x, y + s * 0.3)], fill=color, width=3)
    d.ellipse([x - 2, y + s * 0.45, x + 2, y + s * 0.49 + 2], fill=color)


# ---------------------------------------------------------------- 1. multiverse tree
def multiverse(scale=3):
    W, H = 1200 * 1, 780
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)
    # soft glow corners
    for i, (cx, cy, col) in enumerate([(120, 80, VIOLET), (1080, 120, AMBER)]):
        for r in range(220, 0, -8):
            a = int(10 * (1 - r / 220))
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(
                min(PAPER[0] + (col[0] - PAPER[0]) * a // 90, 255),
                min(PAPER[1] + (col[1] - PAPER[1]) * a // 90, 255),
                min(PAPER[2] + (col[2] - PAPER[2]) * a // 90, 255)))
    # sacred timeline (gold vertical-ish spine going right)
    spine = [(90, 640), (300, 560), (520, 470), (740, 430), (980, 360)]
    for a, b in zip(spine, spine[1:]):
        d.line([a, b], fill=AMBER, width=6)
    # canon nodes
    for i, (x, y) in enumerate(spine):
        dot(d, x, y, 13, AMBER); dot(d, x, y, 6, WHITE)
        text(d, (x, y + 22), f"EP{i+1}", F(FM, 15), MUTED, anchor="ma")
    # violet branches from decision points
    branches = [
        ((520, 470), [(560, 330), (700, 250)]),
        ((520, 470), [(640, 560), (820, 610)]),
        ((740, 430), [(820, 300), (1000, 240)]),
    ]
    for start, pts in branches:
        prev = start
        for p in pts:
            d.line([prev, p], fill=VIOLET, width=4)
            prev = p
        for p in pts:
            dot(d, p[0], p[1], 9, VIOLET); dot(d, p[0], p[1], 4, WHITE)
    # verified branch tick
    d.line([(740, 430), (860, 480)], fill=VIOLET, width=4)
    dot(d, 860, 480, 12, GREEN); draw_check(d, 860, 481, 12, WHITE)
    # labels
    text(d, (90, 690), "SACRED TIMELINE", F(FM, 16), (150, 120, 40))
    text(d, (700, 250 - 30), "alternate timeline", F(FDI, 20), VIOLET, anchor="la")
    text(d, (880, 505), "verified \u2192 canon", F(FM, 14), GREEN, anchor="la")
    img.save(f"{OUT}/multiverse.png")


# ---------------------------------------------------------------- 2. eval self-correction panel
def eval_panel():
    W, H = 1200, 780
    img = Image.new("RGB", (W, H), PAPER); d = ImageDraw.Draw(img)
    # card
    rrect(d, [80, 70, 1120, 710], 24, fill=PANEL, outline=LINE, w=2)
    text(d, (120, 110), "AI SELF-EVALUATION", F(FM, 20), TERRA)
    text(d, (120, 145), "the AI grades its own work \u2014 with evidence", F(FS, 20), MUTED)
    # score rows
    rows = [("Continuity", 4.6, GREEN), ("Character fidelity", 4.8, GREEN),
            ("Reader intent", 4.5, GREEN), ("Safety", 5.0, GREEN)]
    y = 220
    for name, sc, col in rows:
        text(d, (120, y), name, F(FSB, 24), INK)
        # bar
        bx, bw = 470, 480
        rrect(d, [bx, y + 6, bx + bw, y + 26], 10, fill=(238, 233, 224))
        rrect(d, [bx, y + 6, bx + int(bw * sc / 5), y + 26], 10, fill=col)
        text(d, (bx + bw + 20, y), f"{sc}", F(FSB, 24), col)
        dot(d, 1075, y + 15, 9, GREEN)
        y += 66
    # self-correction banner
    by = 520
    rrect(d, [120, by, 1080, by + 150], 16, fill=(253, 245, 240), outline=(230, 180, 150), w=2)
    draw_warn(d, 165, by + 36, 15, DANGER)
    text(d, (195, by + 24), "Caught a continuity break", F(FSB, 24), DANGER)
    text(d, (150, by + 62), "\u201cCorvin references a death that never happened in this timeline.\u201d",
         F(FDI, 21), BODY)
    text(d, (150, by + 100), "\u2192  repairing \u2026   ", F(FSB, 23), GREEN)
    draw_check(d, 405, by + 112, 15, GREEN)
    text(d, (425, by + 100), "resolved", F(FSB, 23), GREEN)
    text(d, (600, by + 100), "3.1 \u2192 4.7", F(FM, 24), GREEN)
    img.save(f"{OUT}/eval.png")


# ---------------------------------------------------------------- 3. split view
def splitview():
    W, H = 1200, 720
    img = Image.new("RGB", (W, H), PAPER); d = ImageDraw.Draw(img)
    mid = 600
    rrect(d, [70, 70, 1130, 650], 20, fill=PANEL, outline=LINE, w=2)
    d.line([(mid, 90), (mid, 630)], fill=LINE, width=2)
    # left = original
    text(d, (110, 110), "ORIGINAL TIMELINE", F(FM, 17), (150, 120, 40))
    text(d, (110, 145), "The Spared Blade", F(FD, 30), INK)
    for i, ln in enumerate(["He saw the tremor in her hand,", "the old grief behind her pride.",
                            "He lowered the sword.", "\u201cNot like this,\u201d he said."]):
        text(d, (110, 205 + i * 40), ln, F(FS, 21), BODY)
    # right = alternate (violet tint)
    rrect(d, [mid + 2, 72, 1128, 648], 18, fill=(247, 244, 255))
    text(d, (mid + 40, 110), "ALTERNATE TIMELINE", F(FM, 17), VIOLET)
    text(d, (mid + 40, 145), "The Fallen Blade", F(FD, 30), INK)
    for i, ln in enumerate(["The blade fell without hesitation.", "Her banners did not scatter \u2014",
                            "they turned to him.", "He had become the war\u2019s next chapter."]):
        text(d, (mid + 40, 205 + i * 40), ln, F(FS, 21), BODY)
    # consistency callout
    rrect(d, [mid + 40, 400, 1090, 470], 12, fill=(240, 250, 243), outline=(160, 210, 175), w=2)
    draw_check(d, mid + 68, 435, 13, GREEN)
    text(d, (mid + 90, 418), "character stays consistent \u2014 same clipped voice",
         F(FS, 18), GREEN)
    # score chip
    rrect(d, [110, 560, 620, 610], 10, fill=(245, 242, 236))
    text(d, (130, 572), "MLflow \u00b7 Continuity 4.6/5 \u00b7 Character 4.8/5", F(FM, 17), MUTED)
    img.save(f"{OUT}/splitview.png")


# ---------------------------------------------------------------- 4. audio drama
def audio():
    W, H = 1200, 460
    img = Image.new("RGB", (W, H), INK); d = ImageDraw.Draw(img)
    text(d, (60, 45), "// AUDIO DRAMA", F(FM, 20), AMBER)
    # waveform
    cx0, cy = 60, 250
    n = 120; bw = 8
    import random; random.seed(7)
    for i in range(n):
        h = int((math.sin(i / 6) * 0.5 + 0.5) * 120 * (0.4 + random.random() * 0.6)) + 8
        x = cx0 + i * (bw + 2)
        col = AMBER if 40 < i < 60 else (86, 80, 74) if i % 3 else (120, 112, 104)
        d.rounded_rectangle([x, cy - h, x + bw, cy + h], radius=3, fill=col)
    # voice chips
    chips = [("Narrator", (90, 150, 220)), ("Lady Corvin", TERRA), ("Ser Aldric", GREEN)]
    x = 60
    for name, col in chips:
        w = 40 + len(name) * 13
        rrect(d, [x, 360, x + w, 405], 22, fill=(30, 28, 36), outline=(70, 66, 74), w=1)
        dot(d, x + 22, 382, 7, col)
        text(d, (x + 38, 370), name, F(FSB, 19), WHITE)
        x += w + 20
    text(d, (x + 10, 372), "\u25B6  music bed + a beat of silence before the moment", F(FS, 17), (170, 165, 158))
    img.save(f"{OUT}/audio.png")


multiverse(); eval_panel(); splitview(); audio()
print("images ->", os.listdir(OUT))
