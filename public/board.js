// Lövhə, kartlar və fiqurlar — həm server, həm də brauzer istifadə edir.
const S = (name, price, g, rents, hc) => ({ type: 'street', name, price, g, rents, hc });
const R = (name) => ({ type: 'rail', name, price: 200, g: 'rail' });
const U = (name) => ({ type: 'util', name, price: 150, g: 'util' });

export const GROUP_COLORS = {
  brown: '#8b4a2b', lblue: '#9fd8f2', pink: '#e0489a', orange: '#f28c1e',
  red: '#d8281f', yellow: '#f5d21b', green: '#1fa24a', dblue: '#1f4fb4',
  rail: '#2b2b2b', util: '#9aa5b1',
};

export const BOARD = [
  { type: 'go', name: 'GO' },
  S('Mediterranean Avenue', 60, 'brown', [2, 10, 30, 90, 160, 250], 50),
  { type: 'chest', name: 'Community Chest' },
  S('Baltic Avenue', 60, 'brown', [4, 20, 60, 180, 320, 450], 50),
  { type: 'tax', name: 'Income Tax', amount: 200 },
  R('Reading Railroad'),
  S('Oriental Avenue', 100, 'lblue', [6, 30, 90, 270, 400, 550], 50),
  { type: 'chance', name: 'Chance' },
  S('Vermont Avenue', 100, 'lblue', [6, 30, 90, 270, 400, 550], 50),
  S('Connecticut Avenue', 120, 'lblue', [8, 40, 100, 300, 450, 600], 50),
  { type: 'jail', name: 'Jail / Just Visiting' },
  S('St. Charles Place', 140, 'pink', [10, 50, 150, 450, 625, 750], 100),
  U('Electric Company'),
  S('States Avenue', 140, 'pink', [10, 50, 150, 450, 625, 750], 100),
  S('Virginia Avenue', 160, 'pink', [12, 60, 180, 500, 700, 900], 100),
  R('Pennsylvania Railroad'),
  S('St. James Place', 180, 'orange', [14, 70, 200, 550, 750, 950], 100),
  { type: 'chest', name: 'Community Chest' },
  S('Tennessee Avenue', 180, 'orange', [14, 70, 200, 550, 750, 950], 100),
  S('New York Avenue', 200, 'orange', [16, 80, 220, 600, 800, 1000], 100),
  { type: 'park', name: 'Free Parking' },
  S('Kentucky Avenue', 220, 'red', [18, 90, 250, 700, 875, 1050], 150),
  { type: 'chance', name: 'Chance' },
  S('Indiana Avenue', 220, 'red', [18, 90, 250, 700, 875, 1050], 150),
  S('Illinois Avenue', 240, 'red', [20, 100, 300, 750, 925, 1100], 150),
  R('B&O Railroad'),
  S('Atlantic Avenue', 260, 'yellow', [22, 110, 330, 800, 975, 1150], 150),
  S('Ventnor Avenue', 260, 'yellow', [22, 110, 330, 800, 975, 1150], 150),
  U('Water Works'),
  S('Marvin Gardens', 280, 'yellow', [24, 120, 360, 850, 1025, 1200], 150),
  { type: 'gotojail', name: 'Go To Jail' },
  S('Pacific Avenue', 300, 'green', [26, 130, 390, 900, 1100, 1275], 200),
  S('North Carolina Avenue', 300, 'green', [26, 130, 390, 900, 1100, 1275], 200),
  { type: 'chest', name: 'Community Chest' },
  S('Pennsylvania Avenue', 320, 'green', [28, 150, 450, 1000, 1200, 1400], 200),
  R('Short Line'),
  { type: 'chance', name: 'Chance' },
  S('Park Place', 350, 'dblue', [35, 175, 500, 1100, 1300, 1500], 200),
  { type: 'tax', name: 'Luxury Tax', amount: 100 },
  S('Boardwalk', 400, 'dblue', [50, 200, 600, 1400, 1700, 2000], 200),
];

// k: gain | pay | moveTo | moveBy | jail | jailcard | repairs | eachPay | eachGet | nearest
export const CHANCE = [
  { text: 'GO-ya irəli get. ₥200 topla.', k: 'moveTo', v: 0 },
  { text: 'Illinois Avenue-ya get.', k: 'moveTo', v: 24 },
  { text: 'St. Charles Place-ə get.', k: 'moveTo', v: 11 },
  { text: 'Ən yaxın Dəmiryoluna get. Sahibi varsa ikiqat kirayə ver.', k: 'nearest', v: 'rail' },
  { text: 'Ən yaxın Dəmiryoluna get. Sahibi varsa ikiqat kirayə ver.', k: 'nearest', v: 'rail' },
  { text: 'Ən yaxın kommunal şirkətə get. Sahibi varsa zərin 10 mislini ver.', k: 'nearest', v: 'util' },
  { text: 'Bank sənə ₥50 dividend ödəyir.', k: 'gain', v: 50 },
  { text: 'Həbsdən azad ol kartı. Saxla və ya sat.', k: 'jailcard' },
  { text: '3 xana geri get.', k: 'moveBy', v: -3 },
  { text: 'Birbaşa həbsxanaya get. GO-dan keçmə.', k: 'jail' },
  { text: 'Ümumi təmir: hər ev ₥25, hər otel ₥100.', k: 'repairs', v: [25, 100] },
  { text: 'Sürət həddini aşdın. ₥15 cərimə.', k: 'pay', v: 15 },
  { text: 'Reading Railroad-a get.', k: 'moveTo', v: 5 },
  { text: 'Boardwalk-a get.', k: 'moveTo', v: 39 },
  { text: 'Sən Sədr seçildin. Hər oyunçuya ₥50 ver.', k: 'eachPay', v: 50 },
  { text: 'Tikinti krediti başa çatdı. ₥150 al.', k: 'gain', v: 150 },
];

export const CHEST = [
  { text: 'GO-ya irəli get. ₥200 topla.', k: 'moveTo', v: 0 },
  { text: 'Bank xətası sənin xeyrinə. ₥200 al.', k: 'gain', v: 200 },
  { text: 'Həkim haqqı. ₥50 ver.', k: 'pay', v: 50 },
  { text: 'Səhm satışından ₥50 qazandın.', k: 'gain', v: 50 },
  { text: 'Həbsdən azad ol kartı. Saxla və ya sat.', k: 'jailcard' },
  { text: 'Birbaşa həbsxanaya get. GO-dan keçmə.', k: 'jail' },
  { text: 'Ad günüdür! Hər oyunçudan ₥10 al.', k: 'eachGet', v: 10 },
  { text: 'Gəlir vergisi geri qaytarıldı. ₥20 al.', k: 'gain', v: 20 },
  { text: 'Sığorta müddəti bitdi. ₥100 al.', k: 'gain', v: 100 },
  { text: 'Xəstəxana haqqı. ₥100 ver.', k: 'pay', v: 100 },
  { text: 'Məktəb haqqı. ₥50 ver.', k: 'pay', v: 50 },
  { text: 'Məsləhət haqqı qazandın. ₥25 al.', k: 'gain', v: 25 },
  { text: 'Küçə təmiri: hər ev ₥40, hər otel ₥115.', k: 'repairs', v: [40, 115] },
  { text: 'Gözəllik müsabiqəsində 2-ci oldun. ₥10 al.', k: 'gain', v: 10 },
  { text: 'Mirasdan ₥100 aldın.', k: 'gain', v: 100 },
  { text: 'Tətil fondu yetişdi. ₥100 al.', k: 'gain', v: 100 },
];

export const TOKENS = [
  { id: 'cat', name: 'Cat', icon: '🐈', color: '#e0489a' },
  { id: 'hat', name: 'Top Hat', icon: '🎩', color: '#d8281f' },
  { id: 'car', name: 'Race Car', icon: '🏎️', color: '#2fb6c9' },
  { id: 'dog', name: 'Dog', icon: '🐕', color: '#f28c1e' },
  { id: 'boot', name: 'Boot', icon: '🥾', color: '#8b4a2b' },
  { id: 'ship', name: 'Battleship', icon: '🚢', color: '#1f4fb4' },
  { id: 'thimble', name: 'Thimble', icon: '🧵', color: '#8f4fd8' },
  { id: 'wheelbarrow', name: 'Wheelbarrow', icon: '🛒', color: '#1fa24a' },
];
