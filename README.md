# LMS-Backend

LMS backend API with role-based authentication and course content management for the super admin panel.

## What This Service Does

- Authenticates users from bserc_core_db.users.
- Manages courses in lms_core_db.courses.
- Manages modules in lms_core_db.modules.
- Manages lessons (YouTube-based) in lms_core_db.lessons.
- Serves Swagger docs for API testing and contract visibility.

## Database Design

- Auth schema: AUTH_DB_NAME (example: bserc_core_db)
  Used for authentication tables (mainly users).

- LMS schema: LMS_DB_NAME (example: lms_core_db)
  Used for LMS content tables:
  - courses (includes is_published draft/publish flag)
  - modules (FK course_id -> courses.id, ON DELETE CASCADE)
  - lessons (FK module_id -> modules.id, ON DELETE CASCADE)

## Migration (Required)

Run these SQL files on lms_core_db:

```bash
mysql -u root -p < sql/001_create_modules_lessons.sql
mysql -u root -p < sql/002_add_course_is_published.sql
```

Migration file:
- sql/001_create_modules_lessons.sql
- sql/002_add_course_is_published.sql

## Environment Variables

Copy .env.example to .env and configure:

```dotenv
PORT=5000
JWT_SECRET=replace_with_secure_secret
CORS_ORIGIN=http://localhost:5173

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password

AUTH_DB_NAME=bserc_core_db
LMS_DB_NAME=lms_core_db

DB_CONNECTION_LIMIT=10

AWS_REGION=ap-south-1
AWS_S3_BUCKET=your-public-bucket-name
AWS_S3_COURSE_THUMBNAIL_PREFIX=courses/thumbnails
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

## Install And Run

```bash
npm install
npm run dev
```

Production mode:

```bash
npm start
```

## API Base URL

http://localhost:5000

## Swagger

- Swagger UI: http://localhost:5000/api-docs
- OpenAPI JSON: http://localhost:5000/api-docs.json

## Auth Endpoints

### POST /auth/login

Body:

```json
{
  "email": "admin@example.com",
  "password": "secret123",
  "requiredRole": "super_admin"
}
```

requiredRole is optional and can be one of:
- user
- admin
- instructor
- super_admin

### GET /auth/profile

Header:

```text
Authorization: Bearer <jwt_token>
```

### GET /auth/admin-only

Allowed roles:
- admin
- super_admin

### GET /auth/instructor-only

Allowed roles:
- instructor
- super_admin

## Course Endpoints

### GET /api/courses

- Public endpoint.
- Returns published courses only (is_published = true).

### GET /api/admin/courses

- Auth required.
- Allowed roles: admin, super_admin, instructor.
- Returns all courses including drafts and published records.

### POST /api/admin/courses

- Auth required.
- Allowed roles: admin, super_admin, instructor.
- multipart/form-data with optional thumbnail file.
- If thumbnail is provided, it is uploaded to S3 and stored as a public URL in courses.thumbnail.
- Thumbnail object keys are stored under AWS_S3_COURSE_THUMBNAIL_PREFIX (default: courses/thumbnails).
- New courses are always created as draft (is_published = false).

Required fields:
- title
- slug
- instructor_id

### POST /api/courses

- Auth required.
- Same create behavior as above but JSON payload.
- Maintained for backward compatibility.
- New courses are always created as draft (is_published = false).

### PATCH /api/admin/courses/:id/publish

- Auth required.
- Allowed roles: admin, super_admin, instructor.
- Sets is_published = true for the course.
- Used by course builder Publish action.

### GET /api/courses/:id/full

- Public endpoint.
- Returns one course with nested modules and nested lessons.
- Intended for complete content fetching in one request.

## Module Endpoints

### GET /api/courses/:courseId/modules

- Public endpoint.
- Returns modules for courseId with nested lessons.

### POST /api/admin/courses/:courseId/modules

- Auth required.
- Allowed roles: admin, super_admin, instructor.
- Creates module for a course.

Body:

```json
{
  "title": "Module title",
  "description": "Optional",
  "order_index": 1
}
```

### PUT /api/admin/modules/:moduleId

- Auth required.
- Updates module title, description, and order_index.

### DELETE /api/admin/modules/:moduleId

- Auth required.
- Deletes module.
- Lessons under that module are deleted automatically by FK cascade.

### PATCH /api/admin/courses/:courseId/modules/reorder

- Auth required.
- Persists module order.

Body:

```json
{
  "moduleIds": [11, 12, 13]
}
```

## Lesson Endpoints

### GET /api/modules/:moduleId/lessons

- Public endpoint.
- Lists lessons for a module.

### POST /api/admin/modules/:moduleId/lessons

- Auth required.
- Creates lesson in a module.
- youtube_url must be a valid YouTube link.

Body:

```json
{
  "title": "Lesson title",
  "description": "Optional",
  "youtube_url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "is_free_preview": false,
  "order_index": 1,
  "duration_seconds": 0
}
```

### PUT /api/admin/lessons/:lessonId

- Auth required.
- Updates lesson fields.
- Supports module_id reassignment for moving a lesson between modules.

### DELETE /api/admin/lessons/:lessonId

- Auth required.
- Deletes lesson.

### PATCH /api/admin/modules/:moduleId/lessons/reorder

- Auth required.
- Persists lesson order inside a module.

Body:

```json
{
  "lessonIds": [101, 102, 103]
}
```

## Notes For Frontend Integration

- Admin create course form: POST /api/admin/courses
- Admin course list sync: GET /api/admin/courses (with token)
- Admin builder load modules: GET /api/courses/:courseId/modules
- Admin builder create/update/delete modules: /api/admin/courses/:courseId/modules and /api/admin/modules/:moduleId
- Admin builder create/update/delete lessons: /api/admin/modules/:moduleId/lessons and /api/admin/lessons/:lessonId
- Admin builder publish: PATCH /api/admin/courses/:id/publish
- Admin builder reorder persistence:
  - PATCH /api/admin/courses/:courseId/modules/reorder
  - PATCH /api/admin/modules/:moduleId/lessons/reorder
- Course thumbnail URLs are returned directly from S3 in API responses.

## Common Errors

- 400: Validation error
- 401: Missing or invalid auth token
- 403: Role not allowed
- 404: Resource not found
- 409: Duplicate slug
- 500: Internal server error

## Documentation Upkeep Policy

For every API change, all of the following must be updated in the same change set:

1. Route-level OpenAPI JSDoc in src/routes/*.js
2. README endpoint and payload docs
3. Any affected frontend integration notes

This keeps Swagger and README as the source of truth for implementation.
