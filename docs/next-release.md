# Seuraava julkaisu

Muutokset, jotka on yhdistetty `main`-haaraan mutta joita ei ole vielä julkaistu. Kun julkaisu tehdään, tämän tiedoston sisältö siirretään julkaisun kuvaukseen ja otsikoiden alla olevat kohdat tyhjennetään.

## Korjattua

- Kirjautumis-, sähköpostikoodi- ja rekisteröitymisyrityksiä rajoitetaan nyt. Liian monen yrityksen jälkeen näytetään, kuinka monen minuutin kuluttua voi yrittää uudelleen. (#156)

## Huomioitavaa päivitettäessä

- Uusi valinnainen asetus `TRUSTED_PROXY_HOPS` (oletus 1) kertoo, montako välityspalvelinta on palvelimen edessä. Tarkista stagingissa, että istuntolistassa näkyy oma IP-osoitteesi. (#156)
