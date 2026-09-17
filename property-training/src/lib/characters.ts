export type UmaCharacter = {
  id: string;
  name: string;
  image: string;
};

export const UMA_CHARACTERS: UmaCharacter[] = [
  {
    "id": "special-week",
    "name": "Special Week",
    "image": "/characters/special-week.png"
  },
  {
    "id": "silence-suzuka",
    "name": "Silence Suzuka",
    "image": "/characters/silence-suzuka.png"
  },
  {
    "id": "tokai-teio",
    "name": "Tokai Teio",
    "image": "/characters/tokai-teio.png"
  },
  {
    "id": "maruzensky",
    "name": "Maruzensky",
    "image": "/characters/maruzensky.png"
  },
  {
    "id": "fuji-kiseki",
    "name": "Fuji Kiseki",
    "image": "/characters/fuji-kiseki.png"
  },
  {
    "id": "oguri-cap",
    "name": "Oguri Cap",
    "image": "/characters/oguri-cap.png"
  },
  {
    "id": "gold-ship",
    "name": "Gold Ship",
    "image": "/characters/gold-ship.png"
  },
  {
    "id": "vodka",
    "name": "Vodka",
    "image": "/characters/vodka.png"
  },
  {
    "id": "daiwa-scarlet",
    "name": "Daiwa Scarlet",
    "image": "/characters/daiwa-scarlet.png"
  },
  {
    "id": "taiki-shuttle",
    "name": "Taiki Shuttle",
    "image": "/characters/taiki-shuttle.png"
  },
  {
    "id": "grass-wonder",
    "name": "Grass Wonder",
    "image": "/characters/grass-wonder.png"
  },
  {
    "id": "mejiro-mcqueen",
    "name": "Mejiro McQueen",
    "image": "/characters/mejiro-mcqueen.png"
  },
  {
    "id": "el-condor-pasa",
    "name": "El Condor Pasa",
    "image": "/characters/el-condor-pasa.png"
  },
  {
    "id": "tm-opera-o",
    "name": "T.M. Opera O",
    "image": "/characters/tm-opera-o.png"
  },
  {
    "id": "symboli-rudolf",
    "name": "Symboli Rudolf",
    "image": "/characters/symboli-rudolf.png"
  },
  {
    "id": "seiun-sky",
    "name": "Seiun Sky",
    "image": "/characters/seiun-sky.png"
  },
  {
    "id": "mayano-top-gun",
    "name": "Mayano Top Gun",
    "image": "/characters/mayano-top-gun.png"
  },
  {
    "id": "agnes-tachyon",
    "name": "Agnes Tachyon",
    "image": "/characters/agnes-tachyon.png"
  },
  {
    "id": "mihono-bourbon",
    "name": "Mihono Bourbon",
    "image": "/characters/mihono-bourbon.png"
  },
  {
    "id": "rice-shower",
    "name": "Rice Shower",
    "image": "/characters/rice-shower.png"
  },
  {
    "id": "winning-ticket",
    "name": "Winning Ticket",
    "image": "/characters/winning-ticket.png"
  },
  {
    "id": "nice-nature",
    "name": "Nice Nature",
    "image": "/characters/nice-nature.png"
  },
  {
    "id": "king-halo",
    "name": "King Halo",
    "image": "/characters/king-halo.png"
  },
  {
    "id": "matikanefukukitaru",
    "name": "Matikanefukukitaru",
    "image": "/characters/matikanefukukitaru.png"
  }
];

export function getCharacter(id: string | null | undefined) {
  return UMA_CHARACTERS.find((c) => c.id === id) ?? null;
}
