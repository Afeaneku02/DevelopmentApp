# Better You — Project Rules

## 1. Project Identity

This repository is named `DevelopmentApp`, but the actual product being developed is **Better You**.

* Repository/workspace name: `DevelopmentApp`
* Product name: `Better You`
* Treat all application development in this repository as development for Better You unless explicitly told otherwise.
* Do not rename the repository or root directory unless explicitly instructed.
* User-facing text, branding, documentation, UI labels, and product references should use **Better You**, not `DevelopmentApp`.

---

## 2. Product Purpose

Better You is a personal development application designed to help users move from where they are now to where they want to be.

The product should behave more like a **mentor** than a generic AI assistant.

A generic assistant waits for the user to know what to ask.

Better You should:

* understand the user's goals;
* understand their current situation;
* create a structured path toward those goals;
* identify useful next steps;
* track progress over time;
* adapt recommendations based on progress and setbacks;
* proactively guide the user when appropriate;
* reduce the need for the user to constantly determine the correct question to ask.

When evaluating features, consider:

**Does this make Better You behave more like a structured mentor, or are we simply recreating a generic AI chat interface?**

---

## 3. Development Approach

Do not unnecessarily over-engineer the application.

When implementing a feature:

1. Understand the requested behavior.
2. Inspect the existing code before changing architecture.
3. Prefer the simplest implementation that supports the current requirement.
4. Keep future scalability in mind without building unnecessary infrastructure prematurely.
5. Break large features into smaller testable components.
6. Explain major architectural decisions before making large structural changes.

---

## 4. Preserve Existing Work

Before modifying existing code:

* inspect the relevant files;
* understand how the current implementation works;
* avoid deleting working functionality unless explicitly required;
* avoid rewriting large sections of the application when a smaller change will work;
* preserve existing naming conventions where reasonable.

If a requested change could significantly affect existing architecture, explain the impact before proceeding.

---

## 5. Code Quality

Code should be:

* readable;
* modular;
* maintainable;
* appropriately documented;
* easy for another developer to understand;
* structured so individual features can be tested independently.

Avoid:

* unnecessary abstraction;
* duplicate logic;
* extremely large components or functions;
* hard-coded values that should be configuration;
* introducing dependencies without a clear reason.

---

## 6. Security and User Data

Better You will eventually handle personal user information.

Treat security and privacy as architectural requirements.

Never:

* hard-code API keys, secrets, passwords, or authentication tokens;
* commit secrets to Git;
* expose sensitive user information in logs;
* place production credentials directly in source code.

Use environment variables and appropriate secret-management practices.

Before implementing functionality involving authentication, personal information, permissions, payments, or sensitive user data, consider the security implications of the implementation.

---

## 7. AI Features

AI should support the Better You experience rather than become the entire product.

When building AI functionality:

* separate application/business logic from model-provider-specific logic where practical;
* avoid tightly coupling Better You to one AI provider unless necessary;
* structure AI integrations so providers or models can be changed later;
* store important application state in the application's own data model rather than relying entirely on AI conversation history;
* use deterministic application logic where deterministic logic is more appropriate than an AI model.

The product's value should come from the **system, workflow, user history, progress tracking, guidance, and experience**, not merely from providing access to an LLM.

---

## 8. Development Communication

When working on substantial changes:

* briefly state what you plan to change;
* identify the primary files involved;
* implement the change;
* summarize what was changed;
* mention any important follow-up work or unresolved issues.

If requirements are genuinely ambiguous and could result in significantly different implementations, ask for clarification rather than making a major assumption.

For small or obvious changes, proceed without unnecessary questioning.

---

## 9. Current Development Priority

The immediate development focus is establishing the core Better You experience.

Early work should prioritize foundational flows such as:

* onboarding;
* user goals;
* selecting suggested goals;
* creating custom goals;
* saving goals;
* representing goals in the application data model;
* eventually turning goals into plans and milestones.

Do not prioritize advanced or decorative features ahead of the core goal-to-guidance workflow unless explicitly instructed.

---

## 10. Git and Repository Safety

Do not:

* force push;
* delete branches;
* rewrite Git history;
* remove large groups of files;
* commit secrets;
* perform destructive Git operations

unless explicitly instructed.

Before a major structural change, ensure the existing state can be recovered through Git.

## 11. 

Before asking implementation questions, search the Product Vision, MVP Living Blueprint, existing architecture decisions, and development journal. 

* Do not ask the user to re-decide something already documented, Unless if direction is unclear or plan has clear flaws 
* Only ask about genuinely unresolved decisions.
* When a documented decision exists, cite the relevant document/section in your plan.
