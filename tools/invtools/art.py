"""Drawings for case packs: the fictional town map and simple SVG scenes.

Every image here is drawn from shapes in code. There are no real faces,
places or photographs, and no scripts or external links in the SVG.
"""
from __future__ import annotations


def kestrel_bay_map(locations: list[dict]) -> dict:
    """The invented town of Kestrel Bay, 6 km by 4 km, in metres."""
    A = lambda name, style, pts: {"kind": "area", "name": name, "style": style, "points": pts}
    R = lambda kind, name, pts: {"kind": kind, "name": name, "points": pts}
    features = [
        A("Kestrel Bay", "water", [[0, 3600], [6000, 3500], [6000, 4000], [0, 4000]]),
        A("Heronmere Woods", "woodland", [[600, 150], [2300, 120], [2350, 1150], [700, 1250]]),
        A("Gullstone Quarry (disused)", "industrial", [[2450, 550], [3050, 520], [3100, 1050], [2480, 1100]]),
        A("Moorend Industrial Estate", "industrial", [[4800, 950], [5850, 900], [5900, 1800], [4850, 1850]]),
        A("Brackenfield", "residential", [[3650, 2750], [4650, 2700], [4700, 3300], [3700, 3350]]),
        A("Old Harbour", "commercial", [[2700, 2950], [3550, 2950], [3600, 3500], [2700, 3550]]),
        A("Town centre", "commercial", [[2350, 2380], [3850, 2380], [3850, 2780], [2350, 2780]]),
        A("Saltings Park", "park", [[1500, 2850], [2400, 2850], [2450, 3450], [1500, 3500]]),
        A("Marina", "retail", [[3800, 3360], [4500, 3340], [4520, 3560], [3820, 3580]]),
        A("Fernlea", "residential", [[4400, 2100], [5200, 2050], [5250, 2550], [4450, 2600]]),
        R("river", "River Kest", [[3050, 0], [2950, 600], [3150, 1300], [3000, 2000], [3200, 2700], [3250, 3600]]),
        R("rail", "Railway", [[0, 2200], [2000, 2180], [4000, 2230], [6000, 2150]]),
        R("major_road", "Ring Road", [[1800, 2000], [3200, 1850], [4700, 2000], [4900, 2700], [4500, 3250], [2400, 3300], [1700, 2800], [1800, 2000]]),
        R("road", "High Street", [[2200, 2600], [3000, 2600], [3800, 2620], [4300, 2600]]),
        R("road", "Harbour Road", [[3000, 2600], [3150, 3000], [3300, 3450]]),
        R("road", "Quarry Road", [[2650, 2600], [2600, 1900], [2350, 1150], [2050, 700], [1500, 500]]),
        R("road", "Moor Lane", [[4300, 2600], [4700, 2300], [5000, 2000], [5400, 1500]]),
        R("road", "Bracken Way", [[3800, 2620], [4000, 2900], [4150, 3050], [4400, 3200]]),
        R("road", "Marina Drive", [[3300, 3450], [3800, 3450], [4300, 3450]]),
        R("road", "Lodge Track", [[1500, 500], [1300, 520], [1100, 600]]),
        R("road", "Heron Lane", [[2050, 700], [1900, 900], [1700, 1050]]),
    ]
    return {"name": "Kestrel Bay", "width": 6000, "height": 4000, "features": features, "locations": locations}


def _svg(w, h, body, bg="#dfe8ee"):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">'
            f'<rect width="{w}" height="{h}" fill="{bg}"/>{body}</svg>\n')


def _tree(x, y, s=1.0, c="#2f5d3a"):
    return (f'<rect x="{x - 4 * s}" y="{y}" width="{8 * s}" height="{26 * s}" fill="#5b4632"/>'
            f'<polygon points="{x},{y - 60 * s} {x + 28 * s},{y + 6 * s} {x - 28 * s},{y + 6 * s}" fill="{c}"/>'
            f'<polygon points="{x},{y - 85 * s} {x + 20 * s},{y - 30 * s} {x - 20 * s},{y - 30 * s}" fill="{c}"/>')


def cabin_view(sign=True, tower_text="GULLSTONE", dusk=False):
    """View from a cabin deck across woodland to a lettered water tower."""
    sky = "#f1c99b" if dusk else "#cfe0ea"
    body = [f'<rect width="800" height="330" fill="{sky}"/>',
            '<rect y="300" width="800" height="300" fill="#6f8f5e"/>',
            '<path d="M0 330 Q200 290 400 320 T800 310 L800 600 L0 600Z" fill="#59784b"/>',
            # water tower on the horizon
            '<rect x="560" y="170" width="6" height="130" fill="#7a7f86"/><rect x="610" y="170" width="6" height="130" fill="#7a7f86"/>',
            '<line x1="563" y1="300" x2="613" y2="200" stroke="#7a7f86" stroke-width="3"/><line x1="613" y1="300" x2="563" y2="200" stroke="#7a7f86" stroke-width="3"/>',
            '<ellipse cx="588" cy="150" rx="58" ry="40" fill="#c9ccd1"/><rect x="530" y="150" width="116" height="24" fill="#c9ccd1"/>',
            f'<text x="588" y="160" font-family="Arial" font-size="15" font-weight="700" text-anchor="middle" fill="#6a2c2c">{tower_text}</text>']
    for x, y, s in [(60, 330, 1.3), (130, 345, 1.1), (210, 335, 1.4), (300, 350, 1.0), (380, 340, 1.2), (690, 345, 1.1), (760, 330, 1.4), (470, 352, 0.9)]:
        body.append(_tree(x, y, s))
    if sign:
        body.append('<rect x="70" y="420" width="10" height="120" fill="#5b4632"/><rect x="260" y="420" width="10" height="120" fill="#5b4632"/>'
                    '<rect x="40" y="380" width="260" height="70" rx="6" fill="#3f5b3a" stroke="#e8dfc8" stroke-width="3"/>'
                    '<text x="170" y="408" font-family="Georgia" font-size="20" text-anchor="middle" fill="#f3ead2">HERONMERE LODGES</text>'
                    '<text x="170" y="432" font-family="Arial" font-size="13" text-anchor="middle" fill="#f3ead2">Residents only · Cabins 5-9 →</text>')
    body.append('<rect y="545" width="800" height="12" fill="#8a6a48"/><rect y="520" width="800" height="8" fill="#8a6a48"/>')
    for x in range(0, 800, 60):
        body.append(f'<rect x="{x}" y="515" width="8" height="45" fill="#7a5c3e"/>')
    body.append('<rect x="610" y="470" width="60" height="50" rx="8" fill="#f4f1ea"/><path d="M670 482 q18 4 0 22" stroke="#f4f1ea" stroke-width="6" fill="none"/>')
    return _svg(800, 600, "".join(body))


def marina_view():
    body = ['<rect width="800" height="300" fill="#bcd7ea"/><rect y="300" width="800" height="300" fill="#4f7fa3"/>',
            '<rect x="0" y="380" width="800" height="26" fill="#9a8466"/>']
    for x in range(40, 800, 140):
        body.append(f'<polygon points="{x},370 {x + 90},370 {x + 70},392 {x + 20},392" fill="#f4f4f4"/><line x1="{x + 45}" y1="370" x2="{x + 45}" y2="250" stroke="#ddd" stroke-width="3"/>'
                    f'<polygon points="{x + 47},255 {x + 47},360 {x + 95},360" fill="#fafafa"/>')
    body.append('<circle cx="660" cy="90" r="40" fill="#f6e7a6"/>')
    return _svg(800, 600, "".join(body))


def silhouette(colour="#5a6b7d", hair="#2d2a26"):
    """A plain silhouette used where a case needs a 'photo' of a person."""
    body = (f'<rect width="400" height="500" fill="#e7e3da"/>'
            f'<circle cx="200" cy="190" r="85" fill="{colour}"/>'
            f'<path d="M110 180 Q120 90 200 90 Q285 90 292 185 Q260 120 200 125 Q140 125 110 180Z" fill="{hair}"/>'
            f'<path d="M60 500 Q70 320 200 310 Q330 320 340 500Z" fill="{colour}"/>'
            '<text x="200" y="480" font-family="Arial" font-size="16" text-anchor="middle" fill="#ffffff">No photograph included</text>')
    return _svg(400, 500, body, "#e7e3da")


def landscape(title_text="", hue="#7a9a6a"):
    body = [f'<rect width="800" height="300" fill="#d8e6ee"/><path d="M0 300 L180 160 L330 290 L470 140 L650 280 L800 200 L800 600 L0 600Z" fill="{hue}"/>',
            '<path d="M0 420 Q400 360 800 430 L800 600 L0 600Z" fill="#59784b"/>']
    for x in range(30, 800, 90):
        body.append(_tree(x, 470 + (x % 3) * 8, 0.8))
    if title_text:
        body.append(f'<text x="20" y="40" font-family="Arial" font-size="22" fill="#33475b">{title_text}</text>')
    return _svg(800, 600, "".join(body))


def tower_road_view():
    """The same water tower seen from the road, as a landscape photographer might post it."""
    body = ['<rect width="800" height="380" fill="#e4d3b8"/><rect y="360" width="800" height="240" fill="#a39272"/>',
            '<polygon points="330,600 470,600 420,360 380,360" fill="#55555a"/><line x1="400" y1="600" x2="400" y2="365" stroke="#e8e2d0" stroke-width="4" stroke-dasharray="20 18"/>',
            '<rect x="520" y="150" width="7" height="210" fill="#7a7f86"/><rect x="590" y="150" width="7" height="210" fill="#7a7f86"/>',
            '<ellipse cx="558" cy="120" rx="80" ry="52" fill="#c9ccd1"/><rect x="478" y="120" width="160" height="34" fill="#c9ccd1"/>',
            '<text x="558" y="135" font-family="Arial" font-size="20" font-weight="700" text-anchor="middle" fill="#6a2c2c">GULLSTONE</text>']
    for x, y in [(80, 380), (160, 390), (240, 372), (690, 385), (760, 375)]:
        body.append(_tree(x, y, 1.1, "#3f6b45"))
    body.append('<rect x="150" y="440" width="150" height="40" fill="#f2f2f2" stroke="#222"/><text x="225" y="466" font-family="Arial" font-size="16" text-anchor="middle">Lodge Track</text>')
    return _svg(800, 600, "".join(body))
