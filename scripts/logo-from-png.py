# Готовит логотип из PNG владельца (design/logo-bolt/logo-owner.png, 460×460 на сером #f3f3f3):
# серый фон → прозрачность (линия непрозрачная, сглаженные края сохраняются), обрезка по знаку.
# Знак не перерисовывается. Результат: public/brand/logo.png
# Запуск: uv run --with pillow --with numpy python scripts/logo-from-png.py
from pathlib import Path
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parent.parent
src = Image.open(root / 'design/logo-bolt/logo-owner.png').convert('RGBA')
c = np.asarray(src).astype(np.float64)[..., :3]
bg = np.array([243.0, 243.0, 243.0])

# Прозрачность — по удалённости от фона: сама линия (отличие ≥ 60) полностью непрозрачна,
# прозрачными становятся только сглаженные края; их цвет очищаем от примеси серого.
dist = np.abs(c - bg).max(axis=2)
alpha = np.clip(dist / 60.0, 0, 1)
safe = np.where(alpha > 0, alpha, 1)[..., None]
rgb = np.clip((c - bg * (1 - alpha[..., None])) / safe, 0, 255)
out = np.dstack([rgb, alpha * 255]).round().astype(np.uint8)
img = Image.fromarray(out, 'RGBA')

# Обрезка по знаку с полем 4 px
box = img.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
pad = 4
box = (max(box[0] - pad, 0), max(box[1] - pad, 0), min(box[2] + pad, img.width), min(box[3] + pad, img.height))
img = img.crop(box)
dst = root / 'public/brand/logo.png'
img.save(dst, optimize=True)
print(dst.relative_to(root), img.size)
