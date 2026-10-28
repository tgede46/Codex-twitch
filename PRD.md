# PRD — Plateforme de jeux interactifs pour streamers

**Version :** 0.1 — 28 octobre 2026  
**Échéance de démo :** samedi 31 octobre 2026  
**Statut :** cadrage MVP

## 1. Vision

Permettre à un streamer de lancer un jeu interactif sur son stream et à ses viewers de rejoindre depuis leur téléphone, sans installation ni compte. Les actions envoyées depuis le mobile doivent modifier immédiatement la partie affichée dans l’overlay du stream.

## 2. Objectif du MVP

Livrer une démo web responsive démontrant une boucle complète : le streamer crée une partie, les viewers rejoignent avec un pseudo et un QR code, ils attaquent ensemble un boss 2D, et le streamer peut afficher les meilleurs joueurs.

### Réussite attendue

- Un streamer peut lancer une session et ouvrir son overlay dans OBS comme source navigateur.
- Un viewer peut rejoindre depuis un téléphone avec un lien ou un QR code, sans compte.
- Une action mobile produit un retour immédiat sur le téléphone et un effet visible dans le jeu.
- Le boss perd des points de vie et la partie affiche les dégâts cumulés.
- Le streamer peut déclencher un événement spécial.
- Un classement de session affiche les cinq meilleurs joueurs et leurs dégâts.

## 3. Utilisateurs et besoins

### Streamer

- Créer et démarrer une session rapidement.
- Ajouter l’overlay à OBS sans installer de plugin natif.
- Afficher un QR code et un lien faciles à partager.
- Voir le nombre de joueurs connectés et l’état de la session.
- Déclencher un événement spécial et afficher le top 5.

### Viewer

- Rejoindre depuis le navigateur mobile, sans installation ni compte.
- Choisir un pseudo.
- Attaquer le boss depuis une commande mobile simple.
- Voir immédiatement si son action est acceptée et son score évoluer.
- Consulter le classement de la session.

## 4. Parcours principaux

### Parcours streamer

1. Ouvre le tableau de bord.
2. Crée une session Co-Op Boss Raid.
3. Copie l’URL de l’overlay dans une source navigateur OBS.
4. Lance la session. L’overlay affiche le jeu, le QR code, le lien et l’état.
5. Suit les joueurs, les dégâts et le classement.
6. Peut déclencher un événement spécial.
7. Termine la session.

### Parcours viewer

1. Scanne le QR code ou ouvre le lien partagé.
2. Saisit un pseudo.
3. Reçoit la manette mobile.
4. Appuie pour attaquer. L’interface confirme l’action et le jeu montre l’impact.
5. Suit ses dégâts et sa position au classement.

## 5. Fonctionnalités MVP

### Session et entrée

- Créer une session avec code court et URL partageable.
- Générer un QR code qui ouvre la page de la session.
- Autoriser un pseudo libre avec validation simple.
- Afficher les états : en attente, en cours, terminée, déconnectée.

### Jeu Co-Op Boss Raid

- Jeu 2D dans un canvas adapté à l’overlay.
- Boss avec barre de vie visible.
- Attaque viewer avec cadence limitée côté serveur.
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
- Le jeu se termine quand le boss atteint zéro PV ou quand le streamer termine la session. Pas de minuterie de défaite dans le MVP.
- Les dégâts sont conservés par joueur jusqu’à la fin de la session, même après une déconnexion.
- Le client reçoit une confirmation immédiate de son action et l’état partagé de la partie.
- Reconnexion simple : le client récupère l’état courant de la session.
- Les sessions et scores sont en mémoire pour le MVP ; un redémarrage serveur les efface.
- Le serveur génère un jeton hôte imprévisible. Seul le tableau de bord hôte peut déclencher les événements ou terminer la session ; l’overlay reste en lecture seule.
- Pseudos : 1 à 16 caractères, lettres, chiffres, espaces et tirets bas ; supprimer les espaces au début et à la fin.

## 7. Architecture proposée

- **Client :** Vite, React et TypeScript pour les pages dashboard, viewer et overlay.
- **Jeu :** Phaser 2D intégré à la page overlay.
- **Serveur :** Node.js avec Socket.IO pour sessions, actions et classement.
- **Données :** mémoire serveur pour la démo ; pas de base de données.
- **OBS :** URL d’overlay ajoutée comme Browser Source ; pas de plugin OBS natif pour le MVP.
- **PWA :** optionnelle, seulement après validation de la boucle jouable.

## 8. Hors périmètre MVP

- Jeu 3D, autres jeux du catalogue et éditeur de jeux.
- OAuth Twitch/YouTube, authentification et profils persistants.
- Twitch Extension native, intégration de chat, EventSub et Channel Points.
- Classements persistants entre sessions ou classement global.
- Paiements, récompenses, modération avancée et personnalisation d’avatars.
- PWA si elle met en risque le parcours principal.
- Mise à l’échelle multi-serveur et stockage durable.

## 9. Critères d’acceptation de la démo

1. Le streamer peut créer et démarrer une session depuis le tableau de bord.
2. L’URL d’overlay fonctionne dans OBS Browser Source et affiche le jeu et le QR code.
3. Deux téléphones peuvent rejoindre la même session avec des pseudos distincts.
4. Une attaque viewer confirmée réduit les PV du boss et augmente le score de son auteur.
5. Les attaques trop rapides sont refusées sans augmenter les scores.
6. Le top 5 se met à jour pendant la session dans le tableau de bord et l’overlay.
7. Le bouton streamer déclenche l’événement annoncé dans le jeu.
8. L’interface viewer reste utilisable sur petit écran, et l’interface streamer reste lisible sur ordinateur.
9. Finir ou redémarrer une session produit un état compréhensible pour streamer et viewers.

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

Ces choix suffisent pour commencer le code. Si le calendrier se resserre, livrer d’abord création/rejoindre, attaque synchronisée, PV du boss et overlay ; livrer ensuite classement et événement streamer. PWA reste le dernier bonus.

