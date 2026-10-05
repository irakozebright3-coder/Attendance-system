# AttendanceFlow — Premium UI/UX Blueprint

## 1. Design direction

AttendanceFlow is a premium dark-mode desktop SaaS product with a tactile, physical-depth visual language.

The experience should communicate:
- serious operational software
- real-time data
- trust and security
- speed for daily power users
- modern 3D polish without distracting from attendance work

Primary background:
\`#0B0F19\`

Card/container:
\`#161F30\`

Primary accents:
\`#8B5CF6\` Electric Purple
\`#3B82F6\` Neon Blue

Success/online:
\`#10B981\` Cyber Lime / Mint

Typography:
\`#FFFFFF\` Frost White
\`#9CA3AF\` Muted Slate Grey

The implementation lives primarily in:
- \`src/style.css\`
- \`src/design-system.css\`
- \`src/main.js\`

## 2. Z-axis hierarchy

Use this rendering order:

1. Background canvas
   - HTML5 Canvas / future WebGL scene
   - stars, particles, slow mesh motion
   - never intercept pointer events

2. Ambient glow meshes
   - blurred purple/blue radial lights
   - very low opacity
   - simulated global top-left light source

3. Translucent UI glass cards
   - dark card fill
   - severe backdrop blur
   - light-catching top and left border
   - outer shadow
   - inner highlight + inner depth shadow

4. Content
   - headers and values in #FFFFFF
   - body copy in #9CA3AF
   - supporting labels use desaturated slate

5. Active layer
   - liquid buttons
   - selected attendance cells
   - status badges
   - focused controls
   - hover micro-glows

6. Overlay layer
   - auth modal
   - date/person dialogs
   - toast feedback

## 3. Lighting physics

Treat the viewport as having one dominant soft light source from the top-left.

Recommended physical cues:
- brighter top border
- brighter left border
- darker lower/right edges
- inner highlight on upper-left corners
- deep ambient shadow beneath floating surfaces

The key visual model is:

\`light edge + glass diffusion + heavy ambient shadow + restrained neon glow\`

Avoid flat all-around borders because they make the interface look like ordinary cards instead of physical translucent surfaces.

## 4. Desktop 12-column wireframe

Use a centered container with generous desktop gutters.

### Global

\`12 columns\`
\`14–22px\` gutters between columns
\`20–48px\` outer page gutter depending on viewport

### Landing page header

- Columns 1–4: AttendanceFlow logo + wordmark
- Columns 5–9: navigation
- Columns 10–12: primary sign-in / CTA

### Hero

- Columns 1–7: title, description, CTA, trust indicators
- Columns 8–12: 3D orb / data visualization / floating status cards

### Capability ticker

- Full width, 12 columns
- diagonal/slanted visual treatment
- infinite horizontal movement
- low visual height so it does not compete with the hero

### Feature section

Recommended desktop structure:

- Main feature: columns 1–6, rows 1–2
- Realtime: columns 7–9, row 1
- Photo/camera: columns 10–12, row 1
- Security: columns 7–12, row 2

### Workflow

- Copy: columns 1–5
- Four workflow cards: columns 6–12

### Final CTA

- Full width: columns 1–12
- Copy aligned left
- CTA aligned right

## 5. Authenticated dashboard wireframe

### Top header

- Columns 1–5: logo + workspace
- Columns 6–8: backend/realtime status
- Columns 9–12: role, refresh, sign out

### Dashboard hero

- Columns 1–8: page title and contextual information
- Columns 9–12: primary actions

### Metric row

Use four equal modules:

- Columns 1–3: People
- Columns 4–6: Present today
- Columns 7–9: Absent today
- Columns 10–12: Attendance rate

### Register

Full 12-column width.

The person column behaves as a sticky foreground plane while dates form the horizontally scrollable data plane.

Use:
- strong sticky-column contrast
- compact attendance cells
- stable row height
- visible photo/initial
- identifier beneath name
- hover elevation
- clear present/absent/empty semantics

## 6. Glassmorphism implementation

The canonical card recipe is implemented as \`.af-glass\` / \`.glass\`.

Required properties:

- \`background\`: semi-transparent dark card fill
- \`backdrop-filter: blur(30px) saturate(132%)\`
- \`border-top\`: strongest highlight
- \`border-left\`: second strongest highlight
- \`border-right/bottom\`: weaker depth edges
- \`box-shadow\`: deep external shadow + inner highlight + inner depth shadow

This produces the illusion that the card is a thick translucent object floating above the ambient scene.

## 7. Interactive micro-glow

All active controls use the \`.liquid\` / \`.af-glow\` system.

Default:
- low or zero glow
- soft physical shadow

Hover:
- blurred radial gradient expands behind the control
- purple and blue intensity rises
- border becomes slightly brighter
- control lifts 2–5px

Active:
- small scale compression
- reduced lift
- immediate tactile response

Focus:
- visible keyboard focus ring
- do not depend on hover for keyboard users

## 8. Mouse parallax

Desktop cards use pointer-coordinate tilt.

Coordinate mapping:
- center pointer = 0deg
- horizontal movement controls rotateY
- vertical movement controls rotateX
- maximum recommended tilt = ±7deg

Use smooth interpolation rather than snapping.

Cards should feel as though their surface is physically responding to the mouse.

Parallax must be disabled for:
- coarse pointers
- \`prefers-reduced-motion: reduce\`

## 9. Cursor system

The desktop cursor is a two-layer cursor:

1. trailing outer ring
2. immediate inner dot

Normal state:
- small ring
- white point
- low glow

Hover state:
- outer ring expands
- border shifts toward purple
- soft micro-glow appears
- center dot scales slightly

Bind the cursor to:
- links
- buttons
- feature cards
- workflow cards
- floating status cards

Never show the custom cursor on touch/coarse-pointer devices.

## 10. Motion language

Motion should be slow, soft and continuous.

Recommended:
- 6–8s hero orb float
- 14–20s orbital rotations
- 25–35s capability marquee
- 1.4–2s status pulses
- 0.2–0.45s hover transitions

Avoid:
- abrupt large rotations
- constant high-frequency shaking
- excessive bounce easing
- animations competing with attendance actions

## 11. UX for desktop power users

Attendance is an operational task, so speed matters.

Recommended interactions:
- one-click attendance state cycling
- sticky person column
- keyboard-focusable attendance cells
- quick visual confirmation after save
- realtime status always visible
- refresh control for manual resync
- compact date headers
- no unnecessary navigation between marking actions
- destructive actions separated from frequent controls
- toast feedback instead of interruptive browser alerts where possible

The visual system should be impressive on first visit but almost invisible during repetitive attendance marking.

## 12. Empty/error/loading states

Empty:
- explain what is missing
- show one clear next action
- never insert fake data

Loading:
- preserve layout
- use subtle skeleton/shimmer
- prevent duplicate submission

Success:
- small mint feedback
- no intrusive modal unless necessary

Error:
- keep the user in context
- explain the failed action
- do not claim success when backend writes failed

## 13. Accessibility

Maintain:
- semantic buttons
- visible focus states
- image alt text
- keyboard navigation
- reduced-motion mode
- color contrast
- non-color indicators for attendance state

## 14. Performance guardrails

3D polish must not compromise the attendance workflow.

Keep:
- canvas/WebGL pointer-events disabled
- transforms GPU-friendly
- shadows restrained
- parallax limited to desktop
- realtime subscriptions deduplicated
- database reads team-scoped and indexed

## 15. Future WebGL / Three.js stage

A future Three.js scene can occupy \`.af-webgl-stage\` using:

Layer A:
- dark void background

Layer B:
- purple/blue ambient mesh strings

Layer C:
- 3D attendance orb / abstract geometry

Layer D:
- glass data cards

Layer E:
- high-contrast live metrics and CTA

Recommended camera:
- perspective camera
- subtle mouse influence
- slow idle rotation
- no forced camera movement during core task flows

The existing CSS design system deliberately provides the z-axis structure so a future WebGL layer can be inserted without redesigning the interface.

## 16. Brand consistency rules

Always use:

AttendanceFlow

Do not introduce unrelated product names, colors or placeholder branding.

Primary gradient:
Electric Purple → Neon Blue

Success:
Cyber Lime / Mint

Main background:
Deep Void Blue

Card:
Card Midnight

Headings:
Frost White

Body:
Muted Slate Grey
