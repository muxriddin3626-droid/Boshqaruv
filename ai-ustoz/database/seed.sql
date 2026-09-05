-- Demo uchun boshlang'ich mavzular ro'yxati (DTM dasturi asosida, qisqartirilgan namuna).
-- Productionda to'liq 5-11 sinf dasturi shu jadvalga yuklanadi.
-- `category` — Weakness Radar'da ko'rsatiladigan yirik bo'lim nomi.

insert into lessons (subject, grade, topic_order, title, category) values
    ('kimyo', 9, 1, 'Atom tuzilishi va davriy sistema', 'Anorganik kimyo'),
    ('kimyo', 9, 2, 'Kimyoviy bog''lanish turlari', 'Anorganik kimyo'),
    ('kimyo', 9, 3, 'Alkanlar va ularning izomeriyasi', 'Organik kimyo'),
    ('kimyo', 9, 4, 'Alkenlar, alkinlar va sikloalkanlar', 'Organik kimyo'),
    ('biologiya', 9, 1, 'Hujayra tuzilishi va organoidlar', 'Hujayra biologiyasi'),
    ('biologiya', 9, 2, 'Fotosintez jarayoni', 'Hujayra biologiyasi'),
    ('biologiya', 9, 3, 'Krebs sikli va energiya almashinuvi', 'Hujayra biologiyasi'),
    ('biologiya', 9, 4, 'Mendel qonunlari va irsiyat', 'Genetika')
on conflict (subject, grade, topic_order) do nothing;
