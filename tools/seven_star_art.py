"""Build the character study using the same assets and renderers as the homepage."""
from pathlib import Path
import runpy
ROOT = Path(__file__).resolve().parents[1]
def preview():
    return runpy.run_path(str(ROOT/'tools/character_gallery.py'))['gallery']('seven-star')
if __name__ == '__main__':
    (ROOT/'seven-star-preview.html').write_text(preview(), encoding='utf-8')
