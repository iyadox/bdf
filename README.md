# Blindages de France — site internet

Site vitrine 3D de **Blindages de France** (portes blindées certifiées A2P, coupe-feu et pare-balles, blindages, grilles, tôlerie et travaux spéciaux sur mesure — fabrication française depuis 1989).

Site statique ultra-rapide construit avec [Astro](https://astro.build), [Three.js](https://threejs.org) pour les scènes 3D et [MapLibre](https://maplibre.org) pour les cartes. Aucune base de données ni serveur à maintenir : chaque modification (depuis l'administration ou GitHub) reconstruit automatiquement le site en 1 à 2 minutes.

---

## Ce que contient le site

| Rubrique | Adresse | Points forts |
| --- | --- | --- |
| Accueil | `/` | Porte blindée 3D qui s'ouvre au défilement, vue éclatée animée de la structure, carte 3D du réseau, gammes, certifications, vidéos |
| Catalogue | `/catalogue` | 89 produits, filtres (vantaux, certification, fermeture), recherche, tri, vue grille/liste, favoris, comparateur (3 produits) |
| Fiches produits | `/catalogue/<gamme>/<produit>` | Galerie, caractéristiques, serrures, huisserie, options, finitions, certification, vidéo, PDF, variantes, produits associés |
| Configurateur 3D | `/configurateur` | Dimensions, 1 ou 2 vantaux, 18 teintes RAL + 6 décors bois, moulures, serrure 1 à 7 points, poignée, options, vue intérieure/extérieure, ouverture animée, vue de la structure, image téléchargeable, lien partageable, envoi vers le devis |
| Certifications | `/certification-porte-blindee` (+ anti-effraction, coupe-feu, pare-balles) | Niveaux, jauges, tests en laboratoire, vidéos, produits certifiés |
| Installateurs | `/installateurs-portes-blindees` | Carte interactive des 504 installateurs, recherche par ville/code postal, géolocalisation, tri par distance, fiches individuelles (standard ou premium) |
| Devis | `/devis-porte-blindee` | Formulaire en 4 étapes avec récapitulatif, brouillon enregistré automatiquement, pièce jointe, préremplissage depuis un produit, la sélection, un installateur ou le configurateur |
| Contact | `/nous-contacter` | Horaires en direct (ouvert/fermé), carte 3D du siège, accès, formulaire |
| Réseau | `/rejoindre-le-reseau-dinstallateurs-bdf` | Formulaire d'adhésion (compétences, zone, SIRET) |
| Espace Pro | `/espace-pro` | Accès installateurs et bibliothèque des 82 fiches techniques PDF avec recherche |
| L'entreprise, actualités, FAQ, pages légales, plan du site, page 404 | | |

Outils transverses : recherche instantanée (**Ctrl + K**), sélection de produits (cœur), barre d'actions rapides sur mobile, bandeau cookies conforme RGPD, vidéos YouTube chargées seulement après clic (sans cookie), mode allégé sans 3D (lien en pied de page), impression propre des fiches, données structurées Google (entreprise, produits, FAQ, articles, fil d'Ariane), plan du site XML, image de partage réseaux sociaux, icônes d'application.

---

## Administration du contenu (sans toucher au code)

L'interface d'administration est disponible à l'adresse **`/admin`** (par exemple `https://www.blindagesdefrance.fr/admin`). Elle permet de modifier :

- **Produits** : textes, images, PDF, filtres, serrures, options, certifications, référencement… ; masquer un produit en décochant « Publié ».
- **Catégories** du catalogue.
- **Installateurs** : ajouter, modifier, masquer une fiche ; cocher « Premium » pour une fiche vitrine (logo, galerie, vidéos, services).
- **Actualités** : rédaction d'articles avec image, vidéo YouTube et installateur lié.
- **Pages légales** : CGV, mentions légales, confidentialité.
- **Réglages du site** : téléphone, adresse, horaires, réseaux sociaux, bandeau d'annonce, chiffres clés, réception des formulaires, lien de l'Espace Pro, mesure d'audience, activation des effets 3D / de l'animation d'introduction / du configurateur / du comparateur.
- **FAQ** et page **L'entreprise**.

Chaque enregistrement crée une modification sur GitHub puis le site se met à jour tout seul.

### Première connexion à l'administration

L'administration utilise [Sveltia CMS](https://github.com/sveltia/sveltia-cms) relié au dépôt GitHub `iyadox/bdf` (branche `main`, réglable dans `public/admin/config.yml`). Deux façons de se connecter :

1. **Le plus simple : jeton GitHub.** Sur GitHub → *Settings → Developer settings → Personal access tokens → Fine-grained tokens*, créez un jeton limité au dépôt `iyadox/bdf` avec la permission *Contents : Read and write*. Sur `/admin`, choisissez « Se connecter avec un jeton » et collez-le.
2. **Bouton « Se connecter avec GitHub »** (site hébergé sur Netlify) : créez une *OAuth App* GitHub (URL de rappel : `https://api.netlify.com/auth/done`), puis dans Netlify → *Site configuration → Access & security → OAuth* → *Install provider* → GitHub, et collez l'identifiant et le secret.

> Les images envoyées depuis l'administration sont rangées dans `public/media/uploads`.

---

## Réception des formulaires (devis, contact, adhésion)

Réglage : **Administration → Réglages du site → Formulaires** (ou `src/data/settings.json` → `forms`).

| Service | Réglage | Ce qu'il faut faire |
| --- | --- | --- |
| **Netlify Forms** (par défaut) | `netlify` | Rien à configurer : les demandes apparaissent dans Netlify → *Forms*. Activez les notifications par e-mail dans *Forms → Form notifications*. |
| Web3Forms (gratuit) | `web3forms` | Créez une clé sur web3forms.com avec votre e-mail et renseignez « Clé Web3Forms ». |
| Formspree ou autre API | `formspree` / `custom` | Renseignez l'adresse d'envoi (ex. `https://formspree.io/f/xxxx`). |
| Messagerie du visiteur | `mailto` | Renseignez l'e-mail de réception. |

Protection anti-spam intégrée (champ piège invisible + délai minimal). En cas de problème d'envoi, le visiteur peut toujours appeler, copier sa demande ou l'envoyer par e-mail : **aucune demande n'est perdue**. Les brouillons sont conservés dans le navigateur du visiteur.

---

## Mise en ligne

Le fichier `netlify.toml` contient toute la configuration :

1. Sur [Netlify](https://app.netlify.com) : *Add new site → Import an existing project → GitHub* → dépôt `iyadox/bdf`, branche `main`. Les réglages de compilation sont lus automatiquement.
2. *Domain management* → ajoutez `www.blindagesdefrance.fr` puis modifiez les DNS chez le registrar selon les indications de Netlify (HTTPS automatique).
3. Activez les notifications des formulaires (voir ci-dessus).

Autre hébergeur statique (OVH, o2switch, Vercel, Cloudflare Pages…) : commande `npm run build`, dossier publié `dist`. Pensez alors à choisir un autre service de formulaires que Netlify et à reprendre les redirections du fichier `dist/_redirects` dans le format de l'hébergeur.

### Redirections des anciennes adresses

Pour conserver le référencement Google, `scripts/redirects.mjs` génère à chaque compilation plus de 700 redirections 301 : anciennes pages `/node/…` des installateurs (via leur champ « Ancien identifiant »), anciens articles, anciens filtres du catalogue, `/user/…` vers l'Espace Pro, anciens fichiers `/sites/default/files/…` vers `/media/…`. Pour en ajouter une, complétez la liste `STATIC` en tête du fichier.

---

## À vérifier avant la mise en ligne

- **Mentions légales** : la rubrique « Hébergement » reprend l'ancien hébergeur ; mettez-la à jour avec le nouvel hébergeur (ex. Netlify, Inc. — 512 2nd Street, Suite 200, San Francisco, CA 94107, États-Unis).
- **Espace Pro** : l'ancienne plateforme de connexion (`/user/login`) disparaît avec l'ancien site. Si l'espace professionnel est conservé sur une autre adresse (ex. `pro.blindagesdefrance.fr`), renseignez-la dans *Réglages → Espace Pro → Adresse de connexion* ; sinon le bouton propose « Demander mes accès ».
- **E-mail de réception** des formulaires et notifications Netlify.
- **Date de l'article** « Porte blindée 2 vantaux, essai de résistance au feu » (estimée au 28/04/2022, l'ancienne page n'en affichait pas).
- **Mesure d'audience** : renseignez Plausible ou Google Analytics si souhaité (chargés uniquement après consentement).

---

## Pour les développeurs

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # génère dist/ (+ dist/_redirects)
npm run preview   # prévisualise la version compilée
npm run check     # vérification TypeScript/Astro
```

Node.js 22 ou plus récent.

```
src/
  content/        contenus éditables (produits, catégories, installateurs, actualités, pages)
  data/           réglages, certifications, entreprise, FAQ, départements, contour de la France
  pages/          routes du site
  components/     composants (layout, accueil, catalogue, certifications, interface)
  scripts/
    three/        scènes 3D (porte procédurale, accueil, vue éclatée, réseau, configurateur)
    map/          cartes MapLibre aux couleurs de la marque
    pages/        interactions propres à chaque page
    ui/           en-tête, recherche, sélection, comparateur, formulaires, cookies, effets
  styles/         styles globaux et variables de la charte (bleus du site d'origine : #4a7396, #30638b, #1a4a6e, marine #001c3c)
public/
  admin/          interface d'administration
  media/          images et fiches PDF
  brand/          logos vectoriels
scripts/          génération du logo et des redirections
```

La porte 3D est entièrement procédurale (`src/scripts/three/door-model.ts`) : aucune maquette lourde à télécharger. Les scènes 3D se mettent en pause hors de l'écran, se désactivent en mode allégé, sur les appareils sans WebGL ou quand le visiteur a demandé à réduire les animations. Les polices sont hébergées sur le site (aucun appel à Google Fonts).
