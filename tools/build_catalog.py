"""
Chi-Best catalog builder
------------------------
Turns the raw supplier photos in /images into web-optimised, square product
images in /images/catalog, and generates the seed catalog used by the store:

  - js/catalog.js        (seed data for the in-browser demo mode)
  - database/seed.sql    (the same catalog for Supabase)

Prices, costs and stock levels below are PLACEHOLDERS. Edit real values in
the admin dashboard once the store is running; this file only seeds a fresh
install.

Run from the project root:   python tools/build_catalog.py
Requires Pillow + numpy:     pip install pillow numpy
"""
import json
import os
import sys
from datetime import datetime, timedelta, timezone

import numpy as np
from PIL import Image, ImageFilter, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "images")
OUT = os.path.join(ROOT, "images", "catalog")
FULL, SMALL = 1000, 480
FORCE = "--force" in sys.argv

# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------
CATEGORIES = [
    ("kids-clothing", "Kids' Clothing", "KC", "Sets, dresses and everyday tees for little ones.", "girls-ruffle-bow-dress"),
    ("kids-shoes", "Kids' Shoes", "KS", "Boots, sneakers, sandals and party shoes from baby to big kid.", "kids-heart-zip-boots"),
    ("kids-accessories", "Kids' Toys & Accessories", "KA", "School bags, watches, sunglasses, hair sets and rides.", "kids-round-sunglasses"),
    ("womens-fashion", "Women's Fashion", "WF", "Co-ords, denim, trousers and statement layers.", "waistcoat-wide-leg-set"),
    ("shoes", "Shoes & Sandals", "SH", "Wedges, platforms, slides and everyday sneakers.", "gold-sequin-wedge-slides"),
    ("bags", "Bags & Purses", "BG", "Totes, crossbodies, clutches and mini bags.", "wave-shoulder-bag"),
    ("beauty", "Beauty & Fragrance", "BT", "Skincare, body care, hair and perfumes.", "oud-perfume-gift-box"),
    ("home-kitchen", "Home & Kitchen", "HK", "Appliances, cookware and everyday home essentials.", "retro-electric-oven"),
    ("gadgets", "Gadgets & Power", "GE", "Earbuds, rechargeable fans and solar lighting.", "pebble-wireless-earbuds"),
]

KIDS_AGES = ["2-3Y", "3-4Y", "4-5Y", "5-6Y", "6-7Y", "7-8Y"]
WOMEN = ["S", "M", "L", "XL"]
KID_SHOE = [str(s) for s in range(26, 37)]
TODDLER_SHOE = [str(s) for s in range(15, 26)]
SMALL_KID_SHOE = [str(s) for s in range(21, 31)]
WOMEN_SHOE = [str(s) for s in range(36, 42)]
UNISEX_SHOE = [str(s) for s in range(37, 45)]


def opt(name, values):
    return {"name": name, "values": values}


def img(name, crop=None):
    """crop = (left, top, right, bottom) in source pixels."""
    return {"src": name, "crop": crop}


W = lambda n: f"IMG-20260613-WA{n}.jpg"  # noqa: E731

# ---------------------------------------------------------------------------
# Products: (slug, name, category, price, compare_at, cost, stock, options,
#            images, extras)
# extras keys: badge, featured, preorder, lead, tags, brand, desc, low
# ---------------------------------------------------------------------------
P = []


def add(slug, name, cat, price, compare, cost, stock, options, images, **x):
    P.append(dict(slug=slug, name=name, cat=cat, price=price, compare=compare,
                  cost=cost, stock=stock, options=options, images=images, **x))


# Kids' clothing ------------------------------------------------------------
add("girls-daisy-hoodie-skirt-set", "Girls' Daisy Hoodie & Pleated Skirt Set", "kids-clothing",
    18500, 23000, 10500, 14, [opt("Size", KIDS_AGES)], [img("IMG-20260611-WA0003.jpg")],
    badge="New", featured=True, tags=["girls", "sets"],
    desc="Cosy black hoodie decorated with colourful 3D daisies, paired with a pleated pink skirt. A playful two-piece for outings, birthdays and weekends.")
add("girls-heart-cardigan-skirt-set", "Girls' Heart Knit Cardigan & Skirt Set", "kids-clothing",
    21000, 26500, 12000, 9, [opt("Size", KIDS_AGES)], [img("IMG-20260611-WA0038.jpg")],
    tags=["girls", "sets", "christmas"],
    desc="Soft knit cardigan with a red-and-white heart pattern and frilled collar, paired with a flared red skirt. Lovely for Christmas, church and family photos.")
add("girls-graphic-tee-2-pack", "Girls' Graphic Tee 2-Pack", "kids-clothing",
    9500, 12000, 5200, 30, [opt("Size", KIDS_AGES)], [img("IMG-20260612-WA0005.jpg")],
    tags=["girls", "tees", "bundle"],
    desc="Two cotton T-shirts: a black butterfly print and a pink 'Blossom' print. Easy everyday tees for school runs and play.")
add("boys-graphic-tee-3-pack", "Boys' Graphic Tee 3-Pack", "kids-clothing",
    12500, 15500, 7000, 26, [opt("Size", KIDS_AGES)], [img("IMG-20260612-WA0006.jpg")],
    badge="Bundle", tags=["boys", "tees", "bundle"],
    desc="Three bold printed cotton tees in black, yellow and red. Great value for everyday wear.")
add("boys-logo-tee-shorts-set", "Boys' Logo Tee & Shorts Set", "kids-clothing",
    14000, None, 7800, 12, [opt("Size", KIDS_AGES)], [img(W("0015"))],
    tags=["boys", "sets"],
    desc="Bright blue T-shirt with matching black shorts. A comfortable two-piece for hot days.")
add("girls-varsity-blazer-skirt-set", "Girls' Varsity Blazer & Skirt Set", "kids-clothing",
    24500, 30000, 14000, 8, [opt("Colour", ["Black", "Pink"]), opt("Size", KIDS_AGES)],
    [img(W("0020"), (0, 130, 561, 640)), img(W("0020"), (0, 690, 561, 1188))],
    featured=True, tags=["girls", "sets", "party"],
    desc="Preppy varsity-style jacket with a collared shirt, tie and pleated skirt. A smart, stand-out look for parties and special occasions.")
add("kids-striped-shirt-shorts-set", "Kids' Striped Shirt & Shorts Set", "kids-clothing",
    15500, None, 8600, 11, [opt("Size", KIDS_AGES)], [img(W("0036"))],
    tags=["sets", "summer"],
    desc="Light, breathable striped shirt and shorts in sky blue. A crisp outfit for warm days.")
add("girls-floral-shirt-shorts-set", "Girls' Floral Shirt & Shorts Set", "kids-clothing",
    13500, 17000, 7400, 15, [opt("Size", KIDS_AGES)], [img(W("0060"))],
    tags=["girls", "sets", "summer"],
    desc="Sleeveless pink floral shirt with matching shorts. Breezy, bright and easy to wear.")
add("boys-knit-stripe-set", "Boys' Knit Stripe Shirt & Shorts Set", "kids-clothing",
    16000, None, 9000, 10, [opt("Size", KIDS_AGES)], [img(W("0067"))],
    tags=["boys", "sets"],
    desc="Textured black-and-white striped knit shirt with matching shorts. A smart-casual set for outings.")
add("girls-ruffle-bow-dress", "Girls' Ruffle Bow Party Dress", "kids-clothing",
    19500, 25000, 10800, 18, [opt("Colour", ["Red", "Pink", "White"]), opt("Size", KIDS_AGES)], [img(W("0076"))],
    badge="Bestseller", featured=True, tags=["girls", "dresses", "party"],
    desc="Tiered ruffle dress with an oversized bow, available in red, pink and white. Made for birthdays, weddings and celebrations.")
add("girls-denim-maxi-dress", "Girls' Denim Maxi Dress", "kids-clothing",
    17500, None, 9800, 0, [opt("Size", KIDS_AGES)], [img(W("0090"))],
    preorder=True, tags=["girls", "dresses", "denim"],
    desc="Sleeveless button-front denim maxi dress with a belted waist. A cool, grown-up look for little trendsetters.")

# Kids' shoes ---------------------------------------------------------------
add("kids-heart-zip-boots", "Kids' Heart Zip Combat Boots", "kids-shoes",
    24500, 29000, 13500, 16, [opt("Colour", ["Pink", "Black"]), opt("Size", KID_SHOE)], [img("IMG-20260611-WA0004.jpg")],
    badge="Bestseller", featured=True, tags=["girls", "boots"],
    desc="Chunky lace-up boots with a side zip for easy on and off, finished with heart patches and a chain detail.")
add("kids-retro-high-top-sneakers", "Kids' Retro High-Top Sneakers", "kids-shoes",
    19500, None, 10800, 20, [opt("Colour", ["Pink", "Black"]), opt("Size", KID_SHOE)], [img("IMG-20260611-WA0032.jpg")],
    tags=["sneakers"],
    desc="Retro-striped high-tops with a hook-and-loop strap and laces. Comfortable for school and play.")
add("baby-sparkle-bow-sandals", "Baby Sparkle Bow Sandals", "kids-shoes",
    11500, None, 6200, 22, [opt("Colour", ["Black", "White", "Pink"]), opt("Size", TODDLER_SHOE)], [img("IMG-20260611-WA0033.jpg")],
    tags=["baby", "sandals"],
    desc="Soft-soled sandals with a sparkling bow and easy strap closure. Pretty and practical for first walkers.")
add("baby-pearl-bow-mary-janes", "Baby Pearl Bow Mary Janes", "kids-shoes",
    12500, None, 6800, 3, [opt("Colour", ["Black", "White"]), opt("Size", TODDLER_SHOE)], [img(W("0010"))],
    tags=["baby", "party"],
    desc="Glossy Mary Janes with a satin bow and pearl strap. Perfect for dedications, parties and church.")
add("kids-character-lace-up-boots", "Kids' Character Lace-Up Boots", "kids-shoes",
    23000, None, 12800, 12, [opt("Colour", ["Pink", "Black"]), opt("Size", KID_SHOE)], [img(W("0017"))],
    tags=["boots"],
    desc="Lace-up boots with a side zip and a favourite cartoon character print.")
add("kids-velcro-high-top-trainers", "Kids' Velcro High-Top Trainers", "kids-shoes",
    18500, None, 10200, 14, [opt("Colour", ["Brown", "Black"]), opt("Size", KID_SHOE)], [img(W("0023"))],
    tags=["sneakers", "boys"],
    desc="Padded high-top trainers with a hook-and-loop strap. Sturdy, comfortable and easy for kids to fasten.")
add("kids-chunky-sport-sandals", "Kids' Chunky Sport Sandals", "kids-shoes",
    15500, None, 8500, 19, [opt("Colour", ["White", "Black"]), opt("Size", KID_SHOE)], [img(W("0025"))],
    tags=["sandals"],
    desc="Chunky-soled sport sandals with adjustable straps for all-day comfort.")
add("kids-monogram-slip-on-loafers", "Kids' Monogram Slip-On Loafers", "kids-shoes",
    16500, None, 9000, 7, [opt("Colour", ["Grey", "Beige"]), opt("Size", KID_SHOE)], [img(W("0029"))],
    tags=["loafers"],
    desc="Slip-on loafers with a monogram knit upper and pull tab. Smart enough for events, easy enough for every day.")
add("boys-patent-school-shoes", "Boys' Patent School Shoes", "kids-shoes",
    17000, 20000, 9200, 25, [opt("Size", KID_SHOE)], [img(W("0032"))],
    featured=True, badge="Back to school", tags=["boys", "school"],
    desc="Glossy black patent school shoes with a hook-and-loop strap and grippy sole.")
add("kids-velcro-strap-sandals", "Kids' Velcro Strap Sandals", "kids-shoes",
    13500, None, 7400, 16, [opt("Colour", ["Pink", "Cream"]), opt("Size", KID_SHOE)], [img(W("0041"))],
    tags=["sandals", "girls"],
    desc="Cushioned sandals with wide hook-and-loop straps. Secure fit for active kids.")
add("girls-satin-bow-sandals", "Girls' Satin Bow Sandals", "kids-shoes",
    14500, None, 8000, 2, [opt("Size", KID_SHOE)], [img(W("0042"))],
    tags=["girls", "party", "sandals"],
    desc="Silver satin bow sandals with a sparkly sling-back strap. A party-ready finish for any outfit.")
add("girls-pearl-flower-sandals", "Girls' Pearl Flower Sandals", "kids-shoes",
    15000, None, 8200, 10, [opt("Size", KID_SHOE)], [img(W("0045"))],
    tags=["girls", "party", "sandals"],
    desc="White sandals decorated with pearls and flowers on a chunky comfortable sole.")
add("toddler-ribbon-mary-janes", "Toddler Ribbon Mary Janes", "kids-shoes",
    12000, None, 6500, 13, [opt("Colour", ["Black", "White"]), opt("Size", TODDLER_SHOE)], [img(W("0046"))],
    tags=["baby", "party"],
    desc="Classic Mary Janes with a ribbon bow and buckle strap.")
add("kids-light-up-sneakers", "Kids' Light-Up LED Sneakers", "kids-shoes",
    16500, 21000, 8800, 24, [opt("Colour", ["Pink", "Blue"]), opt("Size", SMALL_KID_SHOE)], [img(W("0050"))],
    badge="Hot", featured=True, tags=["sneakers"],
    desc="Sneakers with colourful LED lights in the sole that flash with every step. A guaranteed favourite.")
add("kids-colour-block-sandals", "Kids' Colour-Block Sandals", "kids-shoes",
    12500, None, 6900, 18, [opt("Size", KID_SHOE)], [img(W("0051"))],
    tags=["sandals"],
    desc="Bright colour-block sandals with adjustable hook-and-loop straps.")
add("kids-buckle-mules", "Kids' Buckle Mules", "kids-shoes",
    13000, None, 7100, 9, [opt("Colour", ["Black", "White"]), opt("Size", KID_SHOE)], [img(W("0052"))],
    tags=["slides"],
    desc="Easy slip-on mules with a gold buckle detail.")
add("kids-chunky-runner-sneakers", "Kids' Chunky Runner Sneakers", "kids-shoes",
    21500, None, 11800, 0, [opt("Size", KID_SHOE)], [img(W("0053"))],
    preorder=True, tags=["sneakers"],
    desc="Layered chunky runners with colourful accents and a cushioned sole.")
add("kids-street-sneakers", "Kids' Street Sneakers", "kids-shoes",
    22000, None, 12000, 15, [opt("Size", KID_SHOE)],
    [img(W("0063"), (0, 130, 561, 585)), img(W("0063"), (0, 655, 561, 1150))],
    tags=["sneakers"],
    desc="Padded street-style sneakers in a mix of colourways with chunky soles.")
add("kids-chunky-skate-trainers", "Kids' Chunky Skate Trainers", "kids-shoes",
    23500, None, 12900, 8, [opt("Size", KID_SHOE)],
    [img(W("0081"), (0, 130, 561, 625)), img(W("0081"), (0, 662, 561, 1195))],
    tags=["sneakers"],
    desc="Navy-and-white skate-style trainers with an extra-chunky sole.")
add("kids-leather-ankle-boots", "Kids' Leather Ankle Boots", "kids-shoes",
    25500, 31000, 14000, 6, [opt("Colour", ["Black", "Yellow"]), opt("Size", KID_SHOE)], [img(W("0064"))],
    tags=["boots"],
    desc="Lace-up ankle boots with a side zip and a sturdy lug sole.")
add("kids-classic-velcro-sneakers", "Kids' Classic Velcro Sneakers", "kids-shoes",
    14500, None, 7900, 28, [opt("Colour", ["White/Pink", "White/Black"]), opt("Size", KID_SHOE)], [img(W("0066"))],
    tags=["sneakers", "school"],
    desc="Clean white sneakers with triple hook-and-loop straps. Easy to wear and easy to match.")
add("girls-charm-sneakers", "Girls' Charm Sneakers", "kids-shoes",
    15500, None, 8500, 11, [opt("Colour", ["Pink", "White"]), opt("Size", KID_SHOE)], [img(W("0072"))],
    tags=["girls", "sneakers"],
    desc="Cute lace-up sneakers with a dangling charm and side zip.")
add("girls-sequin-ballet-flats", "Girls' Sequin Ballet Flats", "kids-shoes",
    14000, None, 7700, 12, [opt("Colour", ["Silver", "Gold", "Black"]), opt("Size", KID_SHOE)], [img(W("0061"))],
    tags=["girls", "party"],
    desc="Sparkling sequin ballet flats with a crystal bow. Made for twirling.")
add("kids-mesh-chunky-sneakers", "Kids' Mesh Chunky Sneakers", "kids-shoes",
    19000, None, 10400, 13, [opt("Size", KID_SHOE)], [img(W("0092"))],
    tags=["sneakers"],
    desc="Breathable white mesh sneakers with a chunky sculpted sole.")

# Kids' toys & accessories --------------------------------------------------
add("kids-cartoon-school-backpack", "Kids' Cartoon School Backpack", "kids-accessories",
    19500, 24000, 10500, 20, [opt("Design", [f"Design {i}" for i in range(1, 8)])], [img(W("0056"))],
    badge="Back to school", featured=True, tags=["school", "bags"],
    desc="Roomy cartoon backpacks in seven designs, with padded straps and a front pocket. Large size suits ages 3-6 and up (see photo for measurements).")
add("kids-tricycle-with-basket", "Kids' Tricycle with Basket", "kids-accessories",
    48000, None, 30000, 0, [], [img(W("0039"), (0, 404, 576, 890))],
    preorder=True, lead="21-30 days", tags=["toys", "ride-on"],
    desc="Sturdy three-wheel tricycle with a moulded seat, front basket and chunky wheels.")
add("kids-led-sports-watch", "Kids' LED Sports Watch", "kids-accessories",
    4500, None, 2100, 60, [opt("Colour", ["Black", "Red", "Green", "Teal", "Pink", "White"])], [img(W("0024"))],
    tags=["watches"],
    desc="Simple digital LED watch with a soft silicone strap in bright colours.")
add("kids-round-sunglasses", "Kids' Round Sunglasses", "kids-accessories",
    5000, None, 2300, 40, [opt("Style", ["Style 1", "Style 2", "Style 3", "Style 4", "Style 5"])], [img(W("0054"))],
    tags=["sunglasses"],
    desc="Fun round-frame sunglasses for kids in five styles (numbered in the photo).")
add("kids-hair-accessory-set-718", "Kids' Hair Accessory Set (718 pcs)", "kids-accessories",
    9500, 12500, 4800, 25, [], [img("IMG-20260612-WA0023.jpg")],
    tags=["hair", "girls"],
    desc="A 718-piece set of colourful hair ties, clips and bobbles. Note: the storage box is shown for display only and is not included.")
add("kids-glossy-mini-handbag", "Kids' Glossy Mini Handbag", "kids-accessories",
    8500, None, 4200, 30, [opt("Colour", ["Black", "Pink", "Purple", "Yellow", "Orange"])], [img(W("0003"))],
    tags=["bags", "girls"],
    desc="Glossy top-handle mini handbag in candy colours. Big style in a tiny size.")

# Women's fashion -----------------------------------------------------------
add("wide-leg-cargo-jeans", "Wide-Leg Cargo Jeans", "womens-fashion",
    18500, None, 10200, 20, [opt("Size", WOMEN)], [img(W("0026"))],
    tags=["denim"],
    desc="Relaxed wide-leg jeans with utility cargo pockets in a mid-blue wash.")
add("oversized-graphic-hoodie", "Oversized Graphic Hoodie", "womens-fashion",
    17000, None, 9300, 9, [opt("Size", WOMEN)], [img(W("0027"))],
    tags=["hoodies"],
    desc="Slouchy oversized hoodie in a deep plum shade. Throw on with leggings or shorts.")
add("varsity-jacket-joggers-coord", "Varsity Jacket & Joggers Co-ord", "womens-fashion",
    29500, 36000, 16500, 7, [opt("Colour", ["Black", "White"]), opt("Size", WOMEN)],
    [img(W("0034"), (0, 130, 561, 640)), img(W("0034"), (0, 685, 561, 1190))],
    featured=True, tags=["sets", "streetwear"],
    desc="Bold varsity-letter bomber with matching wide-leg joggers. Statement streetwear in one easy set.")
add("waistcoat-wide-leg-set", "Waistcoat & Wide-Leg Trouser Set", "womens-fashion",
    26000, None, 14500, 14, [opt("Colour", ["Mint", "Pink", "White", "Red", "Lilac", "Sky Blue"]), opt("Size", WOMEN)], [img(W("0068"))],
    badge="New", featured=True, tags=["sets", "occasion"],
    desc="Tailored sleeveless waistcoat with flowing wide-leg trousers. Six colours for brunch, work and owambe.")
add("ribbed-wide-leg-trousers", "Ribbed Wide-Leg Trousers", "womens-fashion",
    11500, None, 6100, 35, [opt("Colour", ["Green", "Black", "Grey", "Navy", "Brown", "Cream"]), opt("Size", ["Free size"])], [img(W("0071"))],
    tags=["trousers"],
    desc="Soft ribbed wide-leg trousers with a drawstring waist. Comfortable enough for lounging, smart enough to go out.")
add("oversized-tee-patch-jeans-set", "Oversized Tee & Patch Jeans Set", "womens-fashion",
    24000, None, 13200, 0, [opt("Colour", ["Orange", "Red", "Black"]), opt("Size", WOMEN)], [img(W("0091"))],
    preorder=True, tags=["sets", "denim"],
    desc="Oversized graphic tee paired with wide jeans with patch details.")

# Shoes & sandals -----------------------------------------------------------
add("gold-sequin-wedge-slides", "Gold Sequin Wedge Slides", "shoes",
    27500, 34000, 15000, 10, [opt("Size", WOMEN_SHOE)],
    [img(f"IMG-20260612-WA00{n}.jpg") for n in (16, 17, 18, 19, 20, 21, 22)],
    badge="Bestseller", featured=True, tags=["wedges", "party"],
    desc="Glamorous slip-on wedges covered in gold sequins, on a woven metallic wedge heel. Heel height is shown against a ruler in the photos.")
add("womens-platform-slip-on-sneakers", "Women's Platform Slip-On Sneakers", "shoes",
    21000, None, 11500, 12, [opt("Colour", ["Black", "White", "Rose Gold"]), opt("Size", WOMEN_SHOE)], [img(W("0016"))],
    tags=["sneakers"],
    desc="Lightweight slip-on sneakers with a platform sole and lace detail.")
add("rhinestone-toe-post-sandals", "Rhinestone Toe-Post Sandals", "shoes",
    13500, None, 7300, 17, [opt("Colour", ["Black", "Pink", "Gold", "Silver"]), opt("Size", WOMEN_SHOE)], [img(W("0030"))],
    tags=["sandals"],
    desc="Flat toe-post sandals with a sparkling rhinestone strap.")
add("classic-striped-court-sneakers", "Classic Striped Court Sneakers", "shoes",
    26500, None, 14600, 15, [opt("Size", UNISEX_SHOE)], [img(W("0035"))],
    tags=["sneakers", "unisex"],
    desc="Clean white court sneakers with black side stripes and a thick cupsole.")
add("retro-platform-sneakers", "Retro Platform Sneakers", "shoes",
    28000, None, 15400, 4, [opt("Colour", ["Black/Cream", "Brown/Cream"]), opt("Size", WOMEN_SHOE)], [img(W("0074"))],
    tags=["sneakers"],
    desc="Retro-inspired platform sneakers with contrast panels and chunky laces.")
add("double-strap-suede-slides", "Double-Strap Suede Slides", "shoes",
    16500, None, 9000, 21, [opt("Colour", ["Orange", "Black", "Tan"]), opt("Size", UNISEX_SHOE)], [img(W("0075"))],
    tags=["slides", "unisex"],
    desc="Comfortable two-strap slides with a contoured footbed.")
add("snake-print-platform-sandals", "Snake-Print Platform Sandals", "shoes",
    31000, None, 17000, 0, [opt("Size", WOMEN_SHOE)], [img(W("0080"))],
    preorder=True, tags=["platforms", "party"],
    desc="Statement platform sandals in a multicolour snake print.")
add("chunky-velcro-platform-sandals", "Chunky Velcro Platform Sandals", "shoes",
    18000, None, 9900, 13, [opt("Colour", ["Pink", "Yellow", "Black"]), opt("Size", WOMEN_SHOE)], [img(W("0100"))],
    tags=["sandals", "platforms"],
    desc="Chunky platform sandals with crossover hook-and-loop straps.")
add("athletic-crew-socks-5-pairs", "Athletic Crew Socks (5 Pairs)", "shoes",
    7500, None, 3800, 50, [opt("Colour", ["White"])], [img(W("0008"))],
    tags=["socks", "bundle"],
    desc="Five pairs of cushioned white crew socks in a gift box.")

# Bags & purses -------------------------------------------------------------
add("structured-crossbody-bag", "Structured Crossbody Bag", "bags",
    22500, 28000, 12400, 12, [opt("Colour", ["Cream", "Olive", "Taupe", "Black"])], [img(W("0013"))],
    featured=True, tags=["crossbody"],
    desc="Neat structured crossbody bag with a fold-over flap and adjustable strap. Comes with a matching mini pouch.")
add("metallic-fan-clutch", "Metallic Fan Clutch", "bags",
    19500, None, 10700, 6, [opt("Colour", ["Gold", "Silver"])], [img(W("0028"))],
    tags=["clutch", "party"],
    desc="Pleated metallic fan-shaped clutch with a chain strap. An eye-catching evening bag.")
add("buckle-box-mini-bag", "Buckle Box Mini Bag", "bags",
    24000, None, 13200, 9, [opt("Colour", ["Silver", "Pink", "Black", "Burgundy", "White"])], [img(W("0043"))],
    badge="New", tags=["mini bags"],
    desc="Glossy boxy mini bag with a statement gold buckle and top handle.")
add("envelope-clutch-bag", "Envelope Clutch Bag", "bags",
    17500, None, 9600, 16, [opt("Colour", ["Black", "Pink", "White", "Red", "Blue", "Orange"])], [img(W("0047"))],
    tags=["clutch"],
    desc="Slim envelope clutch with a turn-lock closure and tag detail, in six colours.")
add("teddy-charm-tote-bag", "Teddy Charm Tote Bag", "bags",
    26500, None, 14600, 11, [opt("Colour", ["Brown", "White", "Black"])], [img(W("0048"))],
    featured=True, tags=["tote"],
    desc="Roomy everyday tote with a removable teddy bear charm.")
add("wave-shoulder-bag", "Wave Shoulder Bag", "bags",
    15500, 19500, 8500, 24, [opt("Colour", ["Orange", "Pink", "White", "Black", "Lime", "Brown"])], [img(W("0049"))],
    badge="Hot", featured=True, tags=["shoulder bag"],
    desc="Soft shoulder bag with a playful wavy silhouette in six bold colours.")
add("mini-vanity-box-bag", "Mini Vanity Box Bag", "bags",
    16000, None, 8800, 8, [opt("Style", ["Style 1", "Style 2", "Style 3", "Style 4", "Style 5"])], [img(W("0078"))],
    tags=["mini bags"],
    desc="Round vanity-case mini bag with a chain strap. Five styles, numbered in the photo.")
add("pearl-chain-metallic-clutch", "Pearl Chain Metallic Clutch", "bags",
    21500, None, 11800, 2, [], [img(W("0079"))],
    tags=["clutch", "party"],
    desc="Mirror-finish silver clutch with a pearl handle. Made for weddings and evening events.")

# Beauty & fragrance --------------------------------------------------------
add("oud-perfume-gift-box", "Oud Eau de Parfum Gift Box", "beauty",
    38000, 45000, 22000, 7, [], [img(W("0083"))],
    badge="Premium", featured=True, tags=["perfume", "gift"],
    desc="Arabian-style eau de parfum presented in a black-and-gold gift box. A rich, long-lasting fragrance and an impressive gift.")
add("arabian-perfume-gift-pouch", "Arabian Eau de Parfum with Gift Pouch", "beauty",
    26000, None, 14500, 15, [opt("Bottle", ["Amber", "Pink", "Black", "Red"])], [img(W("0069"))],
    featured=True, tags=["perfume", "gift"],
    desc="Elegant perfume bottles, each supplied in a soft drawstring gift pouch.")
add("berries-weekend-pink-edition-set", "Berries Weekend Pink Edition Set", "beauty",
    24500, None, 13500, 12, [], [img(W("0086"))], brand="Berries Weekend",
    tags=["perfume", "gift set"],
    desc="Perfume and matching body spray set, boxed and ready to gift.")
add("kojic-acid-brightening-cream", "Kojic Acid & Collagen Brightening Cream", "beauty",
    7500, None, 3600, 45, [], [img(W("0014"))],
    tags=["skincare"],
    desc="Kojic acid and collagen cream for underarms, knees and other areas of uneven tone. Patch test before use.")
add("cream-contour-palette-8-in-1", "8-in-1 Cream Contour Palette", "beauty",
    8000, None, 3900, 22, [], [img(W("0018"))], brand="IMAN Makeup",
    tags=["makeup"],
    desc="Eight cream shades for contouring, concealing and foundation, in one compact palette.")
add("vitamin-b3-shower-bath-2l", "Vitamin B3 Brightening Shower Bath (2L)", "beauty",
    14500, None, 7900, 18, [], [img(W("0021"))], brand="Dr Davey",
    tags=["body care", "family size"],
    desc="Large 2-litre bottle of vitamin B3 shower bath for the whole family.")
add("turmeric-shower-bath-2l", "Turmeric Brightening Shower Bath (2L)", "beauty",
    14500, None, 7900, 3, [], [img(W("0031"))],
    tags=["body care", "family size"],
    desc="Turmeric shower bath in a value 2-litre bottle.")
add("kojic-acid-roll-on", "Kojic Acid Anti-Perspirant Roll-On", "beauty",
    4500, None, 2000, 70, [], [img(W("0038"))],
    tags=["body care"],
    desc="Kojic acid anti-perspirant roll-on with pearl extract.")
add("vitamin-b3-body-lotion", "Vitamin B3 Glow Body Lotion", "beauty",
    9500, None, 5100, 20, [], [img(W("0040"))], brand="Dr Davey",
    tags=["body care"],
    desc="Vitamin B3 body lotion for soft, glowing skin.")
add("brightening-body-cream", "Brightening Body Cream", "beauty",
    12000, None, 6400, 26, [opt("Formula", ["Turmeric", "Niacinamide", "Vitamin C", "Retinol"])], [img(W("0055"))],
    tags=["body care"],
    desc="Rich body cream in four formulas: turmeric, niacinamide, vitamin C or retinol.")
add("garnier-bright-complete-lotion", "Garnier Bright Complete Body Lotion", "beauty",
    11000, None, 6000, 14, [opt("Variant", ["Vitamin C (Yellow)", "Sakura (Pink)"])], [img(W("0058"))], brand="Garnier",
    tags=["body care"],
    desc="Garnier Bright Complete body lotion in a large pump bottle.")
add("curl-defining-cream", "Curl Defining Cream", "beauty",
    8500, None, 4300, 25, [], [img(W("0059"))],
    tags=["hair"],
    desc="Curl defining cream for bouncy, defined curls with less frizz.")
add("turmeric-glow-body-oil", "Turmeric Glow Body Oil", "beauty",
    7000, None, 3500, 33, [opt("Size", ["Small", "Medium", "Large"])], [img(W("0088"))],
    tags=["body care"],
    desc="Turmeric body oil in three bottle sizes.")
add("olive-oil-skin-care-set", "Olive Oil Skin Care Set", "beauty",
    16500, None, 9000, 9, [], [img(W("0089"))], brand="Dr Davey",
    tags=["body care", "gift set"],
    desc="Olive oil body care set in a clear zip bag.")
add("himalayan-shilajit-gold-gummies", "Himalayan Shilajit Gold Gummies", "beauty",
    23500, None, 13000, 10, [], [img(W("0073"))],
    badge="New", tags=["supplements"],
    desc="Shilajit dietary supplement gummies, 60 per tub. Read the label before use; not a substitute for medical advice.")
add("lipstick-display-box-wholesale", "Lipstick Display Box (Wholesale)", "beauty",
    28000, None, 15500, 6, [opt("Box", ["Black", "Pink", "Gold", "Navy", "Red"])], [img(W("0082"))],
    tags=["makeup", "wholesale"],
    desc="Retail display boxes of lipsticks in assorted shades. Ideal for resellers and beauty stores.")
add("spiral-curl-crochet-hair", "Spiral Curl Crochet Hair", "beauty",
    4500, None, 2000, 80, [opt("Colour", list("ABCDEFGHIJ"))], [img(W("0101"))],
    tags=["hair"],
    desc="Spiral curl crochet hair extensions. Choose colours A-J as labelled in the photo.")
add("sunscreen-spf50-lotion", "Sunscreen SPF 50 Lotion", "beauty",
    6500, None, 3100, 60, [], [img("IMG-20260612-WA0013.jpg")],
    tags=["skincare"],
    desc="Compact SPF 50 sunscreen lotion for daily protection.")

# Home & kitchen ------------------------------------------------------------
add("silver-crest-air-fryer-6l", "Silver Crest 6L Air Fryer", "home-kitchen",
    68000, 85000, 42000, 8, [], [img(W("0004"))], brand="Silver Crest",
    badge="Hot", featured=True, tags=["appliances"],
    desc="Extra-large 6-litre air fryer for crispy chips, chicken and more with little or no oil. Supplied with a UK 3-pin plug as pictured.")
add("retro-electric-oven", "Retro Electric Oven", "home-kitchen",
    72000, None, 45000, 5, [], [img(W("0006"))],
    featured=True, tags=["appliances"],
    desc="Countertop electric oven with a retro cream finish, for baking, grilling and toasting.")
add("ceramic-non-stick-cookware-set", "Ceramic Non-Stick Cookware Set", "home-kitchen",
    58000, 69000, 34000, 4, [opt("Colour", ["Sage Green", "Blush Pink"])], [img(W("0007"))],
    tags=["cookware"],
    desc="Matching set of non-stick pots and pans with lids, in soft sage green or blush pink.")
add("kenwood-blender-crusher", "Kenwood Blender & Crusher", "home-kitchen",
    56000, 65000, 36000, 9, [], [img("blender-crusher.jpg")], brand="Kenwood",
    featured=True, tags=["appliances"],
    desc="Kenwood blender and crusher for smoothies, pepper, ice and more.")
add("fridge-drinks-dispenser-3-5l", "Fridge Drinks Dispenser (3.5L)", "home-kitchen",
    14500, None, 7800, 22, [], [img(W("0037"))],
    tags=["kitchen"],
    desc="Slim 3.5-litre drinks dispenser with a tap, designed to fit inside the fridge door.")
add("insulated-food-flask", "Insulated Food Flask with Spoon", "home-kitchen",
    12500, None, 6600, 26, [opt("Colour", ["Pink", "Green", "White", "Black"])], [img(W("0070"))],
    tags=["kitchen", "school"],
    desc="Portable insulated food flask with a carry handle. Keeps meals warm for school or work.")
add("insulated-lunch-cooler-bag", "Insulated Lunch Cooler Bag", "home-kitchen",
    15000, None, 8100, 17, [opt("Colour", ["Grey", "Black", "Pink", "Purple"])], [img(W("0057"))],
    tags=["kitchen", "school"],
    desc="Two-compartment insulated cooler bag with a shoulder strap.")
add("motivational-water-bottle-2l", "Motivational Water Bottle (2L)", "home-kitchen",
    8500, None, 4100, 40, [opt("Colour", ["Grey", "Green", "Orange"])], [img(W("0084"))],
    tags=["drinkware"],
    desc="Large 2-litre water bottle with a straw and carry handle.")
add("toilet-bowl-cleaner-twin-pack", "Toilet Bowl Cleaner Twin Pack", "home-kitchen",
    4800, None, 2300, 40, [], [img("IMG-20260612-WA0024.jpg")],
    tags=["cleaning", "bundle"],
    desc="Two bottles of strong toilet bowl cleaner.")
add("anti-mould-wardrobe-sachets", "Anti-Mould Wardrobe Sachets", "home-kitchen",
    3500, None, 1600, 90, [opt("Scent", ["Fresh", "Floral"])], [img(W("0019"))],
    tags=["cleaning"],
    desc="Hanging sachets that help keep wardrobes and drawers fresh and dry.")
add("portable-outdoor-wood-stove", "Portable Outdoor Wood Stove", "home-kitchen",
    32000, None, 18500, 0, [], [img(W("0094"))],
    preorder=True, tags=["outdoor"],
    desc="Portable wood-burning stove for outdoor cooking.")
add("chigo-chest-freezer", "Chigo Double-Door Chest Freezer", "home-kitchen",
    395000, None, 290000, 0, [], [img(W("0097"))], brand="Chigo",
    preorder=True, lead="21-30 days", tags=["appliances"],
    desc="Double-door chest freezer (model KCD-266D) with separate freezer and chiller sections. Bulky item: delivery is quoted at confirmation.")

# Gadgets & power -----------------------------------------------------------
add("pebble-wireless-earbuds", "Pebble Wireless Earbuds", "gadgets",
    18500, 24000, 9800, 21, [opt("Colour", ["Champagne", "Lilac"])],
    [img("IMG-20260611-WA0037.jpg", (0, 380, 720, 1100)), img("IMG-20260611-WA0036.jpg", (0, 270, 720, 990))],
    badge="Hot", featured=True, tags=["audio"],
    desc="Open-ear wireless earbuds in a pebble-shaped charging case.")
add("solar-rechargeable-fan-kit", "Solar Rechargeable Fan Kit", "gadgets",
    34500, None, 20000, 6, [], [img(W("0022"))],
    tags=["solar", "fans"],
    desc="Rechargeable table fan bundled with a solar panel and LED bulbs (4-in-1 kit as pictured). Handy backup when there's no light.")
add("solar-street-light-with-remote", "Solar Street Light with Remote", "gadgets",
    45000, None, 26000, 10, [], [img(W("0065"))],
    tags=["solar", "lighting"],
    desc="Bright all-in-one solar street light with remote control and motion-sensing modes.")
add("foldable-handheld-fan", "Foldable Handheld Fan with Display", "gadgets",
    12500, None, 6500, 35, [], [img(W("0085"))],
    tags=["fans"],
    desc="Foldable rechargeable mini fan with a digital speed display. Use it handheld, on a desk or on the lanyard.")


# ---------------------------------------------------------------------------
# Image processing
# ---------------------------------------------------------------------------
def edge_is_plain(arr, axis_tall):
    """True if the borders we'd pad against are near-white."""
    if axis_tall:
        strips = np.concatenate([arr[:, :8], arr[:, -8:]], axis=1)
    else:
        strips = np.concatenate([arr[:8, :], arr[-8:, :]], axis=0)
    return strips.mean() > 232 and strips.std() < 14


def squareify(im):
    w, h = im.size
    if abs(w - h) / max(w, h) <= 0.06:
        s = min(w, h)
        return im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
    s = max(w, h)
    gray = np.asarray(im.convert("L")).astype(float)
    if edge_is_plain(gray, h > w):
        canvas = Image.new("RGB", (s, s), (255, 255, 255))
    else:
        # Blur-fill: the photo, scaled to cover, blurred and softened behind it.
        bg = ImageOps.fit(im, (s, s))
        bg = bg.resize((s // 8, s // 8)).filter(ImageFilter.GaussianBlur(6)).resize((s, s))
        bg = Image.blend(bg, Image.new("RGB", (s, s), (245, 243, 240)), 0.35)
        canvas = bg
    canvas.paste(im, ((s - w) // 2, (s - h) // 2))
    return canvas


def process(spec, slug, idx):
    os.makedirs(OUT, exist_ok=True)
    name = f"{slug}-{idx}"
    full_path = os.path.join(OUT, name + ".jpg")
    small_path = os.path.join(OUT, name + "-sm.jpg")
    src = os.path.join(SRC, spec["src"])
    # Skip images that are already up to date (run with --force to rebuild all).
    if (not FORCE and os.path.exists(full_path) and os.path.exists(small_path)
            and os.path.getmtime(full_path) >= os.path.getmtime(src)):
        return f"images/catalog/{name}.jpg"
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    if spec["crop"]:
        im = im.crop(spec["crop"])
    im = squareify(im)
    full = im.resize((min(FULL, im.width),) * 2, Image.LANCZOS)
    full.save(full_path, "JPEG", quality=80, optimize=True, progressive=True)
    im.resize((SMALL, SMALL), Image.LANCZOS).save(small_path, "JPEG", quality=78, optimize=True, progressive=True)
    return f"images/catalog/{name}.jpg"


def brand_assets():
    os.makedirs(os.path.join(ROOT, "images", "brand"), exist_ok=True)
    mark = Image.open(os.path.join(SRC, "chi-bestfav.png")).convert("RGBA")
    for size, fname in ((256, "mark-256.png"), (96, "mark-96.png"), (64, "favicon-64.png"), (180, "apple-touch-icon.png")):
        m = mark.resize((size, size), Image.LANCZOS)
        if fname == "apple-touch-icon.png":
            bg = Image.new("RGBA", (size, size), (255, 255, 255, 255))
            inner = mark.resize((int(size * 0.86),) * 2, Image.LANCZOS)
            bg.alpha_composite(inner, ((size - inner.width) // 2,) * 2)
            m = bg.convert("RGB")
        m.save(os.path.join(ROOT, "images", "brand", fname), optimize=True)


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------
def build():
    brand_assets()
    cats = {c[0]: c for c in CATEGORIES}
    counters = {c[0]: 0 for c in CATEGORIES}
    now = datetime(2026, 10, 20, 9, 0, tzinfo=timezone.utc)
    products, slug_to_img = [], {}

    for i, p in enumerate(P):
        assert p["cat"] in cats, p["slug"]
        counters[p["cat"]] += 1
        code = cats[p["cat"]][2]
        images = [process(spec, p["slug"], n + 1) for n, spec in enumerate(p["images"])]
        slug_to_img[p["slug"]] = images[0]
        # Newer-looking products first: spread creation dates over ~90 days,
        # with "New"-badged and featured items the most recent.
        age_days = 3 if p.get("badge") == "New" else (i * 7) % 88 + 5
        created = (now - timedelta(days=age_days, hours=i)).isoformat()
        products.append({
            "id": f"p-{p['slug']}",
            "sku": f"CB-{code}-{counters[p['cat']]:03d}",
            "slug": p["slug"],
            "name": p["name"],
            "description": p["desc"],
            "categoryId": p["cat"],
            "brand": p.get("brand", ""),
            "price": p["price"],
            "compareAtPrice": p["compare"],
            "costPrice": p["cost"],
            "stock": p["stock"],
            "lowStockThreshold": p.get("low", 3 if p["price"] > 30000 else 5),
            "trackInventory": True,
            "allowPreorder": bool(p.get("preorder", False)),
            "leadTime": p.get("lead", "14-21 days"),
            "images": images,
            "options": p["options"],
            "badge": p.get("badge", ""),
            "featured": bool(p.get("featured", False)),
            "tags": p.get("tags", []),
            "status": "active",
            "createdAt": created,
            "updatedAt": created,
        })

    categories = [{
        "id": c[0], "name": c[1], "code": c[2], "description": c[3],
        "image": slug_to_img[c[4]], "sortOrder": n + 1, "active": True,
    } for n, c in enumerate(CATEGORIES)]

    js = (
        "// =============================================================\n"
        "// CHI-BEST SEED CATALOG (generated by tools/build_catalog.py)\n"
        "// Used to populate a fresh store. After first launch, products\n"
        "// are managed in the admin dashboard; edit there, not here.\n"
        "// Prices, costs and stock levels are placeholders.\n"
        "// =============================================================\n"
        "window.SEED_CATALOG = " + json.dumps({"version": 1, "categories": categories, "products": products},
                                             ensure_ascii=False, separators=(",", ":")) + ";\n"
    )
    with open(os.path.join(ROOT, "js", "catalog.js"), "w", encoding="utf-8") as f:
        f.write(js)

    def q(v):
        if v is None:
            return "NULL"
        if isinstance(v, bool):
            return "true" if v else "false"
        if isinstance(v, (int, float)):
            return str(v)
        return "'" + str(v).replace("'", "''") + "'"

    def arr(values):
        return "ARRAY[" + ",".join(q(v) for v in values) + "]::text[]" if values else "'{}'::text[]"

    lines = [
        "-- =============================================================",
        "-- CHI-BEST SEED CATALOG (generated by tools/build_catalog.py)",
        "-- Run AFTER schema.sql. Safe to re-run: existing rows are kept.",
        "-- Prices, costs and stock levels are placeholders.",
        "-- =============================================================",
        "",
    ]
    for c in categories:
        lines.append(
            "INSERT INTO categories (id, name, code, description, image, sort_order, active) VALUES "
            f"({q(c['id'])}, {q(c['name'])}, {q(c['code'])}, {q(c['description'])}, {q(c['image'])}, {c['sortOrder']}, true) "
            "ON CONFLICT (id) DO NOTHING;")
    lines.append("")
    for p in products:
        lines.append(
            "INSERT INTO products (sku, slug, name, description, category_id, brand, price, compare_at_price, cost_price, "
            "stock, low_stock_threshold, track_inventory, allow_preorder, lead_time, images, options, badge, featured, tags, status, created_at) VALUES ("
            + ", ".join([
                q(p["sku"]), q(p["slug"]), q(p["name"]), q(p["description"]), q(p["categoryId"]), q(p["brand"]),
                q(p["price"]), q(p["compareAtPrice"]), q(p["costPrice"]), "0", q(p["lowStockThreshold"]),
                "true", q(p["allowPreorder"]), q(p["leadTime"]), arr(p["images"]),
                q(json.dumps(p["options"])) + "::jsonb", q(p["badge"]), q(p["featured"]), arr(p["tags"]),
                "'active'", q(p["createdAt"]),
            ]) + ") ON CONFLICT (slug) DO NOTHING;")
    lines.append("")
    lines.append("-- Opening stock is recorded through the inventory ledger so every unit is traceable.")
    for p in products:
        if p["stock"] > 0:
            lines.append(
                "SELECT private.seed_opening_stock(" + ", ".join([q(p["slug"]), str(p["stock"]), str(p["costPrice"])]) + ");")
    with open(os.path.join(ROOT, "database", "seed.sql"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print(f"{len(products)} products, {len(categories)} categories, "
          f"{sum(len(p['images']) for p in products)} images written.")


if __name__ == "__main__":
    build()
