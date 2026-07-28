# UI Display Options for Product Allocation Clarity

## Current Issue
- Target: 15
- Maximum theoretical: 9  
- Actually allocated: 8
- → Confusing, appears as "9/15" but only 8 are allocated

---

## Option 1: Minimal & Focused (Recommended for Dashboard)

**Design principle:** Show what matters now; hide complexity unless needed

### Visual Layout
```
┌─────────────────────────────────────────────┐
│ זוג שערי 5/2 קבוע 4582-TI                  │
│ עדיפות #5                                   │
├─────────────────────────────────────────────┤
│                                             │
│  מוקצה: 8 יחידות                           │
│  ├─ יעד: 15                                 │
│  ├─ אפשרי: 9                                │
│  └─ עודף: 0                                 │
│                                             │
│  [צבע ירוק/צהוב/אדום לפי סטטוס]            │
│                                             │
└─────────────────────────────────────────────┘
```

### Information Hierarchy
1. **Primary (bold, large):** מוקצה (8) — what was actually allocated
2. **Secondary (normal):** יעד (15) — goal
3. **Secondary (normal):** אפשרי (9) — theoretical max
4. **Tertiary (faint):** עודף (0) — surplus if any

### Color Logic
- **Green**: Allocated ≥ Target (goal achieved)
- **Yellow**: Allocated < Target but > 0 (partial progress)
- **Red**: Allocated = 0 (nothing built)

### Pros
- Clean, focused, easy to scan
- Answers the main question: "What did this product get?"
- Simple enough for a card/badge

### Cons
- Less detail about why allocation is limited
- No immediate visibility into bottleneck parts

---

## Option 2: Full Context (Recommended for Detail View / AllocationDetails Panel)

**Design principle:** Transparency + educational; help user understand constraints

### Visual Layout
```
┌──────────────────────────────────────────────────────┐
│ זוג שערי 5/2 קבוע 4582-TI                           │
│ עדיפות #5                                            │
├──────────────────────────────────────────────────────┤
│                                                      │
│ סטטוס הקצאה                                         │
│ ┌────────────────────────────────────────────────┐  │
│ │ יעד:        15 יחידות                          │  │
│ │ מוקצה:      8 יחידות (53% מהיעד)               │  │
│ │ אפשרי:      9 יחידות (תיאורטי)                 │  │
│ │ עודף:       0 יחידות מהיעד                     │  │
│ └────────────────────────────────────────────────┘  │
│                                                      │
│ מה מגביל את ההקצאה?                                │
│ ┌────────────────────────────────────────────────┐  │
│ │ חלק מגביל: DB4581-2BULL                       │  │
│ │ תיאור: קיט הרכבה לשערי 5/2 קבועים             │  │
│ │ מלאי כולל: 9 יחידות                           │  │
│ │ שימוש כולל: 9 יחידות (מוצרים אחרים גוזלים)   │  │
│ └────────────────────────────────────────────────┘  │
│                                                      │
│ המלצה: רכוש עוד DB4581-2BULL כדי להגיע ליעד      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Information Hierarchy
1. **Primary section:** Allocation status (יעד, מוקצה, אפשרי, עודף)
2. **Secondary section:** Bottleneck analysis
3. **Actionable:** Recommendation/alert

### Color Logic
- **Card background:**
  - Green if achieved target
  - Yellow if partial
  - Red if 0 allocated
- **Bottleneck part:** Highlighted in red/orange

### Pros
- Complete transparency into why allocation is limited
- Educational; users understand shared-part constraints
- Actionable recommendations (order more parts)
- Excellent for troubleshooting

### Cons
- More complex, requires space
- May overwhelm on a small dashboard card

---

## Hybrid Recommendation

**Use both together:**
- **Dashboard cards** (Option 1): Quick glance at allocation status
- **AllocationDetails panel** (Option 2): Full transparency when user clicks/selects a product

This gives:
- Clean primary interface
- Full detail on demand
- No confusion between the two contexts

---

## Proposed Implementation

### Where Option 1 appears:
- `ProductCard.tsx` — main dashboard card
- Summary section in SummaryCards

### Where Option 2 appears:
- `AllocationDetails.tsx` — detail panel (already has space for this)
- Potentially a new "Allocation Analysis" modal

---

## Questions for you:

1. Does Option 1 feel clear enough, or does it oversimplify?
2. Should Option 2 include the bottleneck/recommendation section, or keep it data-only?
3. Prefer the hierarchy/layout as shown, or would you rearrange it?
4. Any other information you'd want to add to either option?

Once you confirm, I'll implement both versions in the code.
