# -*- coding: utf-8 -*-
"""
Builds the picture packs for the everyday-word decks (05, 06, 07): for each
deck, a two-column manifest (title, image filename — row 1 is the header the
importer skips) plus a .zip of PNG images, which is exactly what the admin
panel's "import with images" upload takes.

Pictures come from Microsoft's Fluent Emoji (flat style, MIT licence),
rendered from the @iconify-json/fluent-emoji-flat package at 512 px. Every
word maps to one icon name below; a word mapped to None gets no picture and
is listed in pictures-missing.txt for a later pass (AI illustration or a
photo), since the admin panel can still import it without one.

    cd <scratch dir> && npm install @iconify-json/fluent-emoji-flat sharp
    EMOJI_NODE_DIR=<scratch dir> python3 docs/decks/build_pictures.py
"""
import json
import os
import re
import subprocess
import zipfile
from pathlib import Path

from openpyxl import Workbook

import build_decks as decks

OUT = Path(__file__).parent / "pictures"
NODE_DIR = Path(os.environ.get("EMOJI_NODE_DIR", OUT / "node"))
SIZE = 512

# --- English word -> Fluent Emoji icon name --------------------------------
# Only the words the automatic match (word == icon name, give or take a
# plural) does not find. None = no suitable emoji exists.
EN_ICON = {
    "Stairs": None, "Roof": "house", "Garden": "house-with-garden", "Kitchen": "cooking",
    "Bathroom": "bathtub", "Bedroom": "bed", "Living room": "couch-and-lamp", "Garage": "automobile",
    "Pillow": "bed", "Blanket": "person-in-bed", "Sofa": "couch-and-lamp", "Table": None,
    "Wardrobe": "coat", "Curtain": "window", "Carpet": None, "Air conditioner": "cold-face",
    "Fan": "wind-face", "Remote control": "television", "Fridge": "ice", "Oven": "cooking",
    "Stove": "cooking", "Microwave": None, "Washing machine": None, "Vacuum cleaner": "broom",
    "Iron": None, "Doorbell": "bell", "Lock": "locked", "Clock": "alarm-clock",
    "Painting": "framed-picture", "Vase": "amphora", "Trash can": "wastebasket", "Hanger": "coat",
    "Sink": "potable-water", "Towel": None, "Shampoo": "lotion-bottle", "Hair dryer": None,
    "Fork": "fork-and-knife", "Knife": "kitchen-knife", "Plate": "fork-and-knife-with-plate",
    "Cup": "hot-beverage", "Pot": "pot-of-food", "Frying pan": "cooking", "Kettle": "teapot",
    "Bottle": "baby-bottle", "Tray": "bento-box", "Rice": "cooked-rice", "Meat": "cut-of-meat",
    "Milk": "glass-of-milk", "Cheese": "cheese-wedge", "Juice": "beverage-box", "Water": "droplet",
    "Coffee": "hot-beverage", "Tea": "teacup-without-handle", "Dates": None, "Apple": "red-apple",
    "Orange": "tangerine", "Pepper": "hot-pepper", "Sugar": "candy", "Honey": "honey-pot",
    "Cake": "shortcake", "Chocolate": "chocolate-bar", "Burger": "hamburger", "Pasta": "spaghetti",
    "Salad": "green-salad", "Soup": "bowl-with-spoon", "Donut": "doughnut", "Pancake": "pancakes",
    "Milkshake": "cup-with-straw",
    "Shirt": "t-shirt", "Trousers": "jeans", "Jacket": "coat", "Skirt": "dress", "Shoes": "running-shoe",
    "Sneakers": "running-shoe", "Boots": "hiking-boot", "Slippers": "thong-sandal", "Hat": "top-hat",
    "Cap": "billed-cap", "Necklace": "gem-stone", "Earrings": "gem-stone", "Belt": None,
    "Wallet": "purse", "Bag": "handbag", "Pajamas": "sleeping-face", "Swimsuit": "one-piece-swimsuit",
    "Tie": "necktie", "Suit": "person-in-tuxedo",
    "Head": "bust-in-silhouette", "Hair": "person-curly-hair", "Neck": None, "Shoulder": None,
    "Arm": "flexed-biceps", "Hand": "raised-hand", "Finger": "index-pointing-up", "Nail": "nail-polish",
    "Stomach": None, "Knee": "leg", "Heart": "anatomical-heart", "Mustache": "man-beard",
    "Eyebrow": "face-with-raised-eyebrow", "Elbow": "flexed-biceps", "Back": None,
    "Sheep": "ewe", "Falcon": "eagle", "Ostrich": None, "Bee": "honeybee", "Hippo": "hippopotamus",
    "Rhino": "rhinoceros", "Squirrel": "chipmunk", "Dinosaur": "t-rex",
    "Doctor": "health-worker", "Nurse": "woman-health-worker", "Engineer": "construction-worker",
    "Soldier": "military-helmet", "Chef": "cook", "Baker": "bread", "Barber": "person-getting-haircut",
    "Tailor": "sewing-needle", "Carpenter": "hammer-and-wrench", "Plumber": "wrench",
    "Electrician": "electric-plug", "Driver": "automobile", "Fisherman": "fishing-pole",
    "Painter": "artist", "Photographer": "camera", "Actor": "performing-arts", "News anchor": "microphone",
    "Football player": "soccer-ball", "Referee": None, "Coach": None, "Lawyer": "balance-scale",
    "Pharmacist": "pill", "Dentist": "tooth", "Surgeon": "health-worker", "Architect": "building-construction",
    "Diver": "diving-mask", "Security guard": "guard", "Cashier": "receipt", "Waiter": "bellhop-bell",
    "Flight attendant": "airplane", "Magician": "person-mage", "Clown": "clown-face", "Dancer": "woman-dancing",
    "DJ": "headphone", "YouTuber": "video-camera", "Lifeguard": "ring-buoy", "Spy": "detective",
    "King": "crown", "Queen": "princess", "Pirate": "pirate-flag", "Cowboy": "cowboy-hat-face",
    "University": "classical-building", "Market": "shopping-cart", "Mall": "department-store",
    "Restaurant": "fork-and-knife-with-plate", "Cafe": "hot-beverage", "Airport": "airplane-departure",
    "Gas station": "fuel-pump", "Pharmacy": "pill", "Library": "books", "Gym": "person-lifting-weights",
    "Swimming pool": "person-swimming", "Beach": "beach-with-umbrella", "Island": "desert-island",
    "River": "water-wave", "Forest": "evergreen-tree", "Farm": "tractor", "Zoo": "elephant",
    "Prison": "locked", "Bakery": "croissant", "Supermarket": "shopping-cart", "Laundry": "basket",
    "Salon": "person-getting-haircut", "Camp": "camping", "Cemetery": "headstone", "Port": "anchor",
    "Bridge": "bridge-at-night", "Traffic light": "vertical-traffic-light", "Parking": "p-button",
    "Museum": "classical-building", "Theme park": "roller-coaster", "Playground": "carousel-horse",
    "Office": "office-building", "Escalator": None, "Waterfall": None, "Cave": "hole", "Space": "milky-way",
    "Car": "automobile", "Boat": "sailboat", "Yacht": "motor-boat", "Submarine": None,
    "Truck": "delivery-truck", "Scooter": "kick-scooter", "Fire truck": "fire-engine",
    "Hot air balloon": "balloon", "Jet ski": "speedboat", "Tank": None, "Limousine": "automobile",
    "Wheelchair": "manual-wheelchair",
    "Football": "soccer-ball", "Padel": "tennis", "Diving": "diving-mask", "Boxing": "boxing-glove",
    "Karate": "martial-arts-uniform", "Gymnastics": "person-cartwheeling", "Horse riding": "horse-racing",
    "Skiing": "skier", "Chess": "chess-pawn", "Cards": "joker", "PlayStation": "video-game",
    "Dominoes": "game-die", "Jump rope": None, "Hide and seek": "face-with-peeking-eye",
    "Fishing": "fishing-pole", "Golf": "flag-in-hole", "Weightlifting": "person-lifting-weights",
    "Yoga": "person-in-lotus-position", "Hockey": "ice-hockey", "Archery": "bow-and-arrow",
    "Cycling": "person-biking", "Skating": "roller-skate", "Darts": "bullseye", "Billiards": "pool-8-ball",
    "Marathon": "person-running", "Sumo": "person-wrestling", "Rugby": "rugby-football",
    "Formula 1": "racing-car", "Puzzle": "puzzle-piece",
    "Sleeping": "sleeping-face", "Waking up": "alarm-clock", "Eating": "face-savoring-food",
    "Drinking": "cup-with-straw", "Washing dishes": "sponge", "Sweeping": "broom", "Ironing": None,
    "Driving": "automobile", "Jumping": "person-cartwheeling", "Dancing": "man-dancing",
    "Singing": "singer", "Praying": "folded-hands", "Reading": "open-book", "Writing": "writing-hand",
    "Drawing": "paintbrush", "Taking a photo": "camera-with-flash", "Phone call": "telephone-receiver",
    "Texting": "mobile-phone-with-arrow", "Flying": "airplane", "Sewing": "sewing-needle",
    "Shaving": "razor", "Makeup": "lipstick", "Showering": "shower", "Brushing teeth": "toothbrush",
    "Yawning": "yawning-face", "Sneezing": "sneezing-face", "Coughing": "face-with-medical-mask",
    "Laughing": "face-with-tears-of-joy", "Crying": "loudly-crying-face", "Angry": "angry-face",
    "Scared": "face-screaming-in-fear", "Shy": "flushed-face", "Tired": "weary-face",
    "Hugging": "hugging-face", "Waving": "waving-hand", "Clapping": "clapping-hands",
    "Whistling": "face-exhaling", "Counting money": "money-bag", "Paying": "credit-card",
    "Shopping": "shopping-bags", "Traveling": "luggage", "Packing": "luggage",
    "Opening a door": "door", "Knocking": "door", "Barbecue": "meat-on-bone",
    "Playing guitar": "guitar", "Fixing a car": "mechanic", "Sleepwalking": "zzz", "Snoring": "zzz",
    "Hiccups": None, "Tying shoes": "running-shoe", "Thinking": "thinking-face", "Winking": "winking-face",
    "Falling": "dizzy", "Hiding": "face-with-peeking-eye", "Searching": "magnifying-glass-tilted-left",
    "Pushing": None, "Pulling": None, "Lifting": "person-lifting-weights", "Throwing": "person-bouncing-ball",
    "Catching": "baseball", "Kicking": "soccer-ball", "Pointing": "index-pointing-at-the-viewer",
    "Nodding": None,
    "Moon": "crescent-moon", "Sky": "sun-behind-cloud", "Rain": "cloud-with-rain",
    "Lightning": "high-voltage", "Thunder": "cloud-with-lightning", "Snow": "snowflake",
    "Wind": "wind-face", "Dust storm": "dashing-away", "Storm": "cloud-with-lightning-and-rain",
    "Hot": "hot-face", "Cold": "cold-face", "Smoke": "dashing-away", "Wave": "water-wave",
    "Sand": "desert", "Tree": "deciduous-tree", "Flower": "blossom", "Grass": "herb",
    "Earthquake": "collision", "Flood": "water-wave", "Leaf": "fallen-leaf", "Seed": "seedling",
    "Phone": "mobile-phone", "iPad": None, "Computer": "desktop-computer", "Charger": "electric-plug",
    "Wi-Fi": "antenna-bars", "Drone": None, "Smart watch": "watch", "Flash": "camera-with-flash",
    "TikTok": None, "Snapchat": None, "Instagram": None, "YouTube": None, "WhatsApp": None,
    "Google": None, "Netflix": None, "Xbox": "video-game", "ATM": "atm-sign", "Barcode": None,
    "Cash": "dollar-banknote", "Password": "locked-with-key", "Emoji": "grinning-face",
    "Video call": "video-camera", "Alarm": "alarm-clock", "Calculator": "abacus",
    "Speaker": "speaker-high-volume", "Antenna": "satellite-antenna", "Map": "world-map",
    "Saw": "carpentry-saw", "Drill": None, "Rope": "knot", "Tape": None, "Glue": None,
    "Eraser": None, "Ruler": "straight-ruler", "Book": "open-book", "Stamp": "postbox",
    "Gift": "wrapped-gift", "Doll": "nesting-dolls", "Lego": None, "Dice": "game-die",
    "Birthday": "birthday-cake", "Graduation": "graduation-cap", "Exam": "memo", "Homework": "pencil",
    "Work": "briefcase", "Vacation": "beach-with-umbrella", "Travel": "luggage", "Picnic": "basket",
    "Breakfast": "cooking", "Lunch": "fork-and-knife-with-plate", "Dinner": "fork-and-knife-with-plate",
    "Nap": "sleeping-face", "Traffic jam": "oncoming-automobile", "Car accident": "collision",
    "Speeding ticket": "police-car", "Doctor's appointment": "stethoscope", "Injection": "syringe",
    "Medicine": "pill", "Headache": "face-with-head-bandage", "Broken arm": "adhesive-bandage",
    "Toothache": "tooth", "Pregnancy": "pregnant-woman", "Engagement": "ring", "Divorce": "broken-heart",
    "Winning": "trophy", "Losing": "thumbs-down", "Goal": "goal-net", "Penalty kick": "soccer-ball",
    "Match": "stadium", "Party": "party-popper", "Haircut": "person-getting-haircut",
    "Job interview": "briefcase", "First day of school": "school", "Moving house": "package",
    "Flat tire": "wheel", "Power cut": "light-bulb", "Lost keys": "key", "Late for work": "alarm-clock",
    "Missed flight": "airplane-departure", "Proposal": "ring", "Surprise": "face-with-open-mouth",
    "Concert": "microphone", "Halloween": "jack-o-lantern", "New Year": "fireworks",
    "Eid": "star-and-crescent", "Ramadan": "crescent-moon", "Iftar": "fork-and-knife-with-plate",
    "Suhoor": "crescent-moon",
    # auto-match corrections: the first guess is a different thing
    "Mouse": "mouse-face", "Fish": "fish", "Bat": "bat", "Chicken": "poultry-leg", "Rooster": "rooster",
    "Duck": "duck", "Bird": "bird", "Deer": "deer", "Frog": "frog", "Pig": "pig-face",
    "Lion": "lion", "Tiger": "tiger-face", "Bear": "bear", "Wolf": "wolf", "Fox": "fox", "Rabbit": "rabbit",
    "Cat": "cat-face", "Dog": "dog-face", "Horse": "horse-face", "Cow": "cow-face", "Goat": "goat",
    "Monkey": "monkey-face", "Elephant": "elephant", "Giraffe": "giraffe", "Camel": "camel",
    "Snake": "snake", "Turtle": "turtle", "Crocodile": "crocodile", "Lizard": "lizard", "Shark": "shark",
    "Dolphin": "dolphin", "Whale": "spouting-whale", "Octopus": "octopus", "Shrimp": "shrimp", "Crab": "crab",
    "Owl": "owl", "Parrot": "parrot", "Butterfly": "butterfly", "Ant": "ant", "Mosquito": "mosquito",
    "Cockroach": "cockroach", "Spider": "spider", "Scorpion": "scorpion", "Penguin": "penguin",
    "Kangaroo": "kangaroo", "Zebra": "zebra", "Gorilla": "gorilla", "Panda": "panda", "Eagle": "eagle",
    "Egg": "egg", "Bread": "bread", "Banana": "banana", "Lemon": "lemon", "Cucumber": "cucumber",
    "Tomato": "tomato", "Onion": "onion", "Garlic": "garlic", "Salt": "salt", "Pizza": "pizza",
    "Hot dog": "hot-dog", "Sandwich": "sandwich", "Popcorn": "popcorn", "Cookie": "cookie", "Sushi": "sushi",
    "Taco": "taco", "French fries": "french-fries", "Grapes": "grapes", "Watermelon": "watermelon",
    "Eye": "eye", "Ear": "ear", "Nose": "nose", "Mouth": "mouth", "Tooth": "tooth", "Tongue": "tongue",
    "Leg": "leg", "Foot": "foot", "Bone": "bone", "Beard": "man-beard",
    "Pilot": "pilot", "Teacher": "teacher", "Police officer": "police-officer", "Firefighter": "firefighter",
    "Mechanic": "mechanic", "Farmer": "farmer", "Singer": "singer", "Judge": "judge",
    "Scientist": "scientist", "Astronaut": "astronaut", "Ninja": "ninja", "Superhero": "person-superhero",
    "Detective": "detective", "School": "school", "Hospital": "hospital", "Mosque": "mosque",
    "Cinema": "cinema", "Bank": "bank", "Stadium": "stadium", "Desert": "desert", "Mountain": "mountain",
    "Hotel": "hotel", "Factory": "factory", "Castle": "castle", "Church": "church", "Elevator": "elevator",
    "Volcano": "volcano", "Bus": "bus", "Taxi": "taxi", "Bicycle": "bicycle", "Motorcycle": "motorcycle",
    "Airplane": "airplane", "Helicopter": "helicopter", "Train": "locomotive", "Metro": "metro",
    "Ship": "ship", "Rocket": "rocket", "Tractor": "tractor", "Ambulance": "ambulance",
    "Police car": "police-car", "Skateboard": "skateboard", "Basketball": "basketball",
    "Volleyball": "volleyball", "Tennis": "tennis", "Bowling": "bowling", "Swimming": "person-swimming",
    "Wrestling": "person-wrestling", "Running": "person-running", "Surfing": "person-surfing",
    "Climbing": "person-climbing", "Baseball": "baseball", "Cricket": "cricket-game", "Fencing": "person-fencing",
    "Ping pong": "ping-pong", "Video games": "video-game", "Cooking": "cooking", "Walking": "person-walking",
    "Handshake": "handshake", "Juggling": "person-juggling", "Sun": "sun", "Star": "star", "Cloud": "cloud",
    "Rainbow": "rainbow", "Fire": "fire", "Rock": "rock", "Tornado": "tornado", "Sunrise": "sunrise",
    "Sunset": "sunset", "Ice": "ice", "Fog": "fog", "Cactus": "cactus", "Palm tree": "palm-tree",
    "Laptop": "laptop", "Camera": "camera", "Headphones": "headphone", "Printer": "printer",
    "Battery": "battery", "Robot": "robot", "Selfie": "selfie", "Keyboard": "keyboard",
    "Microphone": "microphone", "Satellite": "satellite", "Telescope": "telescope", "Microscope": "microscope",
    "Magnet": "magnet", "Compass": "compass", "Flashlight": "flashlight", "Scissors": "scissors",
    "Hammer": "hammer", "Screwdriver": "screwdriver", "Pencil": "pencil", "Pen": "pen", "Notebook": "notebook",
    "Newspaper": "newspaper", "Envelope": "envelope", "Balloon": "balloon", "Kite": "kite",
    "Teddy bear": "teddy-bear", "Wedding": "wedding", "Camping": "camping", "Fireworks": "fireworks",
    "Toilet": "toilet", "Shower": "shower", "Bathtub": "bathtub", "Soap": "soap", "Toothbrush": "toothbrush",
    "Candle": "candle", "Light bulb": "light-bulb", "Key": "key", "Mirror": "mirror", "Door": "door",
    "Window": "window", "Bed": "bed", "Chair": "chair", "Television": "television", "Ladder": "ladder",
    "Spoon": "spoon", "Dress": "dress", "Jeans": "jeans", "Coat": "coat", "Socks": "socks",
    "Glasses": "glasses", "Sunglasses": "sunglasses", "Watch": "watch", "Ring": "ring", "Backpack": "backpack",
    "Umbrella": "umbrella", "Gloves": "gloves", "Scarf": "scarf", "T-shirt": "t-shirt", "Crown": "crown",
    "Ice cream": "ice-cream", "Milky way": "milky-way",
}

# --- Arabic word -> the English word whose icon it shares ------------------
AR_TO_EN = {
    "دريشة": "Window", "باب": "Door", "درج": "Stairs", "سطح": "Roof", "حديقة": "Garden",
    "مطبخ": "Kitchen", "حمام": "Bathroom", "غرفة نوم": "Bedroom", "صالة": "Living room",
    "كراج": "Garage", "سرير": "Bed", "مخدة": "Pillow", "بطانية": "Blanket", "كنبة": "Sofa",
    "كرسي": "Chair", "طاولة": "Table", "دولاب": "Wardrobe", "مراية": "Mirror", "ستارة": "Curtain",
    "سجادة": "Carpet", "مكيف": "Air conditioner", "مروحة": "Fan", "تلفزيون": "Television",
    "ريموت": "Remote control", "ثلاجة": "Fridge", "فرن": "Oven", "غاز": "Stove",
    "مايكروويف": "Microwave", "غسالة": "Washing machine", "مكنسة": "Vacuum cleaner", "مكوى": "Iron",
    "جرس": "Doorbell", "مفتاح": "Key", "قفل": "Lock", "شمعة": "Candle", "لمبة": "Light bulb",
    "ساعة": "Clock", "صورة": "Painting", "مزهرية": "Vase", "مرتبة": "Bed", "سلة زبالة": "Trash can",
    "شماغ": "Scarf", "علاقة ملابس": "Hanger",
    "ملعقة": "Spoon", "شوكة": "Fork", "سكين": "Knife", "صحن": "Plate", "كاسة": "Cup", "قدر": "Pot",
    "مقلاة": "Frying pan", "إبريق": "Kettle", "ترمس": "Bottle", "فنجان": "Coffee", "صينية": "Tray",
    "خبز": "Bread", "رز": "Rice", "دجاج": "Chicken", "لحم": "Meat", "سمك": "Fish", "بيض": "Egg",
    "حليب": "Milk", "جبن": "Cheese", "زبدة": "Butter", "عصير": "Juice", "ماي": "Water", "قهوة": "Coffee",
    "شاي": "Tea", "كرك": "Tea", "تمر": "Dates", "موز": "Banana", "تفاح": "Apple", "برتقال": "Orange",
    "بطيخ": "Watermelon", "عنب": "Grapes", "رمان": None, "ليمون": "Lemon", "خيار": "Cucumber",
    "طماط": "Tomato", "بصل": "Onion", "ثوم": "Garlic", "فلفل": "Pepper", "ملح": "Salt", "سكر": "Sugar",
    "عسل": "Honey", "آيس كريم": "Ice cream", "كيك": "Cake", "شوكولاتة": "Chocolate", "بيتزا": "Pizza",
    "برجر": "Burger", "شاورما": "Stuffed flatbread", "فلافل": "Falafel", "مجبوس": "Rice", "مطبق": None,
    "لقيمات": "Donut", "بوظة": "Ice cream", "مكرونة": "Pasta", "سلطة": "Salad", "شوربة": "Soup",
    "دقوس": "Hot pepper",
    "دشداشة": None, "غترة": None, "عقال": None, "عباية": None, "حجاب": "Hijab", "بشت": None,
    "قميص": "Shirt", "بنطلون": "Trousers", "جاكيت": "Jacket", "فستان": "Dress", "تنورة": "Skirt",
    "جوتي": "Shoes", "نعال": "Slippers", "جوارب": "Socks", "قبعة": "Hat", "نظارة": "Glasses",
    "ساعة يد": "Watch", "خاتم": "Ring", "سلسال": "Necklace", "حلق": "Earrings", "حزام": "Belt",
    "محفظة": "Wallet", "شنطة": "Bag", "مظلة": "Umbrella", "قفازات": "Gloves", "بيجامة": "Pajamas",
    "لباس سباحة": "Swimsuit",
    "راس": "Head", "شعر": "Hair", "عين": "Eye", "أذن": "Ear", "خشم": "Nose", "فم": "Mouth", "سن": "Tooth",
    "لسان": "Tongue", "رقبة": "Neck", "كتف": "Shoulder", "يد": "Hand", "إصبع": "Finger", "ظفر": "Nail",
    "بطن": "Stomach", "ركبة": "Knee", "رجل": "Leg", "قدم": "Foot", "قلب": "Heart", "عظم": "Bone",
    "لحية": "Beard", "شنب": "Mustache", "حواجب": "Eyebrow",
    "قطو": "Cat", "كلب": "Dog", "حصان": "Horse", "جمل": "Camel", "خروف": "Sheep", "بقرة": "Cow",
    "ماعز": "Goat", "حمار": "Donkey", "أسد": "Lion", "نمر": "Tiger", "فيل": "Elephant", "زرافة": "Giraffe",
    "قرد": "Monkey", "دب": "Bear", "ذيب": "Wolf", "ثعلب": "Fox", "أرنب": "Rabbit", "فار": "Mouse",
    "سلحفاة": "Turtle", "ثعبان": "Snake", "تمساح": "Crocodile", "ضب": "Lizard", "سمكة": "Fish",
    "قرش": "Shark", "دولفين": "Dolphin", "حوت": "Whale", "أخطبوط": "Octopus", "ربيان": "Shrimp",
    "طير": "Bird", "صقر": "Falcon", "بومة": "Owl", "ببغاء": "Parrot", "ديك": "Rooster", "دجاجة": "Chicken",
    "بطة": "Duck", "نعامة": "Ostrich", "فراشة": "Butterfly", "نحلة": "Bee", "نملة": "Ant",
    "بعوضة": "Mosquito", "صرصور": "Cockroach", "عنكبوت": "Spider", "عقرب": "Scorpion", "بطريق": "Penguin",
    "كنغر": "Kangaroo", "غزال": "Deer", "خفاش": "Bat",
    "طيار": "Pilot", "دكتور": "Doctor", "ممرضة": "Nurse", "مدرس": "Teacher", "مهندس": "Engineer",
    "شرطي": "Police officer", "إطفائي": "Firefighter", "جندي": "Soldier", "طباخ": "Chef", "خباز": "Baker",
    "حلاق": "Barber", "خياط": "Tailor", "نجار": "Carpenter", "سباك": "Plumber", "كهربائي": "Electrician",
    "ميكانيكي": "Mechanic", "سواق": "Driver", "مزارع": "Farmer", "صياد": "Fisherman", "رسام": "Painter",
    "مصور": "Photographer", "مغني": "Singer", "ممثل": "Actor", "مذيع": "News anchor",
    "لاعب كرة": "Football player", "حكم": "Referee", "مدرب": "Coach", "قاضي": "Judge", "محامي": "Lawyer",
    "صيدلي": "Pharmacist", "طبيب أسنان": "Dentist", "جراح": "Surgeon", "دكتور عيون": "Eye",
    "مهندس معماري": "Architect", "عالم": "Scientist", "رائد فضاء": "Astronaut", "غواص": "Diver",
    "حراس أمن": "Security guard", "بائع": "Cashier", "كاشير": "Cashier", "نادل": "Waiter",
    "مضيفة طيران": "Flight attendant", "إمام": "Mosque", "مؤذن": "Mosque", "معلم سواقة": "Driver",
    "ساحر": "Magician", "مهرج": "Clown", "راقص": "Dancer",
    "مدرسة": "School", "جامعة": "University", "مستشفى": "Hospital", "مسجد": "Mosque", "سوق": "Market",
    "مجمع": "Mall", "مطعم": "Restaurant", "كافيه": "Cafe", "سينما": "Cinema", "مطار": "Airport",
    "محطة بنزين": "Gas station", "بنك": "Bank", "صيدلية": "Pharmacy", "مكتبة": "Library", "ملعب": "Stadium",
    "نادي": "Gym", "مسبح": "Swimming pool", "شاليه": "Beach", "بحر": "Beach", "صحراء": "Desert",
    "جزيرة": "Island", "جبل": "Mountain", "نهر": "River", "غابة": "Forest", "مزرعة": "Farm",
    "حديقة حيوانات": "Zoo", "سجن": "Prison", "فندق": "Hotel", "مخبز": "Bakery", "جمعية": "Supermarket",
    "بقالة": "Convenience store", "مغسلة": "Laundry", "صالون": "Salon", "جم": "Gym", "ملعب كرة": "Stadium",
    "ديوانية": None, "مخيم": "Camp", "مقبرة": "Cemetery", "مصنع": "Factory", "ميناء": "Port",
    "جسر": "Bridge", "إشارة": "Traffic light", "مواقف": "Parking",
    "سيارة": "Car", "باص": "Bus", "تاكسي": "Taxi", "دراجة": "Bicycle", "سيكل": "Bicycle",
    "موتسيكل": "Motorcycle", "طيارة": "Airplane", "هليكوبتر": "Helicopter", "قطار": "Train", "مترو": "Metro",
    "سفينة": "Ship", "قارب": "Boat", "يخت": "Yacht", "لنج": "Boat", "غواصة": "Submarine", "صاروخ": "Rocket",
    "شاحنة": "Truck", "جرار": "Tractor", "سكوتر": "Scooter", "سيارة إسعاف": "Ambulance",
    "سيارة شرطة": "Police car", "سيارة إطفاء": "Fire truck", "بالون هوا": "Hot air balloon",
    "كرة قدم": "Football", "كرة سلة": "Basketball", "كرة طائرة": "Volleyball", "تنس": "Tennis",
    "بادل": "Padel", "بولينج": "Bowling", "سباحة": "Swimming", "غوص": "Diving", "ملاكمة": "Boxing",
    "كاراتيه": "Karate", "مصارعة": "Wrestling", "جري": "Running", "جمباز": "Gymnastics",
    "ركوب خيل": "Horse riding", "تزلج": "Skiing", "شطرنج": "Chess", "كيرم": None, "كوت بو ستة": "Cards",
    "بلوت": "Cards", "بلايستيشن": "PlayStation", "دومينو": "Dominoes", "حبل": "Rope", "نط الحبل": "Jump rope",
    "غميضة": "Hide and seek", "صيد": "Fishing", "جولف": "Golf", "ركوب أمواج": "Surfing", "تسلق": "Climbing",
    "رفع أثقال": "Weightlifting", "يوغا": "Yoga", "دحروج": None,
    "ينام": "Sleeping", "يصحى": "Waking up", "يأكل": "Eating", "يشرب": "Drinking", "يطبخ": "Cooking",
    "يغسل": "Washing dishes", "ينشف": "Towel", "يكنس": "Sweeping", "يكوي": "Ironing", "يسوق": "Driving",
    "يمشي": "Walking", "يركض": "Running", "يقفز": "Jumping", "يرقص": "Dancing", "يغني": "Singing",
    "يصلي": "Praying", "يقرأ": "Reading", "يكتب": "Writing", "يرسم": "Drawing", "يصور": "Taking a photo",
    "يتصل": "Phone call", "يرسل رسالة": "Texting", "يلعب": "Video games", "يسبح": "Swimming",
    "يغوص": "Diving", "يطير": "Flying", "يتسلق": "Climbing", "يصيد": "Fishing", "يخيط": "Sewing",
    "يحلق": "Shaving", "يتمكيج": "Makeup", "يتعطر": None, "يستحم": "Showering",
    "ينظف أسنانه": "Brushing teeth", "يتثاوب": "Yawning", "يعطس": "Sneezing", "يكح": "Coughing",
    "يضحك": "Laughing", "يبكي": "Crying", "يزعل": "Angry", "يخاف": "Scared", "يستحي": "Shy",
    "يتعب": "Tired", "يبوس": "Kiss", "يحضن": "Hugging", "يسلم": "Handshake", "يودع": "Waving",
    "يصافح": "Handshake", "يصفق": "Clapping", "يصفر": "Whistling", "يحسب فلوس": "Counting money",
    "يدفع": "Paying", "يشتري": "Shopping", "يبيع": "Cashier", "يسافر": "Traveling", "يحزم شنطة": "Packing",
    "يفتح باب": "Opening a door", "يسكر باب": "Door", "يطق الجرس": "Doorbell",
    "يطبخ على الفحم": "Barbecue", "يشوي": "Barbecue", "يعزف": "Playing guitar", "يصلح سيارة": "Fixing a car",
    "شمس": "Sun", "قمر": "Moon", "نجمة": "Star", "سماء": "Sky", "غيمة": "Cloud", "مطر": "Rain",
    "برق": "Lightning", "رعد": "Thunder", "ثلج": "Snow", "ريح": "Wind", "غبار": "Dust storm",
    "عاصفة": "Storm", "قوس قزح": "Rainbow", "حر": "Hot", "برد": "Cold", "نار": "Fire", "دخان": "Smoke",
    "موج": "Wave", "رمل": "Sand", "شجرة": "Tree", "وردة": "Flower", "عشب": "Grass", "صخرة": "Rock",
    "بركان": "Volcano", "زلزال": "Earthquake", "فيضان": "Flood", "سيل": "Flood",
    "تلفون": "Phone", "آيباد": "iPad", "لابتوب": "Laptop", "كمبيوتر": "Computer", "كاميرا": "Camera",
    "سماعات": "Headphones", "شاحن": "Charger", "واي فاي": "Wi-Fi", "طابعة": "Printer", "بطارية": "Battery",
    "روبوت": "Robot", "درون": "Drone", "ساعة ذكية": "Smart watch", "سيلفي": "Selfie", "فلاش": "Flash",
    "تيك توك": "TikTok", "سناب": "Snapchat", "انستقرام": "Instagram", "يوتيوب": "YouTube",
    "واتساب": "WhatsApp", "قوقل": "Google", "نتفلكس": "Netflix", "إكس بوكس": "Xbox", "صراف آلي": "ATM",
    "كاشير ذاتي": "Cashier", "باركود": "Barcode", "كاش": "Cash", "بطاقة": "Credit card", "كي نت": "Credit card",
    "عرس": "Wedding", "عيد": "Eid", "رمضان": "Ramadan", "إفطار": "Iftar", "سحور": "Suhoor",
    "قرقيعان": "Candy", "عيدية": "Cash", "ميلاد": "Birthday", "تخرج": "Graduation", "امتحان": "Exam",
    "واجب": "Homework", "دوام": "Work", "إجازة": "Vacation", "سفر": "Travel", "حج": "Kaaba", "عمرة": "Kaaba",
    "كشتة": "Camping", "بر": "Desert", "عزيمة": "Dinner", "فطور": "Breakfast", "غدا": "Lunch", "عشا": "Dinner",
    "قهوة الصبح": "Coffee", "نوم القيلولة": "Nap", "زحمة": "Traffic jam", "حادث": "Car accident",
    "مخالفة": "Speeding ticket", "موعد دكتور": "Doctor's appointment", "حقنة": "Injection", "دوا": "Medicine",
    "صداع": "Headache", "زكام": "Sneezing", "كسر": "Broken arm", "ولادة": "Baby", "خطوبة": "Engagement",
    "طلاق": "Divorce", "فوز": "Winning", "خسارة": "Losing", "هدف": "Goal", "ركلة جزاء": "Penalty kick",
    "مباراة": "Match", "حفلة": "Party", "ألعاب نارية": "Fireworks",
}

# Extra English concepts referenced only from Arabic.
EN_ICON.update({
    "Butter": "butter", "Donkey": "donkey", "Stuffed flatbread": "stuffed-flatbread", "Falafel": "falafel",
    "Hot pepper": "hot-pepper", "Hijab": "woman-with-headscarf", "Kiss": "kiss-mark", "Kaaba": "kaaba",
    "Baby": "baby", "Convenience store": "convenience-store", "Candy": "candy",
})

# --- Kuwaiti dialect words: most have no emoji, these do ---------------------
KW_ICON = {
    "دريشة": "window", "دريول": "automobile", "جوتي": "running-shoe", "قوطي": "canned-food",
    "جدر": "pot-of-food", "بزران": "children-crossing", "دقوس": "hot-pepper", "جريش": "cooked-rice",
    "لقيمات": "doughnut", "زلابية": "doughnut", "غبقة": "crescent-moon", "فوالة": "teapot",
    "قرقيعان": "candy", "كشتة": "camping", "بر": "desert", "شاليه": "beach-with-umbrella",
    "جاخور": "horse-face", "برقع": "woman-with-headscarf", "بوشية": "woman-with-headscarf",
    "نعال": "thong-sandal", "سيكل": "bicycle", "لنج": "sailboat", "بانوش": "sailboat", "محمل": "ship",
    "طواش": "oyster", "نوخذة": "anchor", "غيص": "diving-mask", "سطح": "house", "بومية": "owl",
    "طنطل": "ghost", "حمارة القايلة": "hot-face", "أم السعف": "palm-tree", "خراريف": "open-book",
    "بوطبيلة": "drum", "مسحراتي": "drum", "طقاقة": "drum", "عرضة": "crossed-swords", "فن البحر": "water-wave",
    "طاسة": "bowl-with-spoon", "دلة": "teapot", "فنجال": "hot-beverage", "سماور": "teapot", "تنور": "fire",
    "مهفة": "wind-face", "مرش": "lotion-bottle", "دهن عود": "lotion-bottle", "بخور": "fire", "مبخرة": "fire",
    "حنة": "nail-polish", "عيد": "star-and-crescent", "عيدية": "dollar-banknote", "صرافة": "dollar-banknote",
    "جمعية": "shopping-cart", "بقالة": "convenience-store", "برادة": "potable-water", "تنكة": "bucket",
    "صفرية": "pot-of-food", "ضب": "lizard", "جربوع": "mouse-face", "حمام": "dove", "قطو": "cat-face",
    "جليب": "hole", "فيران": "mouse-face", "ليفة": "sponge", "مشط": None, "كحل": "eye", "عطر": "lotion-bottle",
    "خنجر": "dagger", "سيف": "crossed-swords", "رمح": None, "طبل": "drum", "مزمار": "saxophone", "عود": "guitar",
    "ربابة": "violin", "قانون": "musical-keyboard", "دف": "drum", "منيور": "drum", "مرواس": "drum",
    "ياي": "waving-hand", "شلونك": "waving-hand", "يا هلا": "hugging-face", "زين": "thumbs-up",
    "خوش": "ok-hand", "صج": "index-pointing-up", "شفيك": "face-with-raised-eyebrow", "وايد": "raising-hands",
    "دشداشة": None, "غترة": None, "عقال": None, "شماغ": None, "بشت": None, "زري": None, "خنجر ": None,
}


def auto_icon(word, names):
    s = re.sub(r"[^a-z0-9]+", "-", word.lower()).strip("-")
    for c in (s, s.rstrip("s"), s[:-2] if s.endswith("es") else s, "person-" + s):
        if c in names:
            return c
    return None


def resolve(deck_slug, rows, names):
    out = {}
    for title, *_ in rows:
        if deck_slug.startswith("06"):
            icon = EN_ICON.get(title, auto_icon(title, names))
        elif deck_slug.startswith("05"):
            if title in AR_TO_EN:
                en = AR_TO_EN[title]
                icon = None if en is None else EN_ICON.get(en, auto_icon(en, names))
            else:
                icon = None
        else:
            icon = KW_ICON.get(title)
        if icon is not None and icon not in names:
            raise SystemExit(f"{deck_slug}: '{title}' maps to unknown icon '{icon}'")
        out[title] = icon
    return out


def main():
    OUT.mkdir(exist_ok=True)
    icons_json = NODE_DIR / "node_modules/@iconify-json/fluent-emoji-flat/icons.json"
    data = json.loads(icons_json.read_text(encoding="utf-8"))
    names = set(data["icons"]) | set(data.get("aliases", {}))

    word_decks = [(slug, name, decks.dedupe(rows)) for slug, name, rows in decks.DECKS if slug[:2] in ("05", "06", "07")]
    plan = {slug: resolve(slug, rows, names) for slug, _, rows in word_decks}

    needed = sorted({icon for m in plan.values() for icon in m.values() if icon})
    img_dir = OUT / "png"
    img_dir.mkdir(exist_ok=True)
    todo = [i for i in needed if not (img_dir / f"{i}.png").exists()]
    if todo:
        script = r"""
const sharp = require('sharp');
const data = require('@iconify-json/fluent-emoji-flat/icons.json');
const [outDir, size, ...names] = process.argv.slice(2);
(async () => {
  for (const name of names) {
    let icon = data.icons[name];
    if (!icon && data.aliases && data.aliases[name]) icon = data.icons[data.aliases[name].parent];
    const w = icon.width || data.width || 32, h = icon.height || data.height || 32;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${size}" height="${size}">${icon.body}</svg>`;
    await sharp(Buffer.from(svg)).png().toFile(`${outDir}/${name}.png`);
  }
})();
"""
        (NODE_DIR / "render.js").write_text(script)
        for i in range(0, len(todo), 200):
            subprocess.run(["node", "render.js", str(img_dir), str(SIZE), *todo[i:i + 200]], cwd=NODE_DIR, check=True)

    missing_report = []
    for slug, name, rows in word_decks:
        mapping = plan[slug]
        wb = Workbook()
        ws = wb.active
        ws.title = "manifest"
        ws.append(["title", "image"])
        with zipfile.ZipFile(OUT / f"{slug}-images.zip", "w", zipfile.ZIP_DEFLATED) as zf:
            used = set()
            for title, *_ in rows:
                icon = mapping[title]
                if icon:
                    ws.append([title, f"{icon}.png"])
                    if icon not in used:
                        zf.write(img_dir / f"{icon}.png", f"{icon}.png")
                        used.add(icon)
                else:
                    ws.append([title, ""])
                    missing_report.append(f"{slug}\t{title}")
        wb.save(OUT / f"{slug}-manifest.xlsx")
        with_pic = sum(1 for v in mapping.values() if v)
        print(f"{slug}: {with_pic}/{len(rows)} words have a picture, {len(used)} image files")

    (OUT / "pictures-missing.txt").write_text("\n".join(missing_report) + "\n", encoding="utf-8")
    print(f"{len(missing_report)} words without a picture listed in pictures-missing.txt")


if __name__ == "__main__":
    main()
