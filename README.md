# MentorLink 2.0

MentorLink 2.0 is a mentorship management platform built with Node.js, Express, MongoDB, and Handlebars. It supports three main user roles, `mentee`, `mentor`, and `organization`, plus an `admin` role for platform management.

The platform allows mentees to request direct mentorship from mentors or request mentorship through organizations, while mentors and organizations manage sessions, view analytics, and maintain their profiles.

## Features

- Role-based authentication for mentees, mentors, organizations, and admins
- Direct mentorship flow from mentee to mentor
- Organization-managed mentorship flow from mentee to organization
- Session request, approval, completion, and cancellation flows
- Feedback and review support for completed sessions
- Profile picture uploads for users
- Analytics pages for mentors and organizations
- Admin dashboard for viewing and managing users
- Forgot-password and reset-password flow
- Updated UI across public, auth, mentee, mentor, organization, and admin pages

## Tech Stack

- Node.js
- Express
- MongoDB with Mongoose
- Handlebars (`hbs`)
- Express Session with MongoDB session store
- Multer for uploads
- Bcrypt for password hashing

## Project Structure

```text
MentorLink-complete/
|-- public/
|-- src/
|   |-- controllers/
|   |-- middleware/
|   |-- models/
|   `-- routes/
|-- views/
|   |-- admin/
|   |-- mentee/
|   |-- mentor/
|   |-- organization/
|   `-- partials/
|-- server.js
|-- package.json
`-- MENTORSHIP_FLOW_GUIDE.md
```

## User Roles

### Mentee
- Browse mentors and organizations
- Request direct mentorship sessions
- Request organization-managed mentorship
- Track sessions
- Submit feedback
- Update profile and profile photo

### Mentor
- Review mentorship requests
- Accept, reject, and complete sessions
- View analytics
- Manage profile and profile photo

### Organization
- Review mentorship requests from mentees
- Approve and complete sessions
- View analytics
- Manage organization profile and profile photo

### Admin
- View all users
- Open user details
- Delete users

## Mentorship Flows

### 1. Direct Mentorship
`Mentee -> Mentor`

- A mentee requests a session directly with a mentor
- The mentor reviews the request
- The mentor accepts or rejects the session
- Accepted sessions can later be marked as completed

### 2. Organization-Managed Mentorship
`Mentee -> Organization -> Mentor`

- A mentee requests mentorship through an organization
- The organization reviews the request
- The organization approves the session
- Approved sessions can later be marked as completed

For a more detailed breakdown, see [MENTORSHIP_FLOW_GUIDE.md](./MENTORSHIP_FLOW_GUIDE.md).

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/kkg-kevin/mentorlink2.0.git
cd mentorlink2.0
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root and use values like the following:

```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/mentorlink
SESSION_SECRET=replace_with_secure_secret
ADMIN_EMAIL=admin@mentorlink.com
ADMIN_PASSWORD=change_me
ADMIN_NAME=Administrator
```

### 4. Start MongoDB

Make sure your local MongoDB server is running before starting the app.

### 5. Run the app

For development:

```bash
npm run dev
```

For normal start:

```bash
npm start
```

The app runs by default at:

```text
http://localhost:3000
```

## Default Admin Behavior

On startup, the app checks for an admin user. If the configured admin does not exist, it is created automatically from the environment values.

If `ADMIN_EMAIL` and `ADMIN_PASSWORD` are not set, fallback defaults are used, so it is recommended to set secure values in `.env`.

## Main Routes

### Public
- `GET /`
- `GET /about`
- `GET /features`
- `GET /howitworks`
- `GET /contacts`

### Auth
- `GET /auth/login`
- `GET /auth/signup`
- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/forgot-password`
- `POST /auth/forgot-password`
- `GET /auth/reset-password/:token`
- `POST /auth/reset-password/:token`
- `POST /auth/logout`

### Mentee
- `GET /mentee/dashboard`
- `GET /mentee/profile`
- `GET /mentee/sessions`
- `GET /mentee/feedback`

### Mentor
- `GET /mentor/dashboard`
- `GET /mentor/profile`
- `GET /mentor/sessions`
- `GET /mentor/analytics`

### Organization
- `GET /org/dashboard`
- `GET /org/profile`
- `GET /org/sessions`
- `GET /org/analytics`

### Admin
- `GET /admin/dashboard`
- `GET /admin/user/:id`

## Uploads

Profile pictures are handled through Multer and stored in the public uploads area used by the app. The `.gitignore` excludes uploaded files from version control.

## Notes

- `node_modules` is ignored from Git
- `.env` is ignored from Git
- Uploaded files are ignored from Git
- There is currently no automated test suite configured in `package.json`

## Future Improvements

- Add automated tests
- Add email delivery for forgot-password links
- Add stronger onboarding and profile completion flows
- Add messaging and notifications
- Add calendar integrations and smarter scheduling

## Author

Built as the MentorLink project by Kevin.
