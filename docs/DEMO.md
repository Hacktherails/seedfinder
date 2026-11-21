# Démo (3 min) : déroulé et messages clés

Script mot à mot du pitch, calé sur ce déroulé : [`PITCH.md`](PITCH.md).

## Avant de monter sur scène

```bash
npm start -- --reset          # base de seeds vide, Stripe en mode test, webhooks branchés
npm start -- --reset --offline   # plan B sans WiFi : trajets rejoués depuis le cache, paiement en mode démo
```

- Ouvrir http://localhost:5173 et faire une recherche une fois pour chauffer la page.
- Carte de test : `4242 4242 4242 4242`, date future, CVC quelconque.
- Version déployée (Render) : ouvrir l'URL une minute avant, le plan gratuit met le service en veille.

## Le déroulé

| # | À l'écran | Ce qu'on dit |
|---|---|---|
| 1 | Page d'accueil : « Find your way. Plant a seed. » | Skyscanner et Omio comparent des prix. Nous, on rend le train évident **et** on le récompense : chaque train pris à la place de l'avion plante des seeds. |
| 2 | Itinéraire suggéré « The Imperial Axis of Central Europe » → Plan | Un voyage multi-étapes, plusieurs opérateurs, nuits sur place incluses, chargé en un clic. |
| 3 | Résultats : « +N » avec la graine verte, CO₂ comparé à l'avion | Chaque trajet affiche son CO₂ face au même trajet en avion. Les billets verts plantent des seeds, proportionnelles au CO₂ évité (1 seed par kg). |
| 4 | Seed wallet → connexion par e-mail | 100 seeds offertes à l'inscription, et une progression de la graine à la forêt. (Connexion simplifiée pour la démo.) |
| 5 | Réserver → paiement Stripe **dans l'app** | Un seul paiement pour tous les billets et nuitées, tous opérateurs confondus. |
| 6 | « Bon voyage! » : +N seeds, nouveau solde | Les seeds sont créditées par le webhook Stripe signé, ou par une vérification côté serveur. Jamais par le navigateur. |
| 7 | Deuxième réservation : case « Use N of your … seeds », prix barré | La réduction apparaît dans Stripe sous forme de coupon « Seeds ». La boucle est bouclée : le voyageur revient chez nous, en train. |

## Pourquoi le modèle tient (question du jury)

- On touche une commission d'environ 7 % par billet. Au plus la moitié de cette commission est redistribuée en seeds, donc **chaque commande reste rentable**.
- Les seeds ne se dépensent que sur un billet vert chez nous : c'est un levier de rétention, pas une remise sèche.
- Les seeds jamais dépensées (20 à 30 % dans le voyage) sont de la marge.
- Détail des règles et exemples chiffrés : [`SEEDS.md`](SEEDS.md).

## Prix partenaires

- **Stripe** : Embedded Checkout, coupons générés par commande, webhooks signés (`completed` / `expired`), seeds mises de côté puis rendues si le paiement est abandonné.
- **Aikido** : contrôle de sécurité dans la CI, sur chaque PR (seules les nouvelles failles bloquent) et sur `main` (release gating). Le code ne quitte pas la machine (`--no-snippets`). Dernier résultat : **RELEASE GATE PASS**, aucun problème ouvert.

## Si quelque chose casse

| Problème | Parade |
|---|---|
| Plus de WiFi | Ctrl-C, puis `npm start -- --offline`. Les itinéraires suggérés et Bruxelles → Berlin marchent sans réseau. |
| Stripe ne répond pas | Même parade : en mode hors ligne, la commande est confirmée tout de suite et les seeds sont créditées. |
| Port déjà pris | `API_PORT=8200 WEB_PORT=5200 npm start` |
| Tout est perdu | Screencast de secours (#16) |
