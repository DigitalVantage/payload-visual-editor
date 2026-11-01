# -*- coding: utf-8 -*-
"""Diagrams for the README, written to docs/media/.

`python3 -B docs/diagrams/build.py` regenerates every SVG. Conventions follow
the Digital Vantage figure playbook: 790px wide, dark ground, no visible title
(the README caption carries it), <title>/<desc> for screen readers, credit
bottom right, height computed from the layout.
"""
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / 'media'
BG, FG, MUTED = '#0a0907', '#f5f1ea', '#9ca3af'
GOLD, BLUE, GREEN, GRID = '#d4a04a', '#7aa2c4', '#6ba368', '#6b7280'
BOX, BOX2 = '#1a1712', '#12100c'
F = "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"
W = 790
LEFT, RIGHT = 30, W - 30
CREDIT = 'www.digitalvantage.pl'


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def text_width(s, size):
    return 0.55 * size * len(s)


def txt(x, y, s, size=13, fill=FG, weight='400', anchor='start'):
    left = x if anchor == 'start' else (x - text_width(s, size) / 2 if anchor == 'middle' else x - text_width(s, size))
    assert LEFT - 2 <= left and left + text_width(s, size) <= RIGHT + 2, f'text out of frame: {s!r}'
    return (f'<text x="{x:.1f}" y="{y:.1f}" fill="{fill}" font-family="{F}" font-size="{size}" '
            f'font-weight="{weight}" text-anchor="{anchor}">{esc(s)}</text>')


def rect(x, y, w, h, fill=BOX, stroke=GRID, rx=8, dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ''
    return (f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" '
            f'fill="{fill}" stroke="{stroke}"{d}/>')


def arrow(x1, y1, x2, y2, color):
    """Straight arrow with a filled head at (x2, y2)."""
    import math
    angle = math.atan2(y2 - y1, x2 - x1)
    size = 7
    hx, hy = x2 - size * math.cos(angle), y2 - size * math.sin(angle)
    left = (hx - size * 0.6 * math.sin(angle), hy + size * 0.6 * math.cos(angle))
    right = (hx + size * 0.6 * math.sin(angle), hy - size * 0.6 * math.cos(angle))
    return (f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{hx:.1f}" y2="{hy:.1f}" stroke="{color}" stroke-width="2"/>'
            f'<polygon points="{x2:.1f},{y2:.1f} {left[0]:.1f},{left[1]:.1f} {right[0]:.1f},{right[1]:.1f}" '
            f'fill="{color}"/>')


def svg(name, title, desc, body, height):
    out = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{height}" '
           f'viewBox="0 0 {W} {height}" role="img" aria-labelledby="t d">'
           f'<title id="t">{esc(title)}</title><desc id="d">{esc(desc)}</desc>'
           f'<rect width="{W}" height="{height}" fill="{BG}"/>' + ''.join(body) +
           txt(RIGHT, height - 14, CREDIT, size=11, fill=MUTED, anchor='end') + '</svg>\n')
    (OUT / name).write_text(out, encoding='utf-8')
    print(f'wrote {OUT / name}')


def card(x, y, w, heading, lines, accent):
    """A component box: heading plus muted lines; returns (svg, height)."""
    h = 22 + 18 + 17 * len(lines) + 4
    parts = [rect(x, y, w, h, fill=BOX2, stroke=accent),
             txt(x + 14, y + 26, heading, size=14, weight='600')]
    parts += [txt(x + 14, y + 46 + 17 * i, line, size=12, fill=MUTED) for i, line in enumerate(lines)]
    return parts, h


def architecture():
    pad, gap = 16, 24
    inner_left = LEFT + pad
    col_w = (RIGHT - pad - inner_left - 2 * gap) / 3
    col = [inner_left + i * (col_w + gap) for i in range(3)]
    body = []
    y = 24

    # Admin frame
    admin_top = y
    y += 34
    cards = [
        ('Visual editor plugin', ['controller · popovers', 'undo / redo history'], BLUE),
        ('Document form', ['native Payload fields', 'save · autosave · locales'], GRID),
        ('Live Preview', ['stock Payload,', 'renders the iframe'], GOLD),
    ]
    heights = []
    for i, (heading, lines, accent) in enumerate(cards):
        parts, h = card(col[i], y, col_w, heading, lines, accent)
        body += parts
        heights.append(h)
    row_h = max(heights)
    mid = y + row_h / 2
    body.append(arrow(col[0] + col_w + 3, mid, col[1] - 3, mid, BLUE))
    body.append(arrow(col[1] + col_w + 3, mid, col[2] - 3, mid, GRID))
    y += row_h + pad
    body.insert(0, rect(LEFT, admin_top, RIGHT - LEFT, y - admin_top, fill=BOX))
    body.insert(1, txt(LEFT + pad, admin_top + 22, 'Payload admin', size=12, fill=MUTED, weight='600'))
    admin_bottom = y

    # Channels between the frames
    lane_h = 112
    site_top = admin_bottom + lane_h
    card_bottom, card_top = admin_bottom - pad, site_top + pad
    ax_down, ax_up = col[0] + 22, col[0] + 42
    # Drawn last, so the site frame does not cover them
    channels = [arrow(ax_down, card_bottom, ax_down, card_top - 1, BLUE),
                arrow(ax_up, card_top, ax_up, card_bottom + 1, GREEN)]
    label_x = col[0] + 60
    body += [txt(label_x, admin_bottom + 26, 'admin → page', size=12, fill=BLUE, weight='600'),
             txt(label_x, admin_bottom + 43, 'hello · edit-mode · focus · op-ack', size=12, fill=MUTED),
             txt(label_x, admin_bottom + 70, 'page → admin', size=12, fill=GREEN, weight='600'),
             txt(label_x, admin_bottom + 87, 'select · op · reveal · history', size=12, fill=MUTED)]
    gx = col[2] + 22
    channels.append(arrow(gx, card_bottom, gx, card_top - 1, GOLD))
    body += [txt(gx + 18, admin_bottom + 43, 'document data', size=12, fill=GOLD, weight='600'),
             txt(gx + 18, admin_bottom + 60, 'stock Live Preview', size=12, fill=MUTED),
             txt(gx + 18, admin_bottom + 77, 'messages, untouched', size=12, fill=MUTED)]

    # Site frame
    # The site label goes under its cards: the channel arrows land on the cards' top edge
    y = site_top + pad
    sdk_parts, sdk_h = card(col[0], y, col_w, 'Site SDK', ['scanner · overlay', 'chip · drag · keys'], BLUE)
    pages_w = col[2] + col_w - col[1]
    page_parts, page_h = card(col[1], y, pages_w, 'Your pages',
                              ['components marked with data-pve-* attributes,',
                               'rendered from the Live Preview data'], GOLD)
    row_h = max(sdk_h, page_h)
    site_parts = [rect(LEFT, site_top, RIGHT - LEFT, pad + row_h + 34, fill=BOX),
                  txt(LEFT + pad, site_top + pad + row_h + 23, 'Your site · Live Preview iframe', size=12,
                      fill=MUTED, weight='600')]
    body += site_parts + sdk_parts + page_parts
    mid = y + row_h / 2
    body.append(arrow(col[1] - 3, mid, col[0] + col_w + 3, mid, GRID))
    y += row_h + 34
    body += channels

    y += 30
    body.append(txt(LEFT, y, 'The editor channel carries intent and metadata only; document data never leaves the',
                    size=12, fill=MUTED))
    body.append(txt(LEFT, y + 18, 'stock pipeline. postMessage uses an explicit target origin and a per-load session id.',
                    size=12, fill=MUTED))
    height = int(y + 18 + 40)

    svg('architecture.svg',
        'How the visual editor talks to your site',
        'The Payload admin holds the visual editor plugin, the document form and the stock Live Preview, which '
        'renders your site in an iframe. Document data reaches the page only through the stock Live Preview '
        'messages. A separate editor channel carries intent: the admin sends hello, edit-mode, focus and op-ack; '
        'the page sends select, op, reveal and history. In the iframe, the site SDK scans elements marked with '
        'data-pve-* attributes and draws the overlay.',
        body, height)


if __name__ == '__main__':
    architecture()
