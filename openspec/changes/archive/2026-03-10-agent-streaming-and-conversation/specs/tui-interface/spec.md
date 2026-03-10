## MODIFIED Requirements

### Requirement: Attached view layout
The TUI attached view SHALL use a split layout with the output area occupying the main space (flexGrow) and a fixed-height input area (3 lines) anchored at the bottom.

#### Scenario: Attached view renders with conversation layout
- **WHEN** user presses Enter on a selected Agent to enter attached view
- **THEN** the view SHALL display: a header bar (Agent name + status indicator), a scrollable output area, and a bottom input area

#### Scenario: Attached view for Agent without process
- **WHEN** user enters attached view for an Agent that has no associated process (restored from persistence)
- **THEN** the view SHALL still display the output from log history and show input box based on sessionId availability
