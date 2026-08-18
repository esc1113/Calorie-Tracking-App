// seed.js — starter food library with diet-group tag profiles (restored from the deployed v4.0 bundle)
const F = (name, serving, cal, p, c, f, fiber = 0, micros = {}, kind = "food", tags = null) => ({ name, serving, cal, p, c, f, fiber, micros, kind, tags: tags || { g: {} } });
const t = (g = {}, pg = 0, pl = null, fv = null) => ({ g, pg, pl, fv });

export const SEED_FOODS = [F("Cottage cheese, fat-free", "1/2 cup (113g)", 85, 14, 5, .2, 0, {
            sodium: 400,
            calcium: 90,
            potassium: 120,
            b12: .7,
            vitA: 10
        }, "food", t()), F("Cottage cheese, 2%", "1/2 cup (113g)", 95, 12, 5, 2.7, 0, {
            sodium: 350,
            calcium: 100,
            potassium: 120,
            b12: .7
        }, "food", t()), F("Whey protein isolate", "1 scoop (31g)", 120, 24, 3, 1.5, 0, {
            sodium: 60,
            calcium: 120,
            potassium: 160,
            b12: .7
        }, "food", t()), F("Protein Creami (cottage cheese + whey)", "1 pint", 333, 59, 15.5, 2, 0, {
            sodium: 1060,
            calcium: 345,
            potassium: 460,
            b12: 2.5
        }, "recipe", t()), F("Multivitamin", "1 tablet", 0, 0, 0, 0, 0, {
            vitA: 900,
            vitC: 90,
            vitD: 20,
            vitE: 15,
            vitK: 60,
            b6: 2,
            b12: 6,
            folate: 400,
            calcium: 200,
            zinc: 11,
            magnesium: 100,
            potassium: 80
        }, "food", t()), F("Fish oil (krill + pollock)", "2 softgels", 20, 0, 0, 2.2, 0, {
            vitD: 5
        }, "food", t()), F("Creatine monohydrate", "5 g", 0, 0, 0, 0, 0, {}, "food", t()), F("Magnesium glycinate", "1 capsule (200mg)", 0, 0, 0, 0, 0, {
            magnesium: 200
        }, "food", t()), F("Energy drink, zero sugar (Ghost/C4)", "1 can (16 fl oz)", 5, 0, 1, 0, 0, {
            sodium: 10
        }, "food", t()), F("Protein shake, ready-to-drink (26g)", "1 bottle (14 fl oz)", 170, 26, 9, 4.5, 0, {
            calcium: 650,
            sodium: 230,
            vitD: 5
        }, "food", t()), F("Protein bar (Quest-style)", "1 bar (60g)", 190, 21, 21, 8, 13, {
            calcium: 130,
            sodium: 250
        }, "food", t()), F("PB2 powdered peanut butter", "2 tbsp (12g)", 60, 6, 5, 1.5, 2, {
            sodium: 90
        }, "food", t({
            nuts_seeds: .5
        }, 0, "peanut")), F("Chicken breast, cooked (no oil)", "100 g", 165, 31, 0, 3.6, 0, {
            sodium: 74,
            potassium: 256,
            magnesium: 29,
            zinc: 1,
            b6: .6,
            b12: .3,
            iron: 1
        }, "food", t()), F("Chicken thigh, cooked, skinless", "100 g", 209, 26, 0, 10.9, 0, {
            potassium: 240,
            zinc: 2.4,
            b6: .4,
            b12: .6,
            iron: 1.3,
            sodium: 88
        }, "food", t()), F("Ground turkey 93%, cooked", "100 g", 205, 26, 0, 10.5, 0, {
            potassium: 250,
            zinc: 3,
            b6: .6,
            b12: 1,
            iron: 1.4,
            sodium: 78
        }, "food", t()), F("Ground beef 93/7, cooked", "100 g", 182, 25.5, 0, 8.5, 0, {
            potassium: 330,
            zinc: 6,
            b12: 2.5,
            iron: 2.6,
            b6: .4,
            sodium: 72
        }, "food", t({
            red_meat: 1
        })), F("Ground beef 80/20, cooked", "100 g", 250, 26, 0, 16, 0, {
            potassium: 305,
            zinc: 6.2,
            b12: 2.6,
            iron: 2.5,
            sodium: 75
        }, "food", t({
            red_meat: 1
        })), F("Sirloin steak, cooked", "100 g", 200, 29, 0, 9, 0, {
            potassium: 350,
            zinc: 5.7,
            b12: 2,
            iron: 1.7,
            b6: .6,
            sodium: 60
        }, "food", t({
            red_meat: 1
        })), F("Pork chop, lean, cooked", "100 g", 190, 27, 0, 8.5, 0, {
            potassium: 360,
            zinc: 2.3,
            b6: .6,
            b12: .6,
            sodium: 60
        }, "food", t({
            red_meat: 1
        })), F("Turkey breast, roasted", "100 g", 140, 30, 0, 1.5, 0, {
            potassium: 250,
            zinc: 1.7,
            b6: .8,
            b12: .4,
            sodium: 99
        }, "food", t()), F("Salmon, cooked", "100 g", 206, 22, 0, 12, 0, {
            potassium: 384,
            vitD: 11,
            b12: 2.8,
            b6: .6,
            sodium: 61
        }, "food", t({
            fatty_fish: 1
        })), F("Canned salmon, drained", "1 can (120g)", 167, 28, 0, 6, 0, {
            calcium: 240,
            vitD: 13,
            b12: 5,
            potassium: 380,
            sodium: 450
        }, "food", t({
            fatty_fish: 1.2
        })), F("Sardines in water, drained", "1 can (92g)", 130, 17, 0, 7, 0, {
            calcium: 240,
            vitD: 4.8,
            b12: 8,
            iron: 2.7,
            sodium: 300
        }, "food", t({
            fatty_fish: .9
        })), F("Cod, cooked", "100 g", 105, 23, 0, .9, 0, {
            potassium: 244,
            b12: 1.1,
            magnesium: 42,
            sodium: 78
        }, "food", t()), F("Tilapia, cooked", "100 g", 128, 26, 0, 2.7, 0, {
            potassium: 380,
            b12: 1.9,
            vitD: 3.7,
            sodium: 56
        }, "food", t()), F("Tuna, canned in water, drained", "1 can (120g)", 128, 28, 0, 1, 0, {
            sodium: 320,
            potassium: 280,
            b12: 2.5,
            vitD: 1.2,
            iron: 1.2
        }, "food", t()), F("Shrimp, cooked", "100 g", 99, 24, 0, .3, 0, {
            sodium: 111,
            potassium: 259,
            b12: 1.4,
            zinc: 1.6
        }, "food", t()), F("Egg, large", "1 egg (50g)", 72, 6.3, .4, 4.8, 0, {
            sodium: 71,
            vitA: 80,
            vitD: 1,
            b12: .5,
            folate: 24,
            iron: .9,
            calcium: 28
        }, "food", t({
            eggs: 1
        })), F("Egg whites", "100 g (~3 whites)", 52, 11, .7, .2, 0, {
            sodium: 166,
            potassium: 163
        }, "food", t()), F("Tofu, firm", "100 g", 78, 9, 2.3, 4.2, 1, {
            calcium: 250,
            iron: 1.6,
            magnesium: 35
        }, "food", t({}, 0, "soy")), F("Tempeh", "100 g", 195, 20, 8, 11, 5, {
            iron: 2.7,
            magnesium: 81,
            calcium: 111
        }, "food", t({
            fermented: 1
        }, 0, "soy", "tempeh")), F("Deli turkey", "2 oz (56g)", 60, 10, 2, 1, 0, {
            sodium: 500
        }, "food", t()), F("Deli ham", "2 oz (56g)", 61, 9.6, 1.5, 2.2, 0, {
            sodium: 620
        }, "food", t()), F("Bacon", "2 slices (16g)", 87, 6, .2, 6.7, 0, {
            sodium: 370
        }, "food", t()), F("Breakfast sausage", "2 links (48g)", 130, 7, 1, 11, 0, {
            sodium: 330
        }, "food", t()), F("Greek yogurt, nonfat, plain", "1 container (170g)", 95, 17, 6, .5, 0, {
            calcium: 190,
            potassium: 240,
            b12: 1.3,
            sodium: 61
        }, "food", t({
            fermented: 1
        }, 0, null, "greek yogurt")), F("Kefir, low-fat", "1 cup (240ml)", 104, 9, 12, 2.5, 0, {
            calcium: 300,
            vitD: 2.5,
            b12: 1.2,
            sodium: 125
        }, "food", t({
            fermented: 1
        }, 0, null, "kefir")), F("Kimchi", "1/2 cup (75g)", 15, 1, 2.5, .3, 1.2, {
            sodium: 470,
            vitC: 8,
            vitK: 33
        }, "food", t({
            fermented: 1,
            cruciferous: .5,
            veg: .5
        }, 75, "cabbage", "kimchi")), F("Sauerkraut", "1/2 cup (75g)", 14, .7, 3, .1, 2, {
            sodium: 460,
            vitC: 11,
            vitK: 10
        }, "food", t({
            fermented: 1,
            cruciferous: .5,
            veg: .5
        }, 75, "cabbage", "sauerkraut")), F("Miso paste", "1 tbsp (17g)", 34, 2, 4.3, 1, .9, {
            sodium: 640
        }, "food", t({
            fermented: .5
        }, 0, "soy", "miso")), F("Milk, skim", "1 cup (240ml)", 83, 8.3, 12.2, .2, 0, {
            calcium: 300,
            vitD: 2.9,
            potassium: 382,
            b12: 1.2,
            sodium: 103
        }, "food", t()), F("Milk, 2%", "1 cup (240ml)", 122, 8, 12, 4.8, 0, {
            calcium: 295,
            vitD: 2.9,
            potassium: 342,
            b12: 1.3,
            sodium: 95
        }, "food", t()), F("Milk, whole", "1 cup (240ml)", 149, 7.7, 11.7, 7.9, 0, {
            calcium: 276,
            vitD: 2.7,
            potassium: 322,
            b12: 1.1,
            sodium: 105
        }, "food", t()), F("Almond milk, unsweetened", "1 cup (240ml)", 30, 1, 1, 2.5, 0, {
            calcium: 450,
            vitD: 2.5,
            vitE: 7,
            sodium: 170
        }, "food", t()), F("Oat milk", "1 cup (240ml)", 120, 3, 16, 5, 2, {
            calcium: 350,
            vitD: 3.6,
            sodium: 100
        }, "food", t()), F("Soy milk", "1 cup (240ml)", 100, 7, 8, 4, 1, {
            calcium: 300,
            vitD: 3,
            b12: 1.2,
            sodium: 90
        }, "food", t()), F("Cheddar cheese", "1 oz (28g)", 114, 6.5, .9, 9.4, 0, {
            calcium: 200,
            sodium: 180,
            vitA: 95
        }, "food", t()), F("Mozzarella, part-skim", "1 oz (28g)", 72, 6.9, .8, 4.5, 0, {
            calcium: 222,
            sodium: 175
        }, "food", t()), F("String cheese", "1 stick (28g)", 80, 7, 1, 6, 0, {
            calcium: 200,
            sodium: 200
        }, "food", t()), F("Parmesan, grated", "1 tbsp (5g)", 21, 1.4, .7, 1.4, 0, {
            calcium: 55,
            sodium: 76
        }, "food", t()), F("Feta cheese", "1 oz (28g)", 74, 4, 1.1, 6, 0, {
            calcium: 140,
            sodium: 316
        }, "food", t()), F("Cream cheese", "2 tbsp (29g)", 100, 1.8, 1.6, 9.8, 0, {
            sodium: 91,
            vitA: 90
        }, "food", t()), F("Butter", "1 tbsp (14g)", 102, .1, 0, 11.5, 0, {
            vitA: 97,
            sodium: 91
        }, "food", t()), F("Sour cream", "2 tbsp (30g)", 57, .7, 1.3, 5.6, 0, {
            calcium: 33,
            sodium: 12
        }, "food", t()), F("White rice, cooked", "1 cup (158g)", 205, 4.3, 44.5, .4, .6, {
            iron: 1.9,
            folate: 92,
            magnesium: 19,
            sodium: 2
        }, "food", t()), F("Brown rice, cooked", "1 cup (195g)", 216, 5, 44.8, 1.8, 3.5, {
            magnesium: 84,
            iron: .8,
            b6: .3,
            zinc: 1.2
        }, "food", t({
            whole_grains: 2
        }, 0, "brown rice")), F("Quinoa, cooked", "1 cup (185g)", 222, 8.1, 39.4, 3.6, 5.2, {
            magnesium: 118,
            folate: 78,
            iron: 2.8,
            zinc: 2,
            potassium: 318
        }, "food", t({
            whole_grains: 2
        }, 0, "quinoa")), F("Oats, rolled, dry", "1/2 cup (40g)", 150, 5, 27, 3, 4, {
            magnesium: 55,
            iron: 1.7,
            zinc: 1.5,
            potassium: 143
        }, "food", t({
            whole_grains: 2.5
        }, 0, "oats")), F("Oatmeal, cooked with water", "1 cup (234g)", 166, 5.9, 28.1, 3.6, 4, {
            magnesium: 63,
            iron: 2.1,
            zinc: 2.3
        }, "food", t({
            whole_grains: 2.5
        }, 0, "oats")), F("Pasta, cooked", "1 cup (140g)", 220, 8.1, 43.2, 1.3, 2.5, {
            folate: 102,
            iron: 1.8,
            sodium: 1
        }, "food", t()), F("Bread, white", "1 slice (28g)", 75, 2.6, 13.8, 1, .7, {
            sodium: 147,
            folate: 35,
            calcium: 40,
            iron: .9
        }, "food", t()), F("Bread, whole wheat", "1 slice (32g)", 81, 4, 13.8, 1.1, 1.9, {
            sodium: 144,
            magnesium: 23,
            iron: .8
        }, "food", t({
            whole_grains: 1
        }, 0, "wheat")), F("Sourdough bread", "1 slice (56g)", 130, 5, 25, 1, 1, {
            sodium: 290,
            folate: 60,
            iron: 1.4
        }, "food", t()), F("Bagel, plain", "1 bagel (105g)", 289, 11, 56, 1.7, 2.4, {
            sodium: 561,
            folate: 119,
            iron: 3.8,
            calcium: 20
        }, "food", t()), F("English muffin", "1 muffin (57g)", 134, 4.4, 26, 1, 1.6, {
            sodium: 240,
            calcium: 93,
            iron: 1.4
        }, "food", t()), F("Flour tortilla", "1 medium (45g)", 140, 4, 24, 3.5, 1, {
            sodium: 330,
            calcium: 60,
            iron: 1.5
        }, "food", t()), F("Corn tortilla", "1 tortilla (24g)", 52, 1.4, 10.7, .7, 1.5, {
            calcium: 19,
            magnesium: 17,
            sodium: 11
        }, "food", t({
            whole_grains: 1
        }, 0, "corn")), F("Potato, baked, with skin", "1 medium (173g)", 161, 4.3, 36.6, .2, 3.8, {
            potassium: 926,
            vitC: 17,
            b6: .5,
            magnesium: 48,
            iron: 1.9
        }, "food", t({
            veg: 1
        }, 0, "potato")), F("Sweet potato, baked", "1 medium (114g)", 103, 2.3, 23.6, .2, 3.8, {
            vitA: 1096,
            potassium: 542,
            vitC: 22,
            b6: .3,
            magnesium: 31
        }, "food", t({
            veg: 1,
            orange_red: 1
        }, 114, "sweet potato")), F("Corn, cooked", "1 cup (164g)", 134, 4.7, 29, 2.1, 3.9, {
            potassium: 348,
            folate: 76,
            magnesium: 43,
            vitC: 8
        }, "food", t({
            veg: 1
        }, 0, "corn")), F("Black beans, cooked", "1/2 cup (86g)", 114, 7.6, 20.4, .5, 7.5, {
            folate: 128,
            iron: 1.8,
            magnesium: 60,
            potassium: 305
        }, "food", t({
            legumes: 1,
            veg: 1
        }, 0, "black bean")), F("Chickpeas, cooked", "1/2 cup (82g)", 134, 7.3, 22.5, 2.1, 6.2, {
            folate: 141,
            iron: 2.4,
            magnesium: 39,
            potassium: 239,
            zinc: 1.3
        }, "food", t({
            legumes: 1,
            veg: 1
        }, 0, "chickpea")), F("Lentils, cooked", "1/2 cup (99g)", 115, 9, 20, .4, 7.8, {
            folate: 179,
            iron: 3.3,
            potassium: 365,
            magnesium: 36,
            zinc: 1.3
        }, "food", t({
            legumes: 1,
            veg: 1
        }, 0, "lentil")), F("Edamame, shelled, cooked", "1 cup (155g)", 188, 18.4, 13.8, 8, 8, {
            folate: 482,
            iron: 3.5,
            magnesium: 99,
            potassium: 676,
            vitC: 9.5,
            vitK: 41
        }, "food", t({
            legumes: 2,
            veg: 1
        }, 155, "edamame")), F("Hummus", "2 tbsp (30g)", 70, 2, 6, 5, 2, {
            sodium: 130,
            iron: .7
        }, "food", t({
            legumes: .25
        }, 0, "chickpea")), F("Peanut butter", "2 tbsp (32g)", 188, 8, 6.9, 16, 1.9, {
            magnesium: 57,
            sodium: 152,
            potassium: 208,
            zinc: .9,
            vitE: 2.9
        }, "food", t({
            nuts_seeds: .5
        }, 0, "peanut")), F("Almonds", "1 oz (28g)", 164, 6, 6.1, 14.2, 3.5, {
            vitE: 7.3,
            magnesium: 76,
            calcium: 76,
            iron: 1,
            potassium: 208
        }, "food", t({
            nuts_seeds: 1.4
        }, 0, "almond")), F("Walnuts", "1 oz (28g)", 185, 4.3, 3.9, 18.5, 1.9, {
            magnesium: 45,
            folate: 28
        }, "food", t({
            nuts_seeds: 1.4
        }, 0, "walnut")), F("Cashews", "1 oz (28g)", 157, 5.2, 8.6, 12.4, .9, {
            magnesium: 83,
            zinc: 1.6,
            iron: 1.9
        }, "food", t({
            nuts_seeds: 1.4
        }, 0, "cashew")), F("Peanuts", "1 oz (28g)", 161, 7.3, 4.6, 14, 2.4, {
            magnesium: 48,
            folate: 68,
            vitE: 2.4
        }, "food", t({
            nuts_seeds: 1.4
        }, 0, "peanut")), F("Pumpkin seeds", "1 oz (28g)", 158, 8.6, 3, 13.9, 1.7, {
            magnesium: 156,
            zinc: 2.2,
            iron: 2.3
        }, "food", t({
            nuts_seeds: 1.4
        }, 0, "pumpkin seed")), F("Chia seeds", "2 tbsp (28g)", 138, 4.7, 11.9, 8.7, 9.8, {
            calcium: 179,
            magnesium: 95,
            iron: 2.2
        }, "food", t({
            nuts_seeds: 1.4
        }, 0, "chia")), F("Ground flaxseed", "2 tbsp (14g)", 75, 2.6, 4, 6, 3.8, {
            magnesium: 55,
            folate: 12
        }, "food", t({
            nuts_seeds: .7
        }, 0, "flax")), F("Olive oil", "1 tbsp (14g)", 119, 0, 0, 13.5, 0, {
            vitE: 1.9,
            vitK: 8.1
        }, "food", t()), F("Avocado", "1/2 fruit (100g)", 160, 2, 8.5, 14.7, 6.7, {
            potassium: 485,
            folate: 81,
            vitE: 2.1,
            vitK: 21,
            vitC: 10,
            magnesium: 29
        }, "food", t({
            fruit: 1
        }, 100, "avocado")), F("Apple", "1 medium (182g)", 95, .5, 25, .3, 4.4, {
            vitC: 8.4,
            potassium: 195
        }, "food", t({
            fruit: 2
        }, 182, "apple")), F("Banana", "1 medium (118g)", 105, 1.3, 27, .4, 3.1, {
            potassium: 422,
            vitC: 10,
            b6: .4,
            magnesium: 32
        }, "food", t({
            fruit: 1.5
        }, 118, "banana")), F("Orange", "1 medium (131g)", 62, 1.2, 15.4, .2, 3.1, {
            vitC: 70,
            folate: 40,
            calcium: 52,
            potassium: 237
        }, "food", t({
            fruit: 1.5
        }, 131, "orange")), F("Strawberries", "1 cup (152g)", 49, 1, 11.7, .5, 3, {
            vitC: 89,
            folate: 36,
            potassium: 233
        }, "food", t({
            fruit: 2,
            berries: 2
        }, 152, "strawberry")), F("Blueberries", "1 cup (148g)", 84, 1.1, 21.4, .5, 3.6, {
            vitC: 14.4,
            vitK: 28.6,
            potassium: 114
        }, "food", t({
            fruit: 2,
            berries: 2
        }, 148, "blueberry")), F("Frozen wild blueberries", "1 cup (140g)", 71, .7, 17, .4, 4, {
            vitC: 3,
            vitK: 24
        }, "food", t({
            fruit: 2,
            berries: 2
        }, 140, "wild blueberry")), F("Raspberries", "1 cup (123g)", 64, 1.5, 14.7, .8, 8, {
            vitC: 32,
            magnesium: 27,
            vitK: 9.6
        }, "food", t({
            fruit: 1.5,
            berries: 2
        }, 123, "raspberry")), F("Grapes", "1 cup (151g)", 104, 1.1, 27.3, .2, 1.4, {
            vitC: 4.8,
            potassium: 288,
            vitK: 22
        }, "food", t({
            fruit: 2
        }, 151, "grape")), F("Watermelon, diced", "1 cup (152g)", 46, .9, 11.5, .2, .6, {
            vitC: 12.3,
            vitA: 43,
            potassium: 170
        }, "food", t({
            fruit: 2
        }, 152, "watermelon")), F("Cantaloupe, diced", "1 cup (160g)", 54, 1.3, 13, .3, 1.4, {
            vitA: 270,
            vitC: 59,
            potassium: 428
        }, "food", t({
            fruit: 2
        }, 160, "cantaloupe")), F("Mango, diced", "1 cup (165g)", 99, 1.4, 24.7, .6, 2.6, {
            vitC: 60,
            vitA: 89,
            folate: 71,
            potassium: 277
        }, "food", t({
            fruit: 2
        }, 165, "mango")), F("Pineapple, diced", "1 cup (165g)", 82, .9, 21.6, .2, 2.3, {
            vitC: 79,
            potassium: 180
        }, "food", t({
            fruit: 2
        }, 165, "pineapple")), F("Peach", "1 medium (150g)", 59, 1.4, 14, .4, 2.3, {
            vitC: 10,
            potassium: 285
        }, "food", t({
            fruit: 2
        }, 150, "peach")), F("Pear", "1 medium (178g)", 101, .6, 27, .2, 5.5, {
            vitC: 8,
            potassium: 206
        }, "food", t({
            fruit: 2
        }, 178, "pear")), F("Cherries", "1 cup (154g)", 97, 1.6, 24.7, .3, 3.2, {
            vitC: 10.8,
            potassium: 342
        }, "food", t({
            fruit: 2
        }, 154, "cherry")), F("Kiwi", "1 fruit (69g)", 42, .8, 10.1, .4, 2.1, {
            vitC: 64,
            vitK: 28,
            potassium: 215
        }, "food", t({
            fruit: 1
        }, 69, "kiwi")), F("Grapefruit", "1/2 fruit (123g)", 52, .9, 13.2, .2, 2, {
            vitC: 38.4,
            vitA: 71,
            potassium: 166
        }, "food", t({
            fruit: 1.5
        }, 123, "grapefruit")), F("Broccoli, cooked", "1 cup (156g)", 55, 3.7, 11.2, .6, 5.1, {
            vitC: 101,
            vitK: 220,
            folate: 168,
            potassium: 457,
            vitA: 120,
            calcium: 62
        }, "food", t({
            cruciferous: 1,
            veg: 2
        }, 156, "broccoli")), F("Cauliflower, cooked", "1 cup (124g)", 29, 2.3, 5.1, .6, 2.9, {
            vitC: 55,
            folate: 55,
            vitK: 17,
            potassium: 176
        }, "food", t({
            cruciferous: 1,
            veg: 1.5
        }, 124, "cauliflower")), F("Cauliflower rice", "1 cup (107g)", 25, 2, 5, .3, 2, {
            vitC: 52,
            folate: 61,
            potassium: 320
        }, "food", t({
            cruciferous: 1,
            veg: 1.3
        }, 107, "cauliflower")), F("Brussels sprouts, cooked", "1 cup (156g)", 56, 4, 11, .8, 4.1, {
            vitC: 97,
            vitK: 219,
            folate: 94,
            potassium: 495
        }, "food", t({
            cruciferous: 1,
            veg: 2
        }, 156, "brussels sprout")), F("Kale, cooked", "1 cup (118g)", 36, 2.5, 7, .5, 2.6, {
            vitK: 494,
            vitA: 172,
            vitC: 21,
            calcium: 94,
            potassium: 296
        }, "food", t({
            cruciferous: 1,
            leafy_greens: 2,
            veg: 1.5
        }, 118, "kale")), F("Spinach, cooked", "1/2 cup (90g)", 21, 2.7, 3.4, .2, 2.2, {
            vitA: 472,
            vitK: 444,
            folate: 131,
            iron: 3.2,
            magnesium: 78,
            calcium: 122,
            potassium: 419
        }, "food", t({
            leafy_greens: 1,
            veg: 1
        }, 90, "spinach")), F("Spinach, raw", "2 cups (60g)", 14, 1.7, 2.2, .2, 1.3, {
            vitK: 289,
            vitA: 281,
            folate: 116,
            iron: 1.6,
            magnesium: 47,
            potassium: 335
        }, "food", t({
            leafy_greens: 2,
            veg: .8
        }, 60, "spinach")), F("Romaine lettuce", "2 cups (94g)", 16, 1.2, 3.1, .3, 2, {
            vitA: 409,
            vitK: 96,
            folate: 128,
            potassium: 232
        }, "food", t({
            leafy_greens: 2,
            veg: 1.2
        }, 94, "romaine")), F("Mixed greens", "2 cups (60g)", 15, 1.4, 2.7, .2, 1.5, {
            vitA: 250,
            vitK: 150,
            folate: 80
        }, "food", t({
            leafy_greens: 2,
            veg: .8
        }, 60, "mixed greens")), F("Arugula", "2 cups (40g)", 10, 1, 1.5, .3, .6, {
            vitK: 44,
            folate: 39,
            calcium: 64
        }, "food", t({
            cruciferous: .4,
            leafy_greens: 2,
            veg: .5
        }, 40, "arugula")), F("Cabbage, raw, shredded", "1 cup (89g)", 22, 1.1, 5.2, .1, 2.2, {
            vitC: 33,
            vitK: 68,
            folate: 38
        }, "food", t({
            cruciferous: 1,
            veg: 1.1
        }, 89, "cabbage")), F("Carrots", "1 medium (61g)", 25, .6, 5.8, .1, 1.7, {
            vitA: 509,
            potassium: 195,
            vitK: 8
        }, "food", t({
            orange_red: 1,
            veg: .8
        }, 61, "carrot")), F("Bell pepper, red", "1 medium (119g)", 37, 1.2, 7.2, .4, 2.5, {
            vitC: 152,
            vitA: 187,
            b6: .3,
            folate: 55,
            potassium: 251
        }, "food", t({
            orange_red: 1,
            veg: 1.5
        }, 119, "bell pepper")), F("Tomato", "1 medium (123g)", 22, 1.1, 4.8, .2, 1.5, {
            vitC: 17,
            potassium: 292,
            vitA: 51,
            vitK: 9.7
        }, "food", t({
            orange_red: 1,
            veg: 1.5
        }, 123, "tomato")), F("Cucumber, sliced", "1 cup (104g)", 16, .7, 3.8, .1, .5, {
            vitK: 17,
            potassium: 153
        }, "food", t({
            veg: 1.3
        }, 104, "cucumber")), F("Onion, chopped", "1/2 cup (80g)", 32, .9, 7.5, .1, 1.4, {
            vitC: 5.9,
            potassium: 117
        }, "food", t({
            veg: 1
        }, 80, "onion")), F("Green beans, cooked", "1 cup (125g)", 44, 2.4, 9.9, .4, 4, {
            vitC: 12,
            vitK: 48,
            folate: 41,
            potassium: 182
        }, "food", t({
            veg: 1.6
        }, 125, "green bean")), F("Zucchini, cooked", "1 cup (180g)", 27, 2, 5, .5, 1.8, {
            vitC: 21,
            potassium: 455,
            vitA: 50
        }, "food", t({
            veg: 2.2
        }, 180, "zucchini")), F("Mushrooms, cooked", "1 cup (156g)", 44, 3.4, 8.3, .7, 3.4, {
            potassium: 555,
            vitD: .3,
            zinc: 1.4
        }, "food", t({
            veg: 2
        }, 156, "mushroom")), F("Asparagus, cooked", "1 cup (180g)", 40, 4.3, 7.4, .4, 3.6, {
            folate: 268,
            vitK: 91,
            iron: 1.6,
            vitA: 90,
            potassium: 403
        }, "food", t({
            veg: 2.2
        }, 180, "asparagus")), F("Celery", "2 stalks (80g)", 13, .6, 2.4, .1, 1.3, {
            vitK: 23,
            potassium: 208,
            sodium: 64
        }, "food", t({
            veg: 1
        }, 80, "celery")), F("Mixed vegetables, frozen, cooked", "1 cup (182g)", 59, 2.6, 13.5, .2, 4, {
            vitA: 389,
            potassium: 308,
            folate: 35
        }, "food", t({
            veg: 2.3,
            orange_red: .5
        }, 182, "mixed vegetables")), F("Pickles, dill", "1 spear (35g)", 4, .2, .8, .1, .4, {
            sodium: 283
        }, "food", t({
            veg: .4
        }, 35, "cucumber")), F("Chicken broth", "1 cup (240ml)", 12, 1, 1, 0, 0, {
            sodium: 860
        }, "food", t()), F("Sugar-free jello", "1 cup (240g)", 10, 1, 1, 0, 0, {
            sodium: 90
        }, "food", t()), F("Salsa", "2 tbsp (32g)", 10, .5, 2, 0, .5, {
            sodium: 180,
            vitC: 2
        }, "food", t({
            orange_red: .2,
            veg: .2
        }, 32, "tomato")), F("Marinara sauce", "1/2 cup (125g)", 70, 2, 10, 2.5, 2, {
            sodium: 480,
            vitA: 25,
            potassium: 380
        }, "food", t({
            orange_red: 1,
            veg: 1
        }, 125, "tomato")), F("Guacamole", "2 tbsp (30g)", 50, 1, 3, 4.5, 2, {
            sodium: 90,
            potassium: 150
        }, "food", t({}, 30, "avocado")), F("Ketchup", "1 tbsp (17g)", 17, .2, 4.5, 0, 0, {
            sodium: 154
        }, "food", t()), F("Mustard", "1 tsp (5g)", 3, .2, .3, .2, 0, {
            sodium: 55
        }, "food", t()), F("Mayonnaise", "1 tbsp (14g)", 94, .1, .1, 10.3, 0, {
            sodium: 88
        }, "food", t()), F("Light mayonnaise", "1 tbsp (15g)", 36, .1, 1.3, 3.5, 0, {
            sodium: 100
        }, "food", t()), F("Ranch dressing", "2 tbsp (30g)", 129, .4, 1.8, 13.4, 0, {
            sodium: 270
        }, "food", t()), F("Soy sauce", "1 tbsp (16g)", 8, 1.3, .8, 0, 0, {
            sodium: 879
        }, "food", t()), F("Sriracha", "1 tsp (7g)", 5, .1, 1, .1, 0, {
            sodium: 80
        }, "food", t()), F("BBQ sauce", "2 tbsp (36g)", 70, .3, 17, .2, 0, {
            sodium: 350
        }, "food", t()), F("Honey", "1 tbsp (21g)", 64, 0, 17.3, 0, 0, {}, "food", t()), F("Maple syrup", "1 tbsp (20g)", 52, 0, 13.4, 0, 0, {}, "food", t()), F("Jam / jelly", "1 tbsp (20g)", 56, 0, 14, 0, 0, {}, "food", t()), F("Sugar", "1 tsp (4g)", 16, 0, 4.2, 0, 0, {}, "food", t()), F("Sugar-free syrup", "1/4 cup (60ml)", 15, 0, 4, 0, 0, {
            sodium: 95
        }, "food", t()), F("Dark chocolate 70-85%", "1 oz (28g)", 170, 2.2, 13, 12.1, 3.1, {
            iron: 3.4,
            magnesium: 65,
            potassium: 203
        }, "food", t()), F("Rice cake", "1 cake (9g)", 35, .7, 7.3, .3, .4, {}, "food", t({
            whole_grains: .5
        }, 0, "brown rice")), F("Popcorn, air-popped", "3 cups (24g)", 93, 3, 18.6, 1.1, 3.5, {
            magnesium: 34,
            zinc: .7
        }, "food", t({
            whole_grains: 1.5
        }, 0, "corn")), F("Tortilla chips", "1 oz (28g)", 140, 2, 19, 7, 1.2, {
            sodium: 119
        }, "food", t()), F("Potato chips", "1 oz (28g)", 155, 2, 14, 10, 1.2, {
            sodium: 170,
            potassium: 336
        }, "food", t()), F("Pretzels", "1 oz (28g)", 108, 2.6, 22.5, .8, .9, {
            sodium: 350
        }, "food", t()), F("Granola", "1/4 cup (30g)", 135, 3, 17, 6, 2, {
            magnesium: 30,
            iron: 1
        }, "food", t({
            whole_grains: 1
        }, 0, "oats")), F("Ice cream, vanilla", "1/2 cup (66g)", 137, 2.3, 15.6, 7.3, .5, {
            calcium: 84,
            vitA: 78
        }, "food", t()), F("Light ice cream (Halo Top-style)", "1/2 cup (64g)", 70, 5, 14, 2, 3, {
            calcium: 110,
            sodium: 105
        }, "food", t()), F("Pancake", "1 pancake 4in (38g)", 86, 2.4, 11, 3.5, .5, {
            sodium: 167,
            calcium: 83
        }, "food", t()), F("Frozen waffle", "1 waffle (35g)", 95, 2.2, 14.6, 3, .8, {
            sodium: 220,
            iron: 1.6
        }, "food", t()), F("Croissant", "1 medium (57g)", 231, 4.7, 26, 12, 1.5, {
            sodium: 424,
            vitA: 60
        }, "food", t()), F("Cheese pizza", "1 slice (1/8 of 14in)", 285, 12.2, 35.7, 10.4, 2.5, {
            sodium: 640,
            calcium: 201,
            iron: 2.5
        }, "food", t()), F("Cheeseburger, fast food", "1 burger", 300, 15, 32, 13, 1.5, {
            sodium: 720,
            calcium: 120,
            iron: 2.5
        }, "food", t({
            red_meat: .7
        })), F("French fries", "1 medium serving (117g)", 365, 4, 48, 17, 4, {
            sodium: 270,
            potassium: 677
        }, "food", t()), F("Chicken nuggets", "6 pieces (96g)", 250, 14, 15, 15, 1, {
            sodium: 500
        }, "food", t()), F("Chicken burrito, restaurant-style", "1 burrito (estimate)", 950, 48, 100, 34, 10, {
            sodium: 2100,
            potassium: 900,
            calcium: 350,
            iron: 5
        }, "food", t({
            legumes: 1,
            veg: 1
        }, 60, "black bean")), F("California roll", "8 pieces (220g)", 255, 9, 38, 7, 3, {
            sodium: 428
        }, "food", t({
            veg: .5
        }, 40, "cucumber")), F("Instant ramen", "1 package (85g)", 380, 9, 54, 14, 2, {
            sodium: 1590,
            iron: 3.5
        }, "food", t()), F("Mac and cheese, prepared", "1 cup (198g)", 350, 10, 48, 13, 1.5, {
            sodium: 720,
            calcium: 120
        }, "food", t()), F("Orange juice", "1 cup (240ml)", 112, 1.7, 25.8, .5, .5, {
            vitC: 124,
            potassium: 496,
            folate: 74,
            calcium: 27
        }, "food", t()), F("Apple juice", "1 cup (240ml)", 114, .2, 28, .3, .2, {
            potassium: 250,
            vitC: 2
        }, "food", t()), F("Coca-Cola", "1 can (12 fl oz)", 140, 0, 39, 0, 0, {
            sodium: 45
        }, "food", t()), F("Diet soda", "1 can (12 fl oz)", 0, 0, 0, 0, 0, {
            sodium: 40
        }, "food", t()), F("Sports drink (Gatorade)", "20 fl oz", 140, 0, 36, 0, 0, {
            sodium: 270,
            potassium: 80
        }, "food", t()), F("Coffee, black", "1 cup (240ml)", 2, .3, 0, 0, 0, {
            potassium: 116
        }, "food", t()), F("Beer", "12 fl oz", 153, 1.6, 12.6, 0, 0, {}, "food", t()), F("Light beer", "12 fl oz", 103, .9, 5.8, 0, 0, {}, "food", t()), F("Wine", "5 fl oz", 122, .1, 3.8, 0, 0, {
            potassium: 187
        }, "food", t()), F("Vodka / spirits, 80 proof", "1.5 fl oz", 97, 0, 0, 0, 0, {}, "food", t())];
