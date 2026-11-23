# Seuraava julkaisu

Muutokset, jotka on yhdistetty `main`-haaraan mutta joita ei ole vielä julkaistu. Kun julkaisu tehdään, tämän tiedoston sisältö siirretään julkaisun kuvaukseen ja otsikoiden alla olevat kohdat tyhjennetään.

## Korjattua

- **Valinnaisia tekstikenttiä voi nyt tyhjentää:** kun muokkauslomakkeessa tyhjensi kentän ja tallensi, vanha arvo jäi voimaan. Nyt tyhjäksi jätetty kenttä poistaa arvon. Korjaus koskee varausten ylläpidon muistiinpanoja ja yhteyshenkilön nimeä, sähköpostia ja puhelinnumeroa sekä rajoitusten, varattavien lohkojen ja kierrosten kuvausta. (#151)
- **Kirjautumistiedot eivät enää päädy palvelimen lokeihin:** palvelin kirjasi kaiken lokeihin vianetsintätasolla, jolloin kirjautumisten salasanat, istuntojen uusintatunnisteet ja kertakäyttökoodit tallentuivat Scalewayn Cockpit-lokeihin. Lokitaso on nyt oletuksena `info`, ja salaiset arvot näkyvät lokeissa muodossa `<redacted>`. Lokeja on myös selvästi vähemmän. (#153)

## Huomioitavaa päivitettäessä

- Rajapinnan muokkauspyynnöissä (`PATCH`) näissä kentissä `null` tai puuttuva kenttä säilyttää nykyisen arvon, ja tyhjä merkkijono (myös pelkkiä välilyöntejä sisältävä) tyhjentää sen. Aiemmin tyhjä merkkijono tallentui sellaisenaan.
- Varauksen `contract_id`-kenttää ei voi edelleenkään tyhjentää rajapinnan kautta.
- Ei migraatioita eikä uusia asetuksia. (#151)
- Lokitason voi asettaa ympäristömuuttujalla `RUST_LOG` (oletus `info`). Uusia pakollisia asetuksia ei ole. (#153)
