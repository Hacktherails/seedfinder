# Pitch : script mot à mot avec la démo (2 ou 3 min)

Le texte à dire est en anglais (jury international, app en anglais). Les indications de jeu sont en français.
Débit visé : environ 140 mots par minute, soit à peu près 280 mots pour 2 minutes et 430 pour 3 minutes. Le déroulé technique et les plans B
sont dans [`DEMO.md`](DEMO.md), les règles des seeds dans [`SEEDS.md`](SEEDS.md).

## Rôles

- **Speaker** : parle, face au public, ne touche pas au clavier.
- **Driver** : fait la démo, suit les repères `▶` ci-dessous, ne parle pas (sauf la phrase sur Stripe si on préfère).

## Check-list 5 minutes avant

- [ ] `npm start -- --reset` lancé (ou `--offline` si le WiFi est douteux), page http://localhost:5173 ouverte et chauffée.
- [ ] Navigateur en plein écran, zoom 110 à 125 %, notifications coupées.
- [ ] Carte de test sous la main : `4242 4242 4242 4242`, date future, CVC quelconque.
- [ ] Adresse e-mail de démo prête à taper (une adresse neuve, pour avoir les 100 seeds de bienvenue).
- [ ] Onglet du dashboard Stripe (test) ouvert sur les paiements, pour montrer le coupon si on a le temps.
- [ ] Screencast de secours ouvert dans un autre onglet.
- [ ] **Version 2 min** : se connecter au Seed wallet avant de monter (100 seeds déjà visibles), pour ne pas perdre 15 s à taper l'e-mail.

## Version 2 minutes

Même démo, sans la connexion en direct (faite avant de monter) ni la deuxième réservation : la boucle de fidélité est
seulement dite. Environ 280 mots.

### 0:00 – 0:15 · Accroche

> ▶ Page d'accueil : « Find your way. Plant a seed. »

**Speaker :**
"Brussels to Berlin: about 170 kilos of CO₂ by plane, almost nothing by train. Yet we fly, because booking trains
across Europe means five websites and three payments. We're Seedfinder: we make the train easy, and we reward it."

### 0:15 – 0:35 · Le voyage en un clic

> ▶ Cliquer **Plan** sur « The Imperial Axis of Central Europe ». La carte s'anime.

**Speaker :**
"Brussels, Cologne, Berlin, Prague. Four days, several operators, live timetables, nights included. One click."

### 0:35 – 0:55 · CO₂ et seeds

> ▶ Montrer le « +N » vert et le CO₂ comparé à l'avion sur une carte de trajet.

**Speaker :**
"Every leg shows its CO₂ against the same flight. Green tickets plant seeds: one per kilo of CO₂ you keep out of the
sky. A hundred seeds, one euro off your next green trip."

### 0:55 – 1:30 · Un seul paiement Stripe

> ▶ **Book trip** → Embedded Checkout dans l'app → `4242…` → écran « Bon voyage! » avec le nouveau solde.

**Speaker :**
"Now what nobody else does: every ticket and every night, across every operator, in one single payment, inside the
app, with Stripe. … Bon voyage. The seeds are credited by a signed Stripe webhook, never by the browser. Next time,
they turn into a real Stripe coupon, valid only on a green ticket, with us. So travellers come back: to us, and to
the train."

### 1:30 – 2:00 · Le modèle et la conclusion

> ▶ Revenir sur l'accueil, section « Every green ticket plants seeds ».

**Speaker :**
"Does it pay? We earn about 7 % per ticket and give back at most half as seeds, so every order is profitable, and
unspent seeds are pure margin. It's live on Stripe, and every PR passes an Aikido security gate.
Seedfinder: find your way, plant a seed. Thank you, we look forward to your bids."

**Si le paiement traîne** (au-delà de 1:30) : le speaker enchaîne directement sur le modèle pendant que le driver termine.

## Version 3 minutes

### 0:00 – 0:25 · Accroche

> ▶ Page d'accueil affichée : « Find your way. Plant a seed. »

**Speaker :**
"Brussels to Berlin. By plane, about 170 kilos of CO₂. By train, almost nothing. Yet most of us still fly. Why?
Because booking a train across Europe means five websites, three operators and three payments. Skyscanner and Omio
compare prices. They don't make the train the obvious choice, and they certainly don't reward you for it.
We're Seedfinder. We make the train easy, and we make it pay off."

### 0:25 – 1:00 · Un voyage multi-étapes en un clic

> ▶ Faire défiler jusqu'aux itinéraires suggérés, cliquer **Plan** sur « The Imperial Axis of Central Europe ».
> ▶ La carte s'anime : Bruxelles → Cologne → Berlin → Prague.

**Speaker :**
"Here's a four-day trip: Brussels, Cologne, Berlin, Prague. Several operators, live timetables from the open European
network, and the nights in each city already included. One click, and the whole journey is on the map."

### 1:00 – 1:30 · CO₂ et seeds

> ▶ Montrer une carte de trajet : le « +N » avec la graine verte et le CO₂ comparé à l'avion.

**Speaker :**
"Every leg shows its CO₂ next to the same trip by plane. When a ticket is truly green, it plants seeds: one seed for
every kilo of CO₂ you keep out of the sky. A hundred seeds is one euro off your next green ticket."

### 1:30 – 2:15 · Un seul paiement Stripe

> ▶ Ouvrir le **Seed wallet**, se connecter avec l'e-mail de démo → 100 seeds de bienvenue.
> ▶ Cliquer **Book trip** → l'Embedded Checkout Stripe s'ouvre dans l'app → payer avec `4242…`.

**Speaker :**
"New travellers start with a hundred seeds. Now the part nobody else does: every train ticket and every night, across
every operator, in **one single payment**, right inside the app, powered by Stripe."

> ▶ Écran « Bon voyage! You planted a seed 🌱 » avec le nouveau solde.

"Bon voyage. The seeds land in the wallet, and they're credited by a signed Stripe webhook, never by the browser.
Nobody can fake their way to free tickets."

### 2:15 – 2:40 · La boucle de fidélité

> ▶ Lancer une deuxième réservation, cocher « Use N of your … seeds » : le prix barré apparaît.
> ▶ (Optionnel, si on est dans les temps) basculer sur le dashboard Stripe : le coupon « Seeds » est sur la session.

**Speaker :**
"Next trip, the seeds become a discount, created as a real Stripe coupon on the order. And they only work on a green
ticket, with us. So the traveller comes back. To us, and to the train."

### 2:40 – 3:00 · Le modèle et la conclusion

> ▶ Revenir sur l'accueil, section « Every green ticket plants seeds ».

**Speaker :**
"Does it pay? We take around 7 % commission per ticket, and at most half of it goes back as seeds. So every single
order is profitable, and seeds that are never spent are pure margin. It's built, it's secured, with an Aikido release
gate on every PR, and it runs on Stripe today.
Seedfinder: find your way, plant a seed. Thank you, and we're looking forward to your bids."

## Si la démo coince en direct

Ne pas s'excuser longuement : le speaker continue le texte, le driver applique la parade.

| Moment | Ce qui casse | Ce que dit le speaker pendant la parade |
|---|---|---|
| Carte / trajets | La recherche tourne dans le vide | "While the trains load, the key point: the whole journey, one search." Le driver relance en `--offline` (les itinéraires suggérés sont en cache). |
| Paiement | Stripe ne répond pas | "In offline mode the order confirms instantly, same seeds, same flow." Relancer `npm start -- --offline`. |
| Tout | Plus rien ne marche | Passer au screencast et garder exactement le même texte. |

## Questions probables du jury

**"Vos prix sont réels ?"**
Les horaires sont réels (Transitous, le calculateur européen ouvert MOTIS). Les prix et les nuitées sont simulés : aucune
API tarifaire paneuropéenne n'est ouverte. Pour de vrais billets, la voie la plus rapide est un grossiste comme
Distribusion, qui a une API publique et un environnement de démo. Le paiement passerait alors en capture manuelle Stripe :
on autorise la carte, on confirme chaque trajet, puis on capture uniquement ce qui est confirmé.

**"Qu'est-ce qui vous distingue d'Omio ou Trainline ?"**
Eux comparent. Nous récompensons le choix du train, avec un programme financé par notre propre commission. C'est un
levier de rétention que le voyageur ne trouve pas ailleurs, parce que les seeds ne se dépensent que chez nous.

**"Et si tout le monde dépense ses seeds ?"**
Le gain est plafonné à la moitié de la commission de la commande qui l'a généré, et la dépense à 30 % du prix d'un billet.
Une réduction consomme donc une valeur déjà financée. Le breakage (20 à 30 % de seeds jamais dépensées dans le voyage)
s'ajoute à la marge.

**"Pourquoi seulement les billets verts ?"**
Un billet est green s'il émet au plus 25 % du CO₂ de l'avion sur un trajet d'au moins 150 km. On ne récompense que ce
qui remplace vraiment un vol.

**"Et la sécurité ?"**
Les clés Stripe restent côté serveur, les montants sont calculés par l'API et jamais par le navigateur, les webhooks sont
signés, et Aikido tourne dans la CI : les nouvelles failles bloquent les PR, et `main` passe un release gate.

**"Et après le hackathon ?"**
1. Brancher un grossiste (Distribusion) pour émettre de vrais billets.
2. Héberger notre propre instance MOTIS : l'API publique de Transitous interdit l'usage commercial.
3. Remplacer la connexion démo par e-mail par une vraie authentification.

## Répétition

- Chronométrer deux passages complets avec la vraie démo, puis un avec le screencast.
- Si on dépasse 3:00, couper d'abord le passage sur le dashboard Stripe (2:15), puis la phrase sur Aikido (2:40).
- Le chiffre d'accroche (170 kg) correspond aux environ 170 seeds de Bruxelles → Berlin affichées sur l'accueil :
  vérifier à la répétition que l'app affiche bien un ordre de grandeur cohérent.
