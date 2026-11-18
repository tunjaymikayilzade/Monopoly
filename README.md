# Monopoly

[![Play now](https://img.shields.io/badge/%E2%96%B6%20PLAY%20NOW-IN%20YOUR%20BROWSER-5ba35b?labelColor=555555&style=for-the-badge)](https://tunjay.mikayilzade.workers.dev)

**https://tunjay.mikayilzade.workers.dev**

No download, no sign-up.

Dostlarla onlayn Monopoly: 3D lövhə, səsli söhbət, otaq kodu ilə qoşulma və eyni cihazda oynamaq rejimi.

## Necə oynamaq olar
- **Onlayn:** "Yeni otaq yarat" düyməsinə bas, otaq linkini dostlara göndər.
- **Bir cihazda:** "Bu cihazda oyna" düyməsi ilə hamı növbə ilə eyni ekranda oynayır.

## Texnologiya
Cloudflare Workers + Durable Objects + WebSocket. Hər otaq bir Durable Object-dir, qaydalar serverdə işləyir. 3D hissə Three.js ilə, səslər WebAudio ilə, səsli söhbət WebRTC ilə (oyunçular arasında birbaşa) qurulub.

## Lokal işə salmaq
```
npm install
npm run dev        # http://localhost:8787
```

## Cloudflare-ə yükləmək
```
npx wrangler login   # bir dəfə
npm run deploy
```

## Testlər
`npm test` — təsadüfi oyunçularla məntiq simulyasiyası.
