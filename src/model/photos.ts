export interface Photo {
  src: string
  alt: string
  credit: string
  source: string
}

/** Real photos, both from Wikimedia Commons under CC BY-SA 4.0. See CREDITS.md. */
export const PHOTOS: Record<string, Photo> = {
  'third-mainland': {
    src: '/photos/third-mainland-night.jpg',
    alt: 'Third Mainland Bridge at night, headlights streaming across the lagoon',
    credit: 'Photo: S.aderogba, CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Third-mainland-bridge-at-night.jpg',
  },
  'ferry-ikorodu': {
    src: '/photos/canoe-third-mainland.jpg',
    alt: 'A passenger canoe crossing the lagoon beneath Third Mainland Bridge',
    credit: 'Photo: Kaizenify, CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:A_canoe_conveying_passenger_beneath_Third_mainland_Bridge,_Lagos.jpg',
  },
}
