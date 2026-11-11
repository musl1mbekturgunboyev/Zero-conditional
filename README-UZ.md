# Zero Conditional — Netlify uchun tayyor loyiha

27 o‘quvchi telefon orqali bitta xonaga kiradi. Har bir o‘quvchi o‘z tezligida ishlaydi: 12 ta savol, har savolga alohida 15 soniya. To‘g‘ri javobga 100 ball, xato yoki javobsiz savolga 0 ball. Telefon va kompyuterga mos.

## Ushbu yangilanishda

- O‘quvchi javobni tanlaganda natija va to‘g‘ri javob faqat uning telefonida 2 soniya ko‘rinadi; so‘ng navbatdagi savol avtomatik ochiladi.
- Boshqa o‘quvchilar kutilmaydi. Biri 2-savolda, boshqasi 1-savolda ishlashi mumkin.
- 15 soniya ichida javob berilmasa, savol javobsiz deb belgilanadi (0 ball), to‘g‘ri javob ko‘rsatiladi va avtomatik davom etadi.
- O‘qituvchi barcha ballarni, har bir o‘quvchining savol raqamini, to‘g‘ri, xato va javobsiz savollar sonini bitta jadvalda ko‘radi.
- Erta tugatgan o‘quvchi o‘z natijasini ko‘radi. Yakuniy g‘oliblar hamma tugatgandan keyin aniqlanadi.
- Sahifa yangilansa yoki telefon vaqtincha yopilsa, serverdagi taymer qayta boshlanmaydi. O‘tgan vaqtlar javobsiz hisoblanadi.

## Oldingi Netlify saytingizni yangilash

ZIP’ni oching va eski loyiha fayllarini shu loyiha bilan almashtiring. GitHub orqali joylagan bo‘lsangiz, yangilangan fayllarni o‘sha repository’ga yuboring; yangi deploy tugashini kuting. CLI ishlatsangiz, quyidagi buyruqlarni yangilangan loyiha papkasida bajaring va mavjud saytingizni tanlang.

Yangilanishdan keyin yangi xona oching. Eski xonalar avvalgi tartibga tegishli bo‘lib, yangi o‘yin bilan davom ettirilmaydi. O‘quvchilar ham saytdagi sahifani yangilab, yangi havola orqali kirsin.

## Eng oson joylash usuli: GitHub orqali

1. ZIP faylni oching.
2. GitHub’da yangi repository yarating va ochilgan papka ICHIDAGI barcha loyiha fayllarini yuklang. `netlify.toml`, `package.json`, `public`, `lib` va `netlify` repository ildizida bo‘lsin.
3. Netlify hisobingizda yangi loyihani mavjud Git repository’dan import qilishni tanlang; GitHub repository’ni ulang.
4. Sozlamalar `netlify.toml` dan olinadi. Agar so‘ralsa: Build command — `npm run build`; Publish directory — `public`; Functions directory — `netlify/functions`.
5. Deploy tugashini kuting va berilgan Netlify havolasini oching.

Netlify Blobs va Functions ma’lumotlarni qurilmalar orasida saqlaydi. Qo‘shimcha ma’lumotlar bazasi yoki API kalitini yozish shart emas. Netlify hisobingizda Functions va Blobs mavjud bo‘lishi kerak. Foydalanish hisobingiz limitlariga kiradi.

## Kompyuterdan terminal orqali joylash

Node.js 22 yoki undan yangi versiya o‘rnatilgan bo‘lsin. ZIP ochilgan loyiha papkasida terminal oching:

```sh
npm install
npm test
npx netlify login
npx netlify deploy --build --prod
```

So‘ralganda yangi Netlify loyiha yarating yoki o‘zingizning mavjud loyihangizni tanlang. Jamoangiz va sayt nomini tanlang. Sayt faqat shu buyruqni o‘zingiz bajarganingizdan keyin Netlify’ga joylanadi.

## Muhim: oddiy ZIP tashlash yetmaydi

Netlify’ning oddiy drag-and-drop oynasiga ZIP yoki faqat `public` papkasini tashlasangiz, server funksiyalari build qilinmaydi. Sahifa ochilishi mumkin, lekin xona yaratish va jonli o‘yin ishlamaydi. Yuqoridagi GitHub yoki CLI usulidan foydalaning.

## Darsni o‘tkazish

1. O‘qituvchi saytdan **Yangi xona ochish**ni bosadi.
2. **Taklif havolasini nusxalash**ni bosib, guruhga yuboradi.
3. O‘quvchilar havoladan kirib taxallusini yozadi. Havolada xona kodi tayyor turadi.
4. Hamma kirgach, o‘qituvchi **O‘yinni boshlash**ni bosadi.
5. Savollar har bir o‘quvchida mustaqil ravishda avtomatik o‘tadi. O‘qituvchi keyingi savol tugmasini bosmaydi; jadvaldan natijalarni kuzatadi.
6. O‘quvchi tugatgach shaxsiy natijasi chiqadi. Hamma tugatgach umumiy g‘oliblar ko‘rsatiladi.

Bir taxallus bir xonada bir marta ishlatiladi. Xona 24 soatdan keyin foydalanish uchun yopiladi; bu saqlangan yozuvlarni avtomatik o‘chirishni anglatmaydi. Yangi dars uchun yangi xona oching. Javob yuborilgach uni almashtirish mumkin emas. Telefon va kompyuter internetga ulangan bo‘lishi kerak. Taxallus va ballar xonadagi ishtirokchilarga ko‘rinadi.

## Fayllar

- `public/index.html` — sahifa va moslashuvchan dizayn.
- `public/app.js` — telefon interfeysi, shaxsiy taymer va jonli umumiy jadval.
- `lib/questions.mjs` — 12 savol va to‘g‘ri javoblar; faqat serverda ishlatiladi.
- `lib/game.mjs` — xonalar, mustaqil savollar, server taymerlari, javoblar, ballar va bir vaqtdagi yozuvlar uchun ETag himoyasi.
- `netlify/functions/api.mjs` — Netlify server funksiyasi va Blobs ulanishi.
- `netlify.toml` — joylash sozlamalari va API marshrutlari.
- `test/individual.test.mjs` — 27 parallel ishtirokchi, mustaqil o‘tish, vaqt tugashi, yakunlash, umumiy ballar va interfeys uchun avtomatik tekshiruvlar.

## Tekshiruv chegarasi

Mahalliy avtomatik sinovlar haqiqiy Netlify hisobiga ulanmasdan o‘tkazilgan. Ushbu ZIP alohida Netlify saytiga hali joylanmagan. Joylagach, boshqa telefon bilan xona ochish, kirish va bir savolga javob berishni sinab ko‘ring.

Rasmiy qo‘llanmalar:
- https://docs.netlify.com/build/functions/get-started/
- https://docs.netlify.com/build/data-and-storage/netlify-blobs/
- https://docs.netlify.com/deploy/create-deploys/
