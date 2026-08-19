# Better You — Codex Project Instructions

## Project Identity

This repository is named `DevelopmentApp`, but the product being built is **Better You**.

Treat all application development in this repository as Better You development unless explicitly stated otherwise.

Do not rename the repository or root directory unless explicitly instructed.

## Source of Truth

Before asking the user questions about architecture, technology stack, repository structure, testing, product behavior, or previously made decisions, review the existing project documentation.

Primary sources:

1. `CLAUDE.md`
2. Better You Product Vision and Requirements
3. Better You MVP Living Blueprint
4. `docs/architecture-decisions/`
5. `docs/development-journal/`

Do not ask the user to re-decide something already documented.

If a decision is documented, follow it unless:

* the documentation explicitly marks it as unresolved;
* the existing implementation conflicts with it;
* there is a significant technical reason to reconsider it.

If a documented decision appears problematic, explain the conflict before proposing a change.

## Development Philosophy

Build the MVP as the first layer of the real product, not disposable prototype code.

Prefer:

* simple implementations;
* clear architecture;
* maintainable code;
* incremental development;
* explicit validation;
* reusable boundaries around external providers.

Avoid:

* unnecessary abstraction;
* premature infrastructure;
* large rewrites without justification;
* adding libraries without a clear need.

## Before Coding

Before making a meaningful change:

1. Understand the requested outcome.
2. Read the relevant specification.
3. Inspect the existing implementation.
4. Identify dependencies.
5. Determine the smallest coherent implementation milestone.
6. Only ask clarifying questions that remain genuinely unresolved.

## Testing

Testing is part of the project architecture.

Use:

* unit tests for business logic;
* integration tests for API and data behavior;
* provider-adapter tests where applicable;
* end-to-end tests for critical user journeys.

Do not treat manual validation as a replacement for required automated tests.

## Better You Product Principle

Better You should behave more like a mentor than a generic AI assistant.

The system should increasingly understand:

* where the user is;
* where they want to go;
* what they have completed;
* what should happen next;
* when guidance should change.

AI supports the product but is not the sole source of truth.

Important application state should live in structured product data.

## Collaboration With Claude Code

Codex and Claude Code may both work on this repository.

Do not assume another agent's changes are correct.

When reviewing work produced by another agent:

* inspect the actual diff;
* compare it against the specifications;
* test meaningful behavior;
* identify contradictions;
* preserve documented decisions.

Do not silently rewrite another agent's implementation unless asked to make changes.

## Git Safety

Do not:

* force push;
* rewrite Git history;
* delete branches;
* commit secrets;
* perform destructive Git operations

unless explicitly instructed.

## Documentation

Meaningful discoveries, architectural decisions, implementation lessons, and completed development sessions should be preserved in the Better You development documentation rather than relying solely on chat history.
