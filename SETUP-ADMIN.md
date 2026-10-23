# Admin setup (one time, about 10 minutes)

The admin lives at `your-site/admin/`. It stores your changes in your Supabase project, and the live site reads them from there. After this setup you never need to redeploy to change content.

## 1. Create the database tables

1. Open your Supabase project.
2. Click **SQL Editor**, then **New query**.
3. Open the file `supabase/schema.sql` from this folder, copy everything, paste it into the editor.
4. Click **Run**. You should see "Success". It is safe to run again later.

## 2. Create your admin login

1. In Supabase click **Authentication**, then **Users**, then **Add user**.
2. Enter your email and a password. Tick "Auto confirm user" if it is offered.
3. Back in the **SQL Editor**, run this one line (use the same email):

```
insert into cms_admins (user_id, email, role)
select id, email, 'owner' from auth.users where email = 'you@example.com';
```

## 3. Connect the site to Supabase

1. In Supabase open **Project Settings**, then **API**.
2. Copy the **Project URL** and the **anon public** key.
3. Open `data/cms-config.js` in this folder and paste them in place of the two placeholders.
4. Do not use the `service_role` key anywhere in these files. It is secret.

## 4. Upload and sign in

1. Upload the whole folder to your hosting (Hostinger) as before.
2. Open `https://your-site/admin/` and sign in.

## Day to day

- Change anything from the menu or the search box, then press **Save and publish**.
- Visitors see your changes within seconds. No upload needed.
- **Activity and undo** shows every change and lets you bring back an older version.
- **Backup and restore** downloads everything you changed as one file.
- **Team** (owner only) adds people. First create their login in Supabase under Authentication, then add their email in Team.

## What can be changed

- All page text, links and images (96 pages), plus the header, menu and footer.
- Products: name, price, stock, picture, descriptions, bulk discounts, hide or show, order.
- Home page featured products, shipping protection fee, promo codes.
- Top banner, pop-up, contact form messages, maintenance mode.
- Search and sharing details, colours, font, tracking codes, redirects, uploaded images.

## Notes

- The cart and checkout are unchanged. Promo codes and the shipping fee are the only cart settings the admin controls.
- The site works with no database connection too. It then shows the original content.
- Admin security: only people listed under Team can change anything. The database enforces this, not just the screen.
- Replace the original branding and photos before launch.
