# Zero Conditional — Netlify uchun tayyor loyiha

27 o‘quvchi telefon orqali bitta xonaga kiradi. 12 ta savol, har biriga 30 soniya, to‘g‘ri javobga 100 ball. O‘qituvchi savollarni boshqaradi. Telefon va kompyuterga mos.

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
5. Savolga javoblar kelgach yoki vaqt tugagach **Javobni ko‘rsatish**, so‘ng **Keyingi savol**ni bosadi.
6. Oxirida umumiy ballar va g‘oliblar chiqadi.

Bir taxallus bir xonada bir marta ishlatiladi. Xona 24 soatdan keyin foydalanish uchun yopiladi; bu saqlangan yozuvlarni avtomatik o‘chirishni anglatmaydi. Yangi dars uchun yangi xona oching. Javob yuborilgach uni almashtirish mumkin emas. Telefon va kompyuter internetga ulangan bo‘lishi kerak. Taxallus va ballar xonadagi ishtirokchilarga ko‘rinadi.

## Fayllar

- `public/index.html` — sahifa, dizayn va telefon interfeysi.
- `lib/questions.mjs` — 12 savol va to‘g‘ri javoblar; faqat serverda ishlatiladi.
- `lib/quiz.mjs` — xonalar, javoblar, ballar va bir vaqtdagi yozuvlar uchun ETag himoyasi.
- `netlify/functions/api.mjs` — Netlify server funksiyasi va Blobs ulanishi.
- `netlify.toml` — joylash sozlamalari va API marshrutlari.
- `test/quiz.test.mjs` — 27 parallel ishtirokchi va barcha savollar uchun avtomatik tekshiruv.

## Tekshiruv chegarasi

Mahalliy avtomatik sinovlar haqiqiy Netlify hisobiga ulanmasdan o‘tkazilgan. Ushbu ZIP alohida Netlify saytiga hali joylanmagan. Joylagach, boshqa telefon bilan xona ochish, kirish va bir savolga javob berishni sinab ko‘ring.

Rasmiy qo‘llanmalar:
- https://docs.netlify.com/build/functions/get-started/
- https://docs.netlify.com/build/data-and-storage/netlify-blobs/
- https://docs.netlify.com/deploy/create-deploys/
