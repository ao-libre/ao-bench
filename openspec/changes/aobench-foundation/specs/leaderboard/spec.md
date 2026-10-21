# Spec Delta

## Purpose

A public website and REST API that stores benchmark run results and displays model rankings, accessible at aobench.argentumonline.org.

## ADDED Requirements

### Requirement: Leaderboard API accepts run result submissions
`POST /api/runs` SHALL accept a run result from the harness containing model, task, score, duration, and run log, persist it with a generated run ID, and return HTTP 201.

#### Scenario: Run result submitted and stored
- **WHEN** the harness POSTs a valid run result
- **THEN** the API persists it and returns `{"id":"<runId>"}` with HTTP 201

#### Scenario: Malformed submission rejected
- **WHEN** a POST is missing required fields
- **THEN** the API returns HTTP 400

### Requirement: Leaderboard API serves best run per model per task
`GET /api/leaderboard/:task` SHALL return runs for the task ordered by score descending, one row per model showing only each model's best run.

#### Scenario: Best run per model returned
- **WHEN** a model has multiple runs for a task
- **THEN** only the highest-scoring run appears in the response

#### Scenario: All models appear
- **WHEN** multiple models have runs for a task
- **THEN** every model appears in the response

### Requirement: Leaderboard website displays public rankings
The website at `aobench.argentumonline.org` SHALL show a rankings table per task with model name, best score, run date, and rank, visible without authentication.

#### Scenario: Rankings visible without login
- **WHEN** a visitor opens `aobench.argentumonline.org`
- **THEN** the leaderboard table is visible

#### Scenario: Rankings update after new top run
- **WHEN** a new run with a higher score is submitted
- **THEN** the leaderboard reflects it within 60 seconds

### Requirement: Run logs are stored and retrievable
`GET /api/runs/:runId/log` SHALL return the full structured log of the run.

#### Scenario: Run log accessible by ID
- **WHEN** `GET /api/runs/:runId/log` is called with a valid ID
- **THEN** the full run log is returned

### Requirement: Submission requires a harness API key
`POST /api/runs` SHALL require a valid API key, returning HTTP 401 without one.

#### Scenario: Submission without key rejected
- **WHEN** `POST /api/runs` is called without a valid key
- **THEN** the API returns HTTP 401

#### Scenario: Submission with valid key accepted
- **WHEN** `POST /api/runs` is called with a valid key
- **THEN** the result is stored and HTTP 201 returned
