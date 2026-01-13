# API Documentation

## Users
*   `GET /users/:email` - Get user details
*   `POST /users` - Create or update user
*   `GET /top-workers` - Get top 6 workers by coins

## Tasks
*   `GET /tasks` - Get all available tasks (with filters)
*   `POST /tasks` - Create a new task
*   `GET /tasks/:id` - Get task details
*   `GET /tasks/buyer/:email` - Get tasks by buyer
*   `DELETE /tasks/:id` - Delete a task

## Submissions
*   `POST /submissions` - Submit a task proof
*   `GET /submissions/worker/:email` - Get worker submissions
*   `GET /submissions/buyer/:email` - Get submissions for buyer's tasks
*   `PATCH /submissions/approve/:id` - Approve submission
*   `PATCH /submissions/reject/:id` - Reject submission

## Payments
*   `POST /create-payment-intent` - Initialize Stripe payment
*   `POST /payments` - Record payment and add coins
