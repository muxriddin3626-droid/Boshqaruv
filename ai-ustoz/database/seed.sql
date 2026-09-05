-- Demo uchun boshlang'ich mavzular ro'yxati (DTM dasturi asosida, qisqartirilgan namuna).
-- Productionda to'liq 5-11 sinf dasturi shu jadvalga yuklanadi.

insert into lessons (subject, grade, topic_order, title) values
    ('kimyo', 9, 1, 'Atom tuzilishi va davriy sistema'),
    ('kimyo', 9, 2, 'Kimyoviy bog''lanish turlari'),
    ('kimyo', 9, 3, 'Alkanlar va ularning izomeriyasi'),
    ('kimyo', 9, 4, 'Alkenlar, alkinlar va sikloalkanlar'),
    ('biologiya', 9, 1, 'Hujayra tuzilishi va organoidlar'),
    ('biologiya', 9, 2, 'Fotosintez jarayoni'),
    ('biologiya', 9, 3, 'Krebs sikli va energiya almashinuvi'),
    ('biologiya', 9, 4, 'Mendel qonunlari va irsiyat')
on conflict (subject, grade, topic_order) do nothing;
