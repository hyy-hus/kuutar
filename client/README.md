# Kuutar – käyttöliittymä

Kuutarin selainkäyttöliittymä: React 19, Vite, [TanStack Router, Query ja Form](https://tanstack.com), Tailwind CSS 4, [Tiptap](https://tiptap.dev) ja [i18next](https://www.i18next.com). Projektin yleiskuvaus ja koko kehitysympäristön käynnistys löytyvät [juuren README:stä](../README.md).

## Käynnistys

```sh
cp .env.example .env   # VITE_API_URL osoittaa palvelimeen
pnpm install
pnpm run dev
```

Kehityspalvelin käynnistyy osoitteeseen http://localhost:5173. Portti on kiinteä (`--strictPort`): jos se on varattu, Vite pysähtyy virheeseen eikä vaihda porttia.

## Komennot

| Komento | Kuvaus |
|---|---|
| `pnpm run dev` | Kehityspalvelin |
| `pnpm build` | Tuotantoversio hakemistoon `dist/` |
| `pnpm check` | Biome-lint ja -muotoilu |
| `pnpm typecheck` | TypeScript-tyyppitarkistus |
| `pnpm generate:api` | Päivittää rajapinnan tyypit (`src/api/schema.d.ts`) käynnissä olevan palvelimen OpenAPI-kuvauksesta |
| `pnpm generate-routes` | Päivittää reittipuun (`src/routeTree.gen.ts`) |

## Käännökset

Käyttöliittymä on käännetty suomeksi, ruotsiksi ja englanniksi (`messages/fi.json`, `sv.json`, `en.json`). Kaikki näkyvät tekstit kulkevat `t()`-funktion kautta suomenkielisellä oletustekstillä:

```tsx
const { t } = useTranslation();
<span>{t("uusiVaraus", "Uusi varaus")}</span>
```

Kun lisäät uuden avaimen, lisää se kaikkiin kolmeen käännöstiedostoon.

## Rakenne

| Hakemisto | Sisältö |
|---|---|
| `src/routes/` | Sivut, tiedostopohjainen reititys (TanStack Router) |
| `src/components/` | Jaetut komponentit, esimerkiksi lomakkeet, kalenteri ja tekstieditori |
| `src/hooks/` | Rajapintakutsut TanStack Query -hookeina |
| `src/api/` | Rajapinta-asiakas (`openapi-fetch`) ja generoidut tyypit |
| `src/utils/` | Apufunktiot: päivämäärät, jaksot, muotoiltu teksti, … |
