# Current State Map (Pre-Refactor)

## Courses
- **Local keys**
  - `uniflow_courses`
  - `uniflow_files_<courseId>`
- **API usage**
  - `POST /courses/`
  - `DELETE /courses/:id`
- **In-component writes**
  - `src/pages/Courses.tsx` maintains local `courses` state and mirrors to localStorage.
  - Create/delete routes through service calls with local fallback behavior.

## Weekly Schedule
- **Local keys**
  - `weeklySchedule`
  - `weeklyScheduleVenues`
  - `weeklyTimeSlots`
- **API usage**
  - `GET /schedule/`
  - `PUT /schedule/`
- **In-component writes**
  - `src/pages/WeeklySchedule.tsx` writes local schedule and venues directly.
  - Backend save is fire-and-forget in several update paths.

## Tasks
- **Local keys**
  - `uniflow_tasks`
  - `uniflow_last_active_time`
- **API usage**
  - `GET /tasks/`
  - `POST /tasks/`
  - `PUT /tasks/:id`
  - `PATCH /tasks/:id/toggle`
  - `DELETE /tasks/:id`
- **State writes**
  - `useTasks` hook performs optimistic state updates.
  - `taskService` includes offline fallback + queueing in services layer.

## Events
- **Local keys**
  - `uniflow_events`
- **API usage**
  - `GET /events/`
  - `POST /events/`
  - `PUT /events/:id`
  - `DELETE /events/:id`
- **State writes**
  - `src/pages/Home.tsx` previously performed direct local + API writes.
  - `useEvents` hook already provides optimistic updates and service fallback.

## Architectural Risk Before Refactor
- Dual authority in page components (localStorage + API logic co-located).
- Inconsistent queue semantics across entities.
- Temporary IDs reconciled inconsistently.
