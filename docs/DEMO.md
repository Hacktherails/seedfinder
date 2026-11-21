# Démo (3 min) : déroulé et messages clés

## Avant de monter sur scène

```bash
npm start -- --reset          # base de points vide, Stripe en mode test, webhooks branchés
npm start -- --reset --offline   # plan B sans WiFi : trajets rejoués depuis le cache, paiement en mode démo
```

- Ouvrir http://localhost:5173 et faire une recherche une fois pour chauffer la page.
- Carte de test : `4242 4242 4242 4242`, date future, CVC quelconque.
- Version déployée (Render) : ouvrir l'URL une minute avant, le plan gratuit met le service en veille.

## Le déroulé

| # | À l'écran | Ce qu'on dit |
|---|---|---|
| 1 | Page d'accueil : « Le train te rapporte, l'avion non. » | Skyscanner et Omio comparent des prix. Nous, on rend le train évident **et** on le récompense. |
| 2 | Itinéraire suggéré « L'axe impérial » → Planifier | Un voyage multi-étapes, plusieurs opérateurs, nuits sur place incluses, chargé en un clic. |
| 3 | Résultats : « +N » et la pièce verte, CO₂ comparé à l'avion | Chaque trajet affiche son CO₂ face au même trajet en avion. Les billets verts rapportent des EcoTokens, proportionnels au CO₂ évité. |
| 4 | Portefeuille ECO → connexion par e-mail | 100 tokens offerts à l'inscription. (Connexion simplifiée pour la démo.) |
| 5 | Réserver → paiement Stripe **dans l'app** | Un seul paiement pour tous les billets et nuitées, tous opérateurs confondus. |
| 6 | « Bon voyage! » : +N EcoTokens, nouveau solde | Les points sont crédités par le webhook Stripe signé, ou par une vérification côté serveur. Jamais par le navigateur. |
| 7 | Deuxième réservation : case « Use N of your … EcoTokens », prix barré | La réduction apparaît dans Stripe sous forme de coupon « EcoTokens ». La boucle est bouclée : le voyageur revient chez nous, en train. |

## Pourquoi le modèle tient (question du jury)

- On touche une commission d'environ 7 % par billet. Au plus la moitié de cette commission est redistribuée en tokens, donc **chaque commande reste rentable**.
- Les tokens ne se dépensent que sur un billet vert chez nous : c'est un levier de rétention, pas une remise sèche.
- Les tokens jamais dépensés (20 à 30 % dans le voyage) sont de la marge.
- Détail des règles et exemples chiffrés : [`ECO_POINTS.md`](ECO_POINTS.md).

## Prix partenaires

- **Stripe** : Embedded Checkout, coupons générés par commande, webhooks signés (`completed` / `expired`), points mis de côté puis rendus si le paiement est abandonné.
- **Aikido** : contrôle de sécurité dans la CI, sur chaque PR (seules les nouvelles failles bloquent) et sur `main` (release gating). Le code ne quitte pas la machine (`--no-snippets`). Dernier résultat : **RELEASE GATE PASS**, aucun problème ouvert.

## Si quelque chose casse

| Problème | Parade |
|---|---|
| Plus de WiFi | Ctrl-C, puis `npm start -- --offline`. Les itinéraires suggérés et Bruxelles → Berlin marchent sans réseau. |
| Stripe ne répond pas | Même parade : en mode hors ligne, la commande est confirmée tout de suite et les points sont crédités. |
| Port déjà pris | `API_PORT=8200 WEB_PORT=5200 npm start` |
| Tout est perdu | Screencast de secours (#16) |
