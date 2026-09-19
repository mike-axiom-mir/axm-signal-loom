from __future__ import annotations

from html import escape

from .model import CreativityPacket


def svg_preview(
    packet: CreativityPacket, *, width: int = 960, height: int = 540
) -> str:
    """Render a cheap inspection preview. This is not a production art renderer."""
    values = packet.field.values
    margin = 36
    usable_w = width - margin * 2
    usable_h = height - margin * 2
    mid_y = height / 2
    step = usable_w / max(1, len(values) - 1)

    points = []
    for index, value in enumerate(values):
        x = margin + index * step
        y = mid_y - value * (usable_h * 0.38)
        points.append(f"{x:.2f},{y:.2f}")

    rings = []
    stride = max(1, len(values) // 12)
    for index, value in enumerate(values[::stride]):
        cx = margin + (index + 0.5) * (usable_w / 12)
        radius = 8 + abs(value) * 44
        opacity = 0.18 + abs(value) * 0.5
        rings.append(
            f'<circle cx="{cx:.2f}" cy="{mid_y:.2f}" r="{radius:.2f}" '
            f'fill="none" stroke="currentColor" stroke-opacity="{opacity:.3f}" />'
        )

    title = escape(packet.request)
    short_fp = packet.fingerprint[:12]
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-label="Signal Loom draft {packet.draft}">
  <rect width="100%" height="100%" fill="#0b0d12" />
  <g color="#9bdcff">{''.join(rings)}</g>
  <polyline points="{' '.join(points)}" fill="none" stroke="#f5f7ff" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" />
  <text x="{margin}" y="{height - 46}" fill="#f5f7ff" font-family="monospace" font-size="20">{title}</text>
  <text x="{margin}" y="{height - 20}" fill="#9aa4b2" font-family="monospace" font-size="14">seed={packet.seed} draft={packet.draft} chaos={packet.chaos:.2f} fp={short_fp}</text>
</svg>'''
