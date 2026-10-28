# PRD — Plateforme de jeux interactifs pour streamers

**Version :** 0.1 — 28 octobre 2026  
**Échéance de démo :** samedi 31 octobre 2026  
**Statut :** cadrage MVP

## 1. Vision

Permettre à un streamer de lancer un jeu interactif sur son stream et à ses viewers de rejoindre depuis leur téléphone, sans installation ni compte. Les actions envoyées depuis le mobile doivent modifier immédiatement la partie affichée dans l’overlay du stream.

## 2. Objectif du MVP

Livrer une démo web responsive démontrant une boucle complète : le streamer crée une session, voit les informations d’accès viewer, choisit parmi cinq jeux 2D, règle la durée de 3 à 10 minutes, choisit s’il participe ou anime seulement, puis lance la partie. Les viewers rejoignent avec un pseudo et un QR code et jouent ensemble depuis leur navigateur mobile.

### Réussite attendue

- Un streamer peut lancer une session et ouvrir son overlay dans OBS comme source navigateur.
- Un viewer peut rejoindre depuis un téléphone avec un lien ou un QR code, sans compte.
- Une action mobile produit un retour immédiat sur le téléphone et un effet visible dans l’arène 2D.
- Le score de l’équipe ou des joueurs évolue selon les règles du jeu choisi.
- Le streamer peut déclencher un événement spécial.
- Un classement de session affiche les cinq meilleurs joueurs et leurs points.

## 3. Utilisateurs et besoins

### Streamer

- Créer et démarrer une session rapidement.
- Voir le QR code et le lien viewer avant de lancer la partie.
- Choisir avant le lancement s’il participe au combat ou reste streamer/commentateur.
- S’il participe, attaquer depuis le dashboard et apparaître dans le classement.
- Ajouter l’overlay à OBS sans installer de plugin natif.
- Afficher un QR code et un lien faciles à partager.
- Voir le nombre de joueurs connectés et l’état de la session.
- Déclencher un événement spécial et afficher le top 5.

### Viewer

- Rejoindre depuis le navigateur mobile, sans installation ni compte.
- Choisir un pseudo.
- Utiliser les commandes adaptées au jeu choisi : saut, attaque, réponse quiz, direction de bille ou poussée.
- Voir immédiatement si son action est acceptée et son score évoluer.
- Consulter le classement de la session.

## 4. Parcours principaux

### Parcours streamer

1. Crée une session et choisit un jeu parmi les cinq ainsi qu’une durée de 3 à 10 minutes.
2. Dans le lobby, récupère le lien et le QR code viewer, puis ajoute l’URL de l’overlay comme source navigateur OBS.
3. Choisit « Je participe aussi » ou « J’anime le live ».
4. Lance la session. L’overlay affiche le jeu, le QR code, le lien, le chrono et l’état.
5. Si le jeu le permet, participe depuis le dashboard ; sinon, anime le live et déclenche les événements disponibles.
6. Suit les joueurs, les dégâts et le classement.
7. Termine la session.

### Parcours viewer

1. Scanne le QR code ou ouvre le lien partagé.
2. Saisit un pseudo.
3. Reçoit la manette mobile.
4. Utilise les commandes adaptées au jeu. L’interface confirme l’action et l’arène montre son impact.
5. Suit ses points et sa position au classement.

## 5. Fonctionnalités MVP

### Session et entrée

- Créer une session avec code court et URL partageable.
- Générer un QR code qui ouvre la page de la session.
- Autoriser un pseudo libre avec validation simple.
- Afficher les états : en attente, en cours, terminée, déconnectée.

### Catalogue MVP : cinq jeux courts

- **Pixel Jump Royale** : platformer 2D collectif ; les viewers sautent au bon moment pour éviter les obstacles.
- **Co-Op Boss Raid** : shooter 2D coopératif contre un boss.
- **Speed Quiz Show** : quiz à choix multiples renouvelé après les bonnes réponses, avec points et classement.
- **Marble Fall 2D** : course de billes à obstacles, guidée depuis le mobile.
- **Arena Royale 2D** : sumo 2D compétitif, poussées directionnelles et classement.
- Le streamer sélectionne un jeu et une durée entre 3 et 10 minutes dans le lobby ; le choix est verrouillé au lancement.
- Un compte à rebours serveur partagé termine la partie et conserve le classement final.

### Jeu Co-Op Boss Raid

- Jeu 2D dans un canvas adapté à l’overlay.
- Boss avec barre de vie visible.
- Attaque viewer avec cadence limitée côté serveur.
- Participation streamer facultative, choisie dans le lobby avant le lancement.
- Si le streamer participe, son bouton d’attaque utilise la même cadence et les mêmes dégâts que les viewers ; il figure dans le classement sous le pseudo « Streamer ».
- Si le streamer n’y participe pas, il garde les commandes d’animation mais ne reçoit aucun score de combat.
- Effet visuel à chaque attaque acceptée.
- Compteur global de dégâts et nombre de joueurs actifs.
- Bouton streamer pour déclencher une phase ou attaque spéciale.
- Écran de victoire ou de fin lorsque les PV du boss atteignent zéro ou que le streamer termine la partie.

### Classement

- Score individuel basé sur les dégâts acceptés.
- Classement calculé et maintenu côté serveur.
- Top 5 visible dans le tableau de bord et dans l’overlay.
- Pseudos affichés avec score et rang.
- Égalités départagées par l’ordre d’atteinte du score.
- Scores conservés pendant la session seulement ; aucune persistance après la démo.

### Interface et responsive

- Palette principale violet et blanc, avec contraste lisible.
- Tableau de bord optimisé pour ordinateur.
- Manette viewer optimisée pour téléphone, grandes zones tactiles et aucun défilement pendant le jeu.
- Overlay transparent et lisible en 16:9, avec éléments placés sans masquer l’action.
- La web app fonctionne sans installation.

## 6. Temps réel et règles

- Utiliser Socket.IO pour les événements de session et les mises à jour de jeu.
- Chaque session utilise une room distincte.
- Le serveur valide les attaques, applique une cadence d’une attaque par joueur toutes les 800 ms, calcule les dégâts et met à jour le classement.
- Valeurs initiales à régler après un premier essai : boss à 1 000 PV ; attaque à 10 dégâts.
- Le streamer peut activer « Rage du boss » une fois toutes les 30 secondes ; pendant 10 secondes, les attaques viewer infligent 20 dégâts et l’overlay affiche clairement l’événement.
- Les mini-jeux se terminent automatiquement à la fin du compte à rebours choisi (3 à 10 minutes) ; Boss Raid peut aussi se terminer quand les PV du boss atteignent zéro. Le streamer peut terminer la session à tout moment.
- Les dégâts sont conservés par joueur jusqu’à la fin de la session, même après une déconnexion.
- Le client reçoit une confirmation immédiate de son action et l’état partagé de la partie.
- Reconnexion simple : le client récupère l’état courant de la session.
- Les sessions et scores sont en mémoire pour le MVP ; un redémarrage serveur les efface.
- Le serveur génère un jeton hôte imprévisible. Seul le tableau de bord hôte peut déclencher les événements ou terminer la session ; l’overlay reste en lecture seule.
- Pseudos : 1 à 16 caractères, lettres, chiffres, espaces et tirets bas ; supprimer les espaces au début et à la fin.

## 7. Architecture proposée

- **Client :** Vite, React et TypeScript pour les pages dashboard, viewer et overlay.
- **Jeux :** cinq arènes Phaser 2D intégrées à la page overlay ; Marble Fall et Arena Royale sont adaptées en 2D pour la démo. Les actions viewer passent par Socket.IO et sont validées par le serveur.
- **Serveur :** Node.js avec Socket.IO pour sessions, actions et classement.
- **Données :** mémoire serveur pour la démo ; pas de base de données.
- **OBS :** URL d’overlay ajoutée comme Browser Source ; pas de plugin OBS natif pour le MVP.
- **PWA :** optionnelle, seulement après validation de la boucle jouable.

## 8. Hors périmètre MVP

- Jeu 3D, jeux supplémentaires et éditeur de jeux.
- OAuth Twitch/YouTube, authentification et profils persistants.
- Twitch Extension native, intégration de chat, EventSub et Channel Points.
- Classements persistants entre sessions ou classement global.
- Paiements, récompenses, modération avancée et personnalisation d’avatars.
- PWA si elle met en risque le parcours principal.
- Mise à l’échelle multi-serveur et stockage durable.

## 9. Critères d’acceptation de la démo

1. Le streamer peut créer une session, sélectionner chacun des cinq jeux, choisir une durée entière entre 3 et 10 minutes et voir sa sélection sur l’overlay.
2. Avant le lancement, le dashboard affiche le lien et le QR code viewer.
3. Le streamer peut choisir avant le lancement de participer au combat ou de rester animateur.
4. Le choix streamer participant/animateur est visible et verrouillé au lancement ; les actions du streamer sont acceptées uniquement s’il a choisi de participer.
5. L’URL d’overlay fonctionne dans OBS Browser Source et affiche le jeu et le QR code.
6. Deux téléphones peuvent rejoindre la même session avec des pseudos distincts et voir les commandes adaptées au jeu sélectionné.
7. Une action viewer confirmée met à jour le jeu sélectionné et le score de son auteur.
8. Les actions répétées au-delà de la cadence serveur sont refusées sans augmenter les scores.
9. Le top 5 se met à jour pendant la session dans le tableau de bord et l’overlay.
10. Le contrôle spécial du streamer fonctionne dans les jeux qui le proposent ; Rage du boss n’est disponible que dans Boss Raid.
11. Le chrono partagé se termine automatiquement à la durée choisie et le classement final reste visible.
12. Les commandes viewer correspondent au jeu choisi : saut, attaque, réponses quiz, direction de bille ou poussée directionnelle.
13. L’interface viewer reste utilisable sur petit écran, et l’interface streamer reste lisible sur ordinateur.
14. Finir ou redémarrer une session produit un état compréhensible pour streamer et viewers.

## 10. Ordre de réalisation jusqu’à samedi

### Mercredi — Base jouable

- Initialiser le projet web et le serveur temps réel.
- Construire les écrans dashboard, overlay et manette mobile.
- Implémenter création/rejoindre une session.

### Jeudi — Boucle de jeu

- Ajouter le boss, les PV, les attaques viewers et les effets visuels.
- Relier les appareils à une session Socket.IO.
- Ajouter validation serveur et limite anti-spam.

### Vendredi — Streamer et classement

- Ajouter le QR code, l’URL OBS et l’état de connexion.
- Ajouter le bouton d’événement spécial.
- Ajouter les dégâts individuels, le top 5 et les états de fin.
- Ajuster responsive, lisibilité et couleurs violet/blanc.

### Samedi — Stabilisation et démo

- Faire un parcours complet streamer + plusieurs viewers + OBS.
- Corriger les blocages de démo.
- Préparer une session de secours avec des joueurs simulés seulement si nécessaire.
- Ajouter PWA uniquement si tous les critères d’acceptation sont déjà satisfaits.

## 11. Risques et réponses

- **Délai du stream :** confirmer les actions sur mobile immédiatement, sans attendre que le viewer voie l’effet vidéo.
- **Spam :** imposer une cadence par joueur et valider toutes les actions sur le serveur.
- **Faible participation :** permettre une démo locale avec plusieurs appareils ; simulation de joueurs en bonus.
- **Overlay difficile à configurer :** fournir une URL unique, un aperçu et des étapes OBS courtes.
- **Portée trop large :** protéger en priorité la boucle rejoindre → agir → voir l’impact → consulter le score.

## 12. Valeurs par défaut et décisions restantes

Les valeurs de jeu ci-dessus sont des réglages initiaux, pas des exigences d’équilibrage. Les ajuster après un essai sans changer la boucle du MVP.

- L’application doit être publiée sur une URL HTTPS accessible depuis les téléphones des viewers et l’ordinateur du streamer. L’URL publique sera configurée par variable d’environnement ; le fournisseur d’hébergement peut être choisi au début du déploiement.
- Le nom final de l’application et du jeu peut rester provisoire pendant le développement.
- Les bots sont facultatifs. Si le temps manque, faire la démo avec plusieurs onglets/appareils plutôt que d’ajouter une simulation.

Le MVP vise les cinq mini-jeux, la durée réglable, le parcours de session, les commandes mobile, le classement et l’overlay. La PWA reste le dernier bonus si le temps le permet.

