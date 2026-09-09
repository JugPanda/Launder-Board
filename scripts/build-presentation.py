#!/usr/bin/env python3
"""Build the editable LaundroStat pitch deck from approved copy."""

from pathlib import Path
from tempfile import TemporaryDirectory

import qrcode
from PIL import Image, ImageOps
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "presentation"
ASSETS = OUT / "assets"
PPTX_PATH = OUT / "LaundroStat-Updated-Deck.pptx"
DEMO_URL = "https://laundrostat.vercel.app/demo"
REPO_URL = "https://github.com/JugPanda/Launder-Board"

PAPER = "F8F5ED"
WHITE = "FFFFFF"
INK = "23251F"
CHARCOAL = "1D1F1A"
MUTED = "66655E"
GOLD = "E2B94F"
GOLD_DARK = "80621D"
CREAM = "F0E6CD"
LINE = "DCD5C5"
PALE_BLUE = "EAF7FB"
PALE_GOLD = "F7F0DD"
BLUE = "35ADEF"
GREEN = "64784C"
RED = "9C4434"

SLIDE_W = 13.333
SLIDE_H = 7.5
FONT = "Arial"


def rgb(value: str) -> RGBColor:
    return RGBColor.from_string(value)


def add_rect(slide, x, y, w, h, fill, line=None, radius=True):
    shape_type = MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE
    shape = slide.shapes.add_shape(shape_type, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.fill.solid()
    shape.fill.fore_color.rgb = rgb(fill)
    shape.line.color.rgb = rgb(line or fill)
    if radius:
        try:
            shape.adjustments[0] = 0.08
        except Exception:
            pass
    return shape


def add_circle(slide, x, y, d, fill, line=None, line_width=1.5):
    shape = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(d), Inches(d))
    shape.fill.solid()
    shape.fill.fore_color.rgb = rgb(fill)
    shape.line.color.rgb = rgb(line or fill)
    shape.line.width = Pt(line_width)
    return shape


def add_text(slide, text, x, y, w, h, size: float = 20, color=INK, bold=False,
             align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.TOP, font=FONT,
             margin=0, line_spacing=1.05):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    box.text_frame.clear()
    box.text_frame.word_wrap = True
    box.text_frame.margin_left = Inches(margin)
    box.text_frame.margin_right = Inches(margin)
    box.text_frame.margin_top = Inches(margin)
    box.text_frame.margin_bottom = Inches(margin)
    box.text_frame.vertical_anchor = valign
    p = box.text_frame.paragraphs[0]
    p.text = text
    p.alignment = align
    p.line_spacing = line_spacing
    p.space_after = Pt(0)
    p.space_before = Pt(0)
    for run in p.runs:
        run.font.name = font
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.color.rgb = rgb(color)
    return box


def add_rich_text(slide, parts, x, y, w, h, size: float = 20, color=INK,
                  align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.TOP):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    box.text_frame.clear()
    box.text_frame.word_wrap = True
    box.text_frame.margin_left = 0
    box.text_frame.margin_right = 0
    box.text_frame.margin_top = 0
    box.text_frame.margin_bottom = 0
    box.text_frame.vertical_anchor = valign
    p = box.text_frame.paragraphs[0]
    p.alignment = align
    p.space_after = Pt(0)
    for value, bold, part_color in parts:
        run = p.add_run()
        run.text = value
        run.font.name = FONT
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.color.rgb = rgb(part_color or color)
    return box


def add_bullets(slide, items, x, y, w, h, size: float = 18, color=INK, gap=7,
                bullet_color=GOLD_DARK):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.margin_left = 0
    tf.margin_right = 0
    tf.margin_top = 0
    tf.margin_bottom = 0
    for i, item in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.space_after = Pt(gap)
        p.line_spacing = 1.02
        r1 = p.add_run()
        r1.text = "• "
        r1.font.name = FONT
        r1.font.size = Pt(size)
        r1.font.bold = True
        r1.font.color.rgb = rgb(bullet_color)
        r2 = p.add_run()
        r2.text = item
        r2.font.name = FONT
        r2.font.size = Pt(size)
        r2.font.color.rgb = rgb(color)
    return box


def add_kicker(slide, text, x=0.72, y=0.58, w=7.5, color=GOLD_DARK):
    return add_text(slide, text.upper(), x, y, w, 0.28, 10.5, color, True)


def add_title(slide, title, subtitle=None, dark=False, x=0.72, y=0.92, w=11.9):
    color = WHITE if dark else INK
    add_text(slide, title, x, y, w, 0.68, 30, color, True)
    if subtitle:
        add_text(slide, subtitle, x, y + 0.72, w, 0.52, 15.5, "D6D2C8" if dark else MUTED)


def add_brand(slide, dark=False, number=None, disclosure=True):
    color = "DCD8CE" if dark else MUTED
    if disclosure:
        add_text(slide, "SYNTHETIC SHOWCASE · NO LIVE CSC CONNECTION", 0.72, 7.12, 5.6, 0.2, 8.5, color, True)
    add_text(slide, "LaundroStat", 10.5, 7.10, 1.75, 0.22, 9.5, color, True, PP_ALIGN.RIGHT)
    if number is not None:
        add_text(slide, f"{number:02d}", 12.35, 7.10, 0.28, 0.22, 9.5, GOLD_DARK if not dark else GOLD, True, PP_ALIGN.RIGHT)


def add_slide_base(prs, dark=False, number=None, disclosure=True):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    bg = slide.background.fill
    bg.solid()
    bg.fore_color.rgb = rgb(CHARCOAL if dark else PAPER)
    # restrained laundry-bubble motif
    add_circle(slide, 11.75, -0.55, 2.2, CHARCOAL if dark else PAPER, GOLD_DARK if dark else LINE, 1)
    add_circle(slide, 12.35, 0.05, 0.7, CHARCOAL if dark else PAPER, GOLD if dark else CREAM, 1)
    add_brand(slide, dark=dark, number=number, disclosure=disclosure)
    return slide


def add_badge(slide, text, x, y, w, fill=PALE_GOLD, color=GOLD_DARK):
    add_rect(slide, x, y, w, 0.36, fill, fill)
    add_text(slide, text, x + 0.10, y + 0.075, w - 0.2, 0.18, 9.5, color, True, PP_ALIGN.CENTER)


def add_card(slide, x, y, w, h, title, body, accent=GOLD, fill=WHITE,
             title_size: float = 16, body_size: float = 12.5):
    add_rect(slide, x, y, w, h, fill, LINE)
    add_rect(slide, x, y, 0.08, h, accent, accent, radius=False)
    add_text(slide, title, x + 0.22, y + 0.20, w - 0.42, 0.30, title_size, INK, True)
    add_text(slide, body, x + 0.22, y + 0.62, w - 0.42, h - 0.78, body_size, MUTED)


def prep_image(src: Path, dst: Path, ratio: float, focus=(0.5, 0.5), size=(1600, 900)):
    img = Image.open(src).convert("RGB")
    target_w, target_h = size
    if abs(target_w / target_h - ratio) > 0.01:
        target_h = int(target_w / ratio)
    fitted = ImageOps.fit(img, (target_w, target_h), method=Image.Resampling.LANCZOS,
                          centering=focus)
    fitted.save(dst, quality=92)
    return dst


def add_picture_card(slide, image_path, x, y, w, h, border=WHITE):
    add_rect(slide, x - 0.05, y - 0.05, w + 0.10, h + 0.10, border, LINE)
    slide.shapes.add_picture(str(image_path), Inches(x), Inches(y), Inches(w), Inches(h))


def add_link_text(slide, label, url, x, y, w, h, size: float = 13, color=GOLD_DARK, dark=False):
    box = add_text(slide, label, x, y, w, h, size, GOLD if dark else color, True)
    # Use the text box as the click target. Run-level hyperlinks are rendered
    # with an unreadable default-blue style by LibreOffice on dark slides.
    box.click_action.hyperlink.address = url
    return box


def make_deck():
    OUT.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)
    qr_path = ASSETS / "laundrostat-demo-qr.png"
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_H,
                       box_size=14, border=4)
    qr.add_data(DEMO_URL)
    qr.make(fit=True)
    qr.make_image(fill_color="#1D1F1A", back_color="#FFFFFF").save(qr_path)

    with TemporaryDirectory(prefix="laundrostat-deck-") as tmp:
        tmp = Path(tmp)
        screenshot_paths = {}
        specs = {
            "landing": (1.60, (0.5, 0.28)),
            "overview": (1.56, (0.50, 0.48)),
            "search": (1.56, (0.50, 0.62)),
            "wash-mates": (1.56, (0.50, 0.52)),
            "leaderboards": (1.56, (0.50, 0.58)),
            "community": (1.56, (0.50, 0.55)),
        }
        for name, (ratio, focus) in specs.items():
            screenshot_paths[name] = prep_image(ASSETS / f"{name}.png", tmp / f"{name}.jpg", ratio, focus)
        creator_crop = prep_image(
            ROOT / "public/images/laundrostat-creators.webp",
            tmp / "creators.jpg",
            0.78,
            (0.50, 0.48),
            (1000, 1280),
        )

        prs = Presentation()
        prs.slide_width = Inches(SLIDE_W)
        prs.slide_height = Inches(SLIDE_H)
        prs.core_properties.title = "LaundroStat — Clean clothes. Friendly competition."
        prs.core_properties.subject = "Updated 14-slide MERP hackathon presentation"
        prs.core_properties.author = "MERP"
        prs.core_properties.comments = "Generated from docs/laundrostat-canva-update-brief.md"

        # 1 — Title
        slide = add_slide_base(prs, dark=True, number=1, disclosure=False)
        add_badge(slide, "POWERED BY TYPESENSE", 0.78, 0.62, 2.15, fill="36382F", color=GOLD)
        add_text(slide, "LaundroStat", 0.78, 1.42, 7.3, 0.90, 46, WHITE, True)
        add_rich_text(slide, [("Clean clothes. ", False, WHITE), ("Friendly competition.", True, GOLD)],
                      0.82, 2.45, 7.6, 0.72, 25)
        add_text(slide, "A hosted social laundry showcase for Purdue University West Lafayette.",
                 0.82, 3.35, 6.7, 0.60, 16, "D8D4C9")
        # washer drum motif
        add_circle(slide, 9.0, 1.05, 3.4, "2B2D27", GOLD, 4)
        add_circle(slide, 9.53, 1.58, 2.34, "24261F", "7E713F", 2)
        add_text(slide, "FRESH\nSTART", 9.78, 2.18, 1.84, 0.85, 21, GOLD, True, PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE)
        add_text(slide, "RECENCY + CONSISTENCY", 9.60, 3.23, 2.2, 0.22, 8.5, "D8D4C9", True, PP_ALIGN.CENTER)
        add_text(slide, "MERP", 0.82, 5.34, 0.8, 0.3, 12, GOLD, True)
        add_text(slide, "Marcus Withers  ·  Eddie Wuerthele  ·  Rupika Chakka  ·  Pritham Singh",
                 0.82, 5.75, 9.8, 0.38, 14.5, WHITE)
        add_text(slide, "Student-built synthetic demo · Not affiliated with or endorsed by Purdue, University Residences, CSC ServiceWorks, CSCPay, or Typesense.",
                 0.82, 6.39, 9.0, 0.42, 9, "AAA79D")

        # 2 — Problem
        slide = add_slide_base(prs, number=2)
        add_kicker(slide, "The problem")
        add_title(slide, "Laundry is easy to put off.")
        add_text(slide, "Dorm laundry is repetitive, inconvenient, and usually done alone.",
                 0.78, 1.95, 5.2, 0.80, 21, INK, True)
        add_text(slide, "When the routine slips, friends have no respectful way to coordinate a laundry day or offer a little encouragement.",
                 0.78, 2.95, 5.3, 1.35, 16, MUTED)
        for i, (label, detail) in enumerate([
            ("01", "A chore with no shared routine"),
            ("02", "Private behavior invites bad assumptions"),
            ("03", "Accountability often feels like a call-out"),
        ]):
            y = 1.82 + i * 1.32
            add_circle(slide, 7.05, y, 0.62, PALE_GOLD, GOLD, 1.5)
            add_text(slide, label, 7.05, y + 0.18, 0.62, 0.22, 10, GOLD_DARK, True, PP_ALIGN.CENTER)
            add_text(slide, detail, 7.92, y + 0.10, 4.15, 0.42, 16, INK, True)
            if i < 2:
                add_rect(slide, 7.34, y + 0.70, 0.03, 0.55, LINE, LINE, radius=False)
        add_rect(slide, 0.78, 5.43, 11.52, 0.84, CHARCOAL, CHARCOAL)
        add_text(slide, "What if laundry felt more social—and a little more fun?",
                 1.12, 5.68, 10.85, 0.34, 20, WHITE, True, PP_ALIGN.CENTER)

        # 3 — Idea
        slide = add_slide_base(prs, number=3)
        add_kicker(slide, "The idea")
        add_title(slide, "Turn laundry into a social routine.",
                  "One simple loop: understand your routine, find support, and bring your hall along.")
        steps = [
            ("01", "Check", "See your Clean-O-Meter."),
            ("02", "Match", "Find a Wash Mate."),
            ("03", "Encourage", "Send a consenting friend a preset nudge."),
            ("04", "Compete", "Join Squeaky/Stinky Squads and Dorm Wars."),
        ]
        for i, (num, label, body) in enumerate(steps):
            y = 2.23 + i * 0.94
            add_badge(slide, num, 0.80, y, 0.58)
            add_text(slide, label, 1.58, y - 0.02, 1.4, 0.30, 14, INK, True)
            add_text(slide, body, 2.92, y - 0.02, 3.08, 0.40, 12.5, MUTED)
        add_picture_card(slide, screenshot_paths["landing"], 6.55, 1.93, 5.72, 3.58)
        add_rect(slide, 6.55, 5.72, 5.72, 0.53, PALE_GOLD, PALE_GOLD)
        add_text(slide, "FICTIONAL PARTICIPANTS · REAL HOSTED INTERACTIONS", 6.78, 5.88, 5.28, 0.18, 9, GOLD_DARK, True, PP_ALIGN.CENTER)

        # 4 — Features
        slide = add_slide_base(prs, number=4)
        add_kicker(slide, "The product")
        add_title(slide, "One routine. Five ways to play.")
        features = [
            ("Clean-O-Meter", "Recorded recency + consistency, with the source shown.", BLUE),
            ("Friendly nudges", "Search consenting friends by recorded activity period.", GOLD),
            ("Wash Mates", "Match overlapping usual laundry days and time windows.", GREEN),
            ("Squeaky / Stinky", "Playful top and bottom eligible user squads.", BLUE),
            ("Dorm Wars", "Normalized synthetic residence-hall averages.", GOLD),
        ]
        for i, (title, body, accent) in enumerate(features):
            if i < 3:
                x, y = 0.78 + i * 4.08, 2.0
            else:
                x, y = 2.82 + (i - 3) * 4.08, 3.85
            add_card(slide, x, y, 3.75, 1.48, title, body,
                     accent=accent, title_size=16, body_size=14.5)
        add_rect(slide, 0.78, 5.70, 11.55, 0.62, CHARCOAL, CHARCOAL)
        add_text(slide, "HOSTED DEMO · Isolated actions save to the browser session or presentation account.",
                 1.03, 5.89, 11.05, 0.24, 12.5, WHITE, True, PP_ALIGN.CENTER)

        # 5 — Clean-O-Meter
        slide = add_slide_base(prs, number=5)
        add_kicker(slide, "The score")
        add_title(slide, "Meet the Clean-O-Meter.", "A transparent demo model—not a hygiene judgment.")
        add_rect(slide, 0.78, 2.03, 5.35, 1.13, CHARCOAL, CHARCOAL)
        add_text(slide, "100 − (4 × days since recorded wash)\n+ (2 × scrub streak)",
                 1.05, 2.27, 4.80, 0.66, 18, GOLD, True, PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE)
        add_bullets(slide, [
            "Scrub streak is capped at 6.",
            "Final score is bounded from 0 to 100.",
            "Unknown or incomplete tracking gets no score.",
            "More loads, money, and claimed weight never buy points.",
        ], 0.84, 3.48, 5.15, 2.18, 15.5, gap=10)
        add_picture_card(slide, screenshot_paths["overview"], 6.45, 1.86, 5.84, 3.74)
        add_rect(slide, 6.45, 5.83, 5.84, 0.52, PALE_GOLD, PALE_GOLD)
        add_text(slide, "ILLUSTRATIVE DEMO · NOT POLICY, PROVIDER MEASUREMENT, OR HYGIENE JUDGMENT",
                 6.63, 5.98, 5.47, 0.20, 7.8, GOLD_DARK, True, PP_ALIGN.CENTER)

        # 6 — Fairness
        slide = add_slide_base(prs, number=6)
        add_kicker(slide, "Trust by design")
        add_title(slide, "Fair by design.", "The rules make the game legible without turning private behavior into spectacle.")
        cards = [
            ("EQUAL FOOTING", "Recency and consistency—not purchase volume or load count.", BLUE),
            ("PRIVATE BY DEFAULT", "Private, nonconsenting, and unknown profiles stay out of rankings.", GREEN),
            ("CLEAR RANKS", "Ties share ranks. Squeaky and Stinky groups never overlap.", GOLD),
            ("NORMALIZED HALLS", "Dorm Wars divides by the eligible synthetic roster—not building capacity.", RED),
        ]
        for i, (title, body, accent) in enumerate(cards):
            x = 0.78 + (i % 2) * 6.0
            y = 2.06 + (i // 2) * 1.68
            add_card(slide, x, y, 5.55, 1.34, title, body, accent=accent, title_size=15, body_size=15.5)
        add_rect(slide, 0.78, 5.58, 11.55, 0.66, CHARCOAL, CHARCOAL)
        add_text(slide, "Every score keeps its source context visible.", 1.08, 5.79, 10.95, 0.25, 17, WHITE, True, PP_ALIGN.CENTER)

        # 7 — Nudges
        slide = add_slide_base(prs, number=7)
        add_kicker(slide, "The social layer")
        add_title(slide, "Encouragement, not exposure.")
        add_picture_card(slide, screenshot_paths["search"], 0.78, 1.78, 6.05, 3.88)
        add_text(slide, "A respectful nudge loop", 7.25, 1.84, 4.75, 0.34, 18, INK, True)
        flow = [
            ("1", "Search consenting synthetic friends"),
            ("2", "Filter by no recorded wash in the selected period"),
            ("3", "Send one preset “fresh start” nudge"),
            ("4", "Respect the 72-hour recipient cooldown"),
            ("5", "Save privately to the session or demo account"),
        ]
        for i, (n, body) in enumerate(flow):
            y = 2.38 + i * 0.67
            add_circle(slide, 7.25, y, 0.40, PALE_GOLD, GOLD, 1)
            add_text(slide, n, 7.25, y + 0.11, 0.40, 0.16, 9, GOLD_DARK, True, PP_ALIGN.CENTER)
            add_text(slide, body, 7.84, y + 0.03, 4.22, 0.42, 14.5, INK, i in (0, 2))
        add_badge(slide, "NO REAL PERSON IS NOTIFIED", 7.25, 5.85, 4.62, fill="F1DFD9", color=RED)

        # 8 — Architecture
        slide = add_slide_base(prs, number=8)
        add_kicker(slide, "Architecture")
        add_title(slide, "How the hosted demo works",
                  "Provider-backed synthetic workflows with explicit consent and data boundaries.")
        # three horizontal lanes
        lanes = [
            ("LOAD", [("Browser", PALE_GOLD), ("Next.js 16", WHITE), ("Supabase synthetic data", PALE_BLUE)]),
            ("SEARCH", [("Friend filters", PALE_GOLD), ("Typesense Cloud", WHITE), ("Supabase consent recheck", PALE_BLUE)]),
            ("SAVE", [("Preset action", PALE_GOLD), ("Server-only handler", WHITE), ("Private session/account event", PALE_BLUE)]),
        ]
        for row, (label, boxes) in enumerate(lanes):
            y = 2.05 + row * 1.22
            add_badge(slide, label, 0.78, y + 0.18, 0.90)
            for col, (name, fill) in enumerate(boxes):
                x = 2.02 + col * 3.35
                add_rect(slide, x, y, 2.72, 0.78, fill, LINE)
                add_text(slide, name, x + 0.15, y + 0.21, 2.42, 0.36, 14.5, INK, True, PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE)
                if col < 2:
                    add_text(slide, "→", x + 2.83, y + 0.23, 0.34, 0.28, 17, GOLD_DARK, True, PP_ALIGN.CENTER)
        add_rect(slide, 0.78, 5.85, 11.55, 0.46, "F2E1DC", "F2E1DC")
        add_text(slide, "NO LIVE CSC/CSCPAY · NO QR OR VIBRATION SENSOR · NO WEIGHT OR CYCLE/PHOTO VERIFICATION",
                 1.05, 5.98, 11.00, 0.20, 8.8, RED, True, PP_ALIGN.CENTER)

        # 9 — Wash Mates
        slide = add_slide_base(prs, number=9)
        add_kicker(slide, "Better together")
        add_title(slide, "Find your Wash Mate.", "Coordinate a shared routine—not a live location.")
        add_picture_card(slide, screenshot_paths["wash-mates"], 0.78, 1.84, 6.28, 4.02)
        add_text(slide, "How matching works", 7.48, 1.95, 4.5, 0.34, 18, INK, True)
        add_bullets(slide, [
            "Choose your usual laundry day.",
            "Select a general time window.",
            "Find consenting synthetic friends with overlap.",
            "See why each schedule matches.",
        ], 7.48, 2.55, 4.45, 2.25, 15.5, gap=11)
        add_rect(slide, 7.48, 5.13, 4.65, 0.74, PALE_GOLD, PALE_GOLD)
        add_text(slide, "Coarse fictional preferences—\nnot observed student movement.",
                 7.72, 5.31, 4.17, 0.40, 12, GOLD_DARK, True, PP_ALIGN.CENTER)

        # 10 — Demo
        slide = add_slide_base(prs, dark=True, number=10)
        add_kicker(slide, "Live demo", color=GOLD)
        add_title(slide, "Let’s see LaundroStat in action.",
                  "The public showcase needs no account. An optional demo account saves synthetic actions across sign-ins.", dark=True)
        add_rect(slide, 0.80, 2.25, 3.15, 3.15, WHITE, WHITE)
        slide.shapes.add_picture(str(qr_path), Inches(1.08), Inches(2.53), Inches(2.59), Inches(2.59))
        add_link_text(slide, "laundrostat.vercel.app/demo", DEMO_URL, 0.72, 5.62, 3.30, 0.30, 11, dark=True)
        demo_steps = ["Clean-O-Meter", "Friend Search", "Wash Mates", "Squeaky/Stinky + Dorm Wars", "Community"]
        for i, label in enumerate(demo_steps):
            y = 2.25 + i * 0.68
            add_badge(slide, f"{i + 1:02d}", 4.70, y, 0.56, fill="373930", color=GOLD)
            add_text(slide, label, 5.55, y + 0.06, 3.08, 0.26, 13.5 if i == 3 else 14.5, WHITE, True)
            if i < 4:
                add_text(slide, "→", 8.42, y + 0.05, 0.30, 0.24, 14, GOLD, True)
        add_picture_card(slide, screenshot_paths["community"], 8.90, 2.18, 3.52, 2.27, border="2E302A")
        add_text(slide, "Fictional people. Real buttons. Nothing sent to CSC.",
                 8.90, 4.78, 3.50, 0.68, 12.5, "D8D4C9", True, PP_ALIGN.CENTER)

        # 11 — Tech stack
        slide = add_slide_base(prs, number=11)
        add_kicker(slide, "The stack")
        add_title(slide, "Built as a real hosted product demo.")
        groups = [
            ("EXPERIENCE", "Next.js 16\nReact 19\nTypeScript\nTailwind CSS 4", BLUE),
            ("INFRASTRUCTURE", "Vercel\nSupabase / PostgreSQL\nServer-only handlers\nRLS + privilege controls", GOLD),
            ("SEARCH + QUALITY", "Typesense Cloud\nSupabase revalidation\nVitest\nPlaywright", GREEN),
        ]
        for i, (title, body, accent) in enumerate(groups):
            x = 0.78 + i * 4.08
            add_rect(slide, x, 1.96, 3.72, 3.72, WHITE, LINE)
            add_rect(slide, x, 1.96, 3.72, 0.09, accent, accent, radius=False)
            add_text(slide, title, x + 0.30, 2.34, 3.10, 0.28, 11, GOLD_DARK, True)
            add_text(slide, body, x + 0.30, 2.92, 3.10, 2.10, 18, INK, True)
        add_rect(slide, 0.78, 5.94, 11.55, 0.44, CHARCOAL, CHARCOAL)
        add_text(slide, "REAL INFRASTRUCTURE · SYNTHETIC PARTICIPANTS · NO LIVE CSC INTEGRATION",
                 1.05, 6.07, 11.00, 0.18, 9.5, WHITE, True, PP_ALIGN.CENTER)

        # 12 — Roadmap
        slide = add_slide_base(prs, number=12)
        add_kicker(slide, "What’s next")
        add_title(slide, "From showcase to responsible pilot.",
                  "Validate the human need before adding more technical surface area.")
        roadmap = [
            ("01", "INTERVIEWS", "Validate the idea with real student interviews."),
            ("02", "OPT IN", "Add opt-in participant onboarding and privacy controls."),
            ("03", "AUTHORIZE", "Pursue written authorization from housing and laundry providers."),
            ("04", "INTEGRATE", "Use verified machine events only through an approved data source."),
            ("05", "PILOT", "Pilot with one small residence-hall group before campus expansion."),
        ]
        for i, (num, label, body) in enumerate(roadmap):
            y = 2.02 + i * 0.75
            add_badge(slide, num, 0.80, y, 0.58)
            add_text(slide, label, 1.62, y + 0.05, 1.55, 0.27, 12, GOLD_DARK, True)
            add_text(slide, body, 3.18, y + 0.01, 8.85, 0.42, 16.5, INK, True, valign=MSO_ANCHOR.MIDDLE)
            if i < 4:
                add_rect(slide, 1.62, y + 0.54, 10.43, 0.02, LINE, LINE, radius=False)

        # 13 — Team / thank you
        slide = add_slide_base(prs, dark=True, number=13, disclosure=False)
        slide.shapes.add_picture(str(creator_crop), Inches(0), Inches(0), Inches(5.85), Inches(7.5))
        add_rect(slide, 5.50, 0, 0.62, 7.5, CHARCOAL, CHARCOAL, radius=False)
        add_badge(slide, "MERP", 6.38, 0.76, 0.88, fill="35372F", color=GOLD)
        add_text(slide, "Thank you.", 6.38, 1.40, 5.60, 0.78, 39, WHITE, True)
        add_rich_text(slide, [("Fresh habits. ", False, WHITE), ("Friendly competition.", True, GOLD)],
                      6.42, 2.38, 5.55, 0.58, 22)
        add_text(slide, "Marcus Withers\nEddie Wuerthele\nRupika Chakka\nPritham Singh",
                 6.42, 3.35, 3.05, 1.55, 15.5, "D8D4C9", True)
        add_link_text(slide, "TRY IT  ·  launderstat.vercel.app/demo", DEMO_URL, 6.42, 5.36, 5.42, 0.30, 12.5, dark=True)
        add_link_text(slide, "CODE  ·  github.com/JugPanda/Launder-Board", REPO_URL, 6.42, 5.87, 5.42, 0.30, 12.5, dark=True)
        add_text(slide, "Student-built synthetic showcase · Not affiliated with or endorsed by Purdue, University Residences, CSC ServiceWorks, CSCPay, or Typesense.",
                 6.42, 6.42, 5.55, 0.52, 8.2, "98968E")

        # 14 — final QR
        slide = add_slide_base(prs, dark=True, number=14, disclosure=False)
        add_badge(slide, "LIVE SYNTHETIC DEMO", 5.34, 0.54, 2.68, fill="35372F", color=GOLD)
        add_text(slide, "What’s your LaundroStat?", 1.28, 1.23, 10.78, 0.68, 34, WHITE, True, PP_ALIGN.CENTER)
        add_text(slide, "Scan to explore the Clean-O-Meter, Wash Mates, and Dorm Wars.",
                 1.55, 1.95, 10.25, 0.42, 16, "D8D4C9", False, PP_ALIGN.CENTER)
        add_rect(slide, 4.68, 2.55, 3.98, 3.98, WHITE, WHITE)
        slide.shapes.add_picture(str(qr_path), Inches(5.03), Inches(2.90), Inches(3.28), Inches(3.28))
        add_link_text(slide, "laundrostat.vercel.app/demo", DEMO_URL, 3.95, 6.70, 5.45, 0.32, 14, dark=True)

        prs.save(PPTX_PATH)
        print(PPTX_PATH)
        print(qr_path)


if __name__ == "__main__":
    make_deck()
