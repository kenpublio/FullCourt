from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

src = Path(r"C:\Pictures\CAPSTONE 2\tmp\pdfs\rendered-guide")
def page_number(path):
    return int(path.stem.rsplit("-", 1)[-1])

pages = list(src.glob("page-*.png"))
pages = sorted(pages, key=page_number)
thumbs = []
for i, path in enumerate(pages, 1):
    im = Image.open(path).convert("RGB")
    im.thumbnail((360, 255))
    tile = Image.new("RGB", (380, 290), "white")
    tile.paste(im, ((380-im.width)//2, 22))
    ImageDraw.Draw(tile).text((12, 5), f"Page {i}", fill="black")
    tile = ImageOps.expand(tile, border=1, fill="#777777")
    thumbs.append(tile)

cols = 2
rows = (len(thumbs) + cols - 1) // cols
sheet = Image.new("RGB", (cols * 382, rows * 292), "#dddddd")
for i, tile in enumerate(thumbs):
    sheet.paste(tile, ((i % cols) * 382, (i // cols) * 292))
sheet.save(src / "contact-sheet.png")
