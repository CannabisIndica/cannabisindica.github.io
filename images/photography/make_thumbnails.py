"""
Generates compressed thumbnails for the photography grid.

WHAT IT DOES
------------
Reads every .jpg in a source folder (your full-resolution originals) and
writes a resized, compressed copy with the SAME filename into a "thumbs"
subfolder. The grid on your site will load these small thumbnails; the
lightbox (when someone clicks a photo) will load the original full-res file.

SETUP (one-time)
-----------------
1. Install Python from https://python.org if you don't have it.
2. Install Pillow:
       pip install Pillow

USAGE
-----
1. Put this script in the same folder as your images, OR edit SOURCE_DIR
   below to point at wherever your DSFC####.jpg files live.
2. Run:
       python make_thumbnails.py
3. It creates a "thumbs" folder next to your originals. Upload BOTH the
   originals folder and the thumbs folder to your repo (see instructions
   in the chat for exact paths).

You can re-run this any time you add new photos — it skips files that
already have a thumbnail unless you delete the old thumbnail first.
"""

import os
from PIL import Image, ImageOps

# ---- Settings you can tweak ----
SOURCE_DIR = "."              # folder containing your full-res DSFC####.jpg files
THUMB_DIR = "thumbs"          # subfolder that will hold the compressed copies
MAX_DIMENSION = 900           # longest side of the thumbnail, in pixels
JPEG_QUALITY = 70             # 1-95, lower = smaller file, more compression artifacts
# ---------------------------------

def main():
    source_path = os.path.abspath(SOURCE_DIR)
    thumb_path = os.path.join(source_path, THUMB_DIR)
    os.makedirs(thumb_path, exist_ok=True)

    jpgs = [
        f for f in os.listdir(source_path)
        if f.lower().endswith((".jpg", ".jpeg")) and os.path.isfile(os.path.join(source_path, f))
    ]

    if not jpgs:
        print(f"No .jpg files found in {source_path}. Check SOURCE_DIR.")
        return

    made, skipped = 0, 0

    for filename in jpgs:
        src_file = os.path.join(source_path, filename)
        dst_file = os.path.join(thumb_path, filename)

        if os.path.exists(dst_file):
            skipped += 1
            continue

        with Image.open(src_file) as img:
            # Many cameras save image data in the sensor's native landscape
            # orientation and rely on a hidden EXIF tag to say "rotate this
            # for display." Pillow drops that tag by default when saving a
            # new file, which would leave the thumbnail's actual pixels
            # sideways even though nothing looks wrong when you preview it
            # in a normal photo viewer (which does respect the tag). This
            # bakes the correct rotation into the real pixel data first, so
            # the saved thumbnail is correctly oriented no matter what.
            img = ImageOps.exif_transpose(img)
            img = img.convert("RGB")  # handles any CMYK/PNG-in-jpg edge cases
            img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.LANCZOS)
            img.save(dst_file, "JPEG", quality=JPEG_QUALITY, optimize=True)

        made += 1
        print(f"  {filename} -> thumbs/{filename}")

    print(f"\nDone. Created {made} thumbnails, skipped {skipped} that already existed.")
    print(f"Thumbnails are in: {thumb_path}")

if __name__ == "__main__":
    main()