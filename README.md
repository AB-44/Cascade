# Smart Task (Cascade)

مشروع Laravel API + واجهة React (Vite/TypeScript) لتتبّع الأهداف الهرمي، المشاريع،
الفريق، والقوالب. تم دمج ملفات الـ backend (`cascade-backend`) والـ frontend
(`hierarchical-goal-tracker-app`) داخل هيكل مشروع Laravel الجديد `smart-task`.

## هيكل المشروع

```
smart-task/
├── app/Models/           Goal, GoalTemplate, TeamMember, Project, ChecklistItem, TimeSession, User
├── app/Http/Controllers/Api/   AuthController, StateController, GoalController, ProjectController, TeamMemberController, TemplateController
├── app/Http/Requests/    Sync*Request (تحقق من صحة بيانات المزامنة)
├── database/migrations/  جداول goals, projects, team_members, templates, checklist_items, time_sessions
├── routes/api.php        كل مسارات /api
├── frontend/             تطبيق React (Vite) — مشروع npm مستقل يتكلم مع الـ API عبر fetch
```

**مهم:** جهازي (اللي كتب هذا الكود) ما عنده PHP ولا Composer ولا اتصال بـ
Packagist، فما قدرت أشغّل `composer install` أو `php artisan migrate` فعليًا
هنا. الخطوات التالية لازم تسويها عندك.

## 1. تركيب الـ backend

```bash
cd smart-task
composer install
composer require laravel/sanctum
```

`laravel/sanctum` مو مضاف بعد لـ `composer.json` — لازم تشغّل الأمر أعلاه
بنفسك عشان يحمّل الحزمة ويحدّث `composer.lock`. كل شيء ثاني (الموديل، الراوتس،
الميدلوير، إعدادات CORS) مجهّز ومربوط مسبقًا:

- `app/Models/User.php` فيه `HasApiTokens` trait جاهزة.
- `bootstrap/app.php` مسجّل فيه `routes/api.php`.
- `config/cors.php` مضاف ويسمح بالأصل المحدد في `FRONTEND_URL` بالـ `.env`
  (افتراضيًا `http://localhost:5173`).

### الترحيل (migrate) + الـ seed

```bash
php artisan migrate
php artisan db:seed
```

هذا ينشئ حساب دخول:

- **البريد:** `abdullah@cascade.local`
- **كلمة المرور:** `change-me-please`

**غيّرها فورًا** — إما عدّل `database/seeders/DatabaseSeeder.php` قبل الـ
seed، أو حدّثها بعدين:

```bash
php artisan tinker
>>> $u = App\Models\User::first();
>>> $u->email = 'you@example.com';
>>> $u->password = 'new-strong-password';
>>> $u->save();
```

### التشغيل

```bash
php artisan serve
```

يشتغل على `http://127.0.0.1:8000`. جرّب:

```bash
curl -X POST http://127.0.0.1:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"new-strong-password"}'
```

لازم يرجع `token`.

## 2. تشغيل الـ frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

الافتراضي في `frontend/.env`: `VITE_API_URL=http://127.0.0.1:8000/api`
(يطابق منفذ `php artisan serve`). يفتح على `http://localhost:5173` وهو نفس
الأصل المضبوط في `FRONTEND_URL` بملف `.env` الخاص بالـ backend.

## نظرة على الـ API

| Method | Route | الوظيفة |
|---|---|---|
| POST | `/api/login` | تسجيل الدخول، يرجع token |
| POST | `/api/logout` | إلغاء الـ token الحالي |
| GET | `/api/state` | يرجع كل بيانات التطبيق (أهداف، قوالب، أعضاء، مشاريع) دفعة وحدة |
| PUT | `/api/goals` | يستبدل شجرة الأهداف بالكامل (diff & replace داخل transaction) |
| PUT | `/api/team-members` | يستبدل قائمة الأعضاء |
| PUT | `/api/projects` | يستبدل قائمة المشاريع |
| PUT | `/api/templates` | يستبدل قائمة القوالب |

كل المسارات (عدا `/login`) محمية بـ `auth:sanctum` وتتطلب
`Authorization: Bearer <token>`.

## ملاحظات

- قاعدة البيانات الافتراضية sqlite (`database/database.sqlite`)، جاهزة
  بدون أي إعداد إضافي. لو تبي MySQL بدّل `DB_*` بملف `.env`.
- صفحة Laravel الافتراضية (`resources/views/welcome.blade.php`) باقية كما
  هي بدون تغيير — التطبيق الحقيقي هو الـ SPA اللي بمجلد `frontend/`.
