# Points ECO (EcoTokens)

Les voyageurs gagnent des points ECO quand ils achètent un billet « green ». Le nombre de points est proportionnel au CO₂ évité par rapport au même trajet en avion. Les points se dépensent ensuite comme réduction sur un futur billet green.

## Règles (source : `apps/api/trainscanner/eco.py`)

| Règle | Valeur |
|---|---|
| Billet green | ≤ 25 % du CO₂ de l'avion, et vol équivalent ≥ 150 km |
| Gain | 1 point par kg de CO₂ évité |
| Plafond de gain | 50 % de notre commission (7 %) sur la commande |
| Valeur | 1 point = 0,01 € (100 points = 1 €) |
| Dépense | billets green uniquement, min. 50 points, max. 30 % du prix |
| Bonus de bienvenue | 100 points |

Exemple réel : Paris → Amsterdam à 66,09 €, 2,6 kg de CO₂ en train contre 116 kg en avion. Le voyageur gagne +113 points (1,13 €). Notre commission est de 4,63 € et le budget points de 2,31 €, donc la commande reste rentable.

## Pourquoi le modèle tient

- **Financé à la source** : chaque commande ne distribue en points qu'au maximum la moitié de sa propre commission. La marge reste positive dès le gain, quel que soit le CO₂.
- **Dépense = passif déjà financé** : une réduction consomme de la valeur payée par une commande précédente. Le plafond de 30 % garantit que l'essentiel du billet reste payé en carte.
- **Breakage** : les points jamais dépensés (20 à 30 % dans le voyage) sont de la marge pure.
- **Rétention** : les points ne se dépensent que sur un billet green chez nous. Le voyageur revient donc chez nous plutôt que chez un concurrent ou en avion.

## Parcours technique

1. Connexion démo par e-mail seulement (`POST /api/account`). Le compte est créé à la première connexion et l'id sert de jeton. C'est la partie qu'on simplifie pour la démo.
2. Les résultats affichent `green` et `eco_points`. Le devis `GET /api/checkout/quote` calcule la réduction côté serveur.
3. `POST /api/checkout` bloque les points utilisés, crée un coupon Stripe unique (« EcoTokens (N) ») et ouvre un Embedded Checkout dans l'app. La page hébergée sert de repli si `VITE_STRIPE_PUBLISHABLE_KEY` est absente.
4. Paiement : le webhook `checkout.session.completed` ou `POST /api/orders/{id}/confirm` (qui interroge Stripe) crédite les points gagnés, une seule fois.
5. Abandon : fermer la fenêtre de paiement ou le webhook `checkout.session.expired` (session de 31 min) rend les points bloqués.

Données : SQLite dans `.data/eco.sqlite3`, ignoré par git. On le supprime pour repartir de zéro avant la démo.
